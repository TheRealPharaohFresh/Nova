import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type {
  AppSettings,
  ChatTurn,
  HotkeyAction,
  MemoryCategory,
  MemoryItem,
  MicStatus,
  PermissionKey
} from "../../shared/types";
import { PERMISSION_CATALOG } from "../../shared/types";
import type { PermissionState } from "../../shared/permissions";
import { MEMORY_CATEGORIES } from "../../shared/memory";
import { extractSpokenCommand } from "../../shared/voice";
import { HOTKEY_LABELS } from "../../shared/hotkeys";
import { MicCapture, webSpeechAvailable } from "./captureAudio";
import { PhaseTools } from "./PhaseTools";
import { interruptSpeech, listSpeechVoices, speakText } from "./tts";

type View = "chat" | "memory" | "computer" | "settings";

interface AppState {
  settings: AppSettings;
  permissions: PermissionState;
  micStatus: MicStatus;
  listenOpen?: boolean;
  emergencyStopped: boolean;
  version: string;
  platform: string;
  conversationId?: string;
  messages?: ChatTurn[];
  memories?: MemoryItem[];
  encryptionAvailable?: boolean;
}

const PROVIDERS = [
  { id: "openai", label: "OpenAI", models: "gpt-4o-mini" },
  { id: "anthropic", label: "Anthropic", models: "claude-sonnet-4-5" },
  { id: "google", label: "Google", models: "gemini-2.0-flash" },
  { id: "local", label: "Local (OpenAI-compatible)", models: "llama3.2" }
];

export function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [view, setView] = useState<View>("chat");
  const [mic, setMic] = useState<MicStatus>("off");
  const [stopped, setStopped] = useState(false);
  const [draft, setDraft] = useState("");
  const [lines, setLines] = useState<ChatTurn[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerId, setProviderId] = useState("openai");
  const [model, setModel] = useState("gpt-4o-mini");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [hasWhisperKey, setHasWhisperKey] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [holding, setHolding] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [memoryCategory, setMemoryCategory] = useState<MemoryCategory>("preferences");
  const conversationId = useMemo(() => crypto.randomUUID(), []);
  const conversationRef = useRef<string>(conversationId);
  const captureRef = useRef(new MicCapture());
  const stateRef = useRef<AppState | null>(null);
  const busyRef = useRef(false);
  const greeted = useRef(false);
  const sendRef = useRef<(text: string) => Promise<void>>(async () => undefined);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    const refreshVoices = () => setVoices(listSpeechVoices());
    refreshVoices();
    speechSynthesis?.addEventListener("voiceschanged", refreshVoices);
    return () => speechSynthesis?.removeEventListener("voiceschanged", refreshVoices);
  }, []);

  useEffect(() => {
    void window.nova.getState().then((s: AppState) => {
      setState(s);
      setMic(s.micStatus);
      setStopped(s.emergencyStopped);
      if (s.conversationId) {
        conversationRef.current = s.conversationId;
      }
      if (s.messages?.length) {
        setLines(s.messages);
      }
      if (s.memories) {
        setMemories(s.memories);
      }
      document.documentElement.dataset.theme = s.settings.theme;
    });
    const offMic = window.nova.on("nova:mic", (p) => {
      const payload = p as { status: MicStatus; listenOpen?: boolean };
      setMic(payload.status);
    });
    const offNav = window.nova.on("nova:navigate", (p) => {
      const payload = p as { view: View };
      setView(payload.view);
    });
    const offSettings = window.nova.on("nova:settings", (p) => {
      const next = p as AppSettings;
      setState((s) => (s ? { ...s, settings: next } : s));
    });
    const offStop = window.nova.on("nova:emergency", (p) => {
      const payload = p as { stopped: boolean };
      setStopped(payload.stopped);
      if (payload.stopped) {
        interruptSpeech();
        void captureRef.current.stop();
        setHolding(false);
      }
    });
    const offTok = window.nova.on("nova:chat-token", (p) => {
      const payload = p as { chunk: string };
      setLines((cur) => {
        const copy = [...cur];
        const last = copy[copy.length - 1];
        if (last?.role === "assistant") {
          copy[copy.length - 1] = {
            ...last,
            content: last.content + payload.chunk
          };
        }
        return copy;
      });
    });
    const offHotkey = window.nova.on("nova:hotkey", (p) => {
      const payload = p as { action: HotkeyAction };
      if (payload.action === "pushToTalk") {
        void (async () => {
          const current = stateRef.current;
          if (!current?.permissions.microphone || current.emergencyStopped) {
            return;
          }
          interruptSpeech();
          try {
            await captureRef.current.startHold({
              onTranscript: (text) => void sendRef.current(text),
              onError: (message) => setError(message)
            });
            window.setTimeout(() => {
              void captureRef.current.releaseHold();
            }, 8000);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Push-to-talk failed");
          }
        })();
      }
    });
    return () => {
      offMic();
      offNav();
      offSettings();
      offStop();
      offTok();
      offHotkey();
      void captureRef.current.stop();
    };
  }, []);

  useEffect(() => {
    void window.nova.hasSecret(providerId).then((r: { stored: boolean }) => setHasKey(r.stored));
  }, [providerId]);

  useEffect(() => {
    void window.nova.hasSecret("openai").then((r: { stored: boolean }) => setHasWhisperKey(r.stored));
  }, [hasKey]);

  async function patch(partial: Partial<AppSettings>) {
    const next = (await window.nova.updateSettings(partial)) as AppSettings;
    setState((s) => (s ? { ...s, settings: next } : s));
    if (next.theme) {
      document.documentElement.dataset.theme = next.theme;
    }
  }

  async function sendMessage(raw: string) {
    const current = stateRef.current;
    if (!current) {
      return;
    }
    const spoken = extractSpokenCommand(raw, {
      requireWakePhrase: current.settings.voice.requireWakePhrase,
      wakePhrase: current.settings.voice.wakePhrase,
      assistantName: current.settings.identity.assistantName
    });
    if (!spoken) {
      return;
    }
    if (busyRef.current) {
      await window.nova.stopGeneration();
      interruptSpeech();
    }
    setError(null);
    const userLine: ChatTurn = {
      id: crypto.randomUUID(),
      role: "user",
      content: spoken,
      createdAt: new Date().toISOString()
    };
    const assistantLine: ChatTurn = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString()
    };
    setLines((cur) => [...cur, userLine, assistantLine]);
    setBusy(true);
    try {
      const result = (await window.nova.chat({
        conversationId: conversationRef.current,
        content: spoken,
        providerId,
        model
      })) as { text: string; memories?: MemoryItem[] };
      if (result.memories) {
        setMemories(result.memories);
      }
      setLines((cur) => {
        const copy = [...cur];
        const last = copy[copy.length - 1];
        if (last?.role === "assistant" && last.content === "") {
          copy[copy.length - 1] = { ...last, content: result.text };
        }
        return copy;
      });
      if (current.settings.voice.autoSpeak && !current.settings.voice.mute) {
        await speakText(result.text, current.settings.voice);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed");
    } finally {
      setBusy(false);
    }
  }
  sendRef.current = sendMessage;

  useEffect(() => {
    if (!state?.settings.firstRunComplete || greeted.current) {
      return;
    }
    if (state.settings.startup.greetUser && !state.settings.voice.mute) {
      greeted.current = true;
      const { assistantName, userName } = state.settings.identity;
      void speakText(`Hello ${userName}, ${assistantName} is ready.`, state.settings.voice);
    }
  }, [state]);

  useEffect(() => {
    if (!state) {
      return;
    }
    if (stopped || !state.permissions.microphone || mic !== "listening") {
      if (mic !== "processing") {
        void captureRef.current.stop();
      }
      return;
    }
    interruptSpeech();
    void captureRef.current
      .startVad(
        {
          onTranscript: (text) => void sendRef.current(text),
          onError: (message) => setError(message)
        },
        state.settings.voice.vadRmsThreshold
      )
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not open microphone");
        void window.nova.stopListening();
      });
  }, [mic, stopped, state?.permissions.microphone, state?.settings.voice.vadRmsThreshold]);

  if (!state) {
    return <div className="hud">Loading NOVA…</div>;
  }

  const settings = state.settings;

  if (!settings.firstRunComplete) {
    return (
      <div className="hud">
        <header className="chrome">
          <span className="mark" />
          <span className="title">NOVA setup</span>
        </header>
        <div className="body settings">
          <label className="stack">
            What would you like to call your AI?
            <input
              type="text"
              value={settings.identity.assistantName}
              onChange={(e) =>
                void patch({ identity: { ...settings.identity, assistantName: e.target.value || "NOVA" } })
              }
            />
          </label>
          <label className="stack">
            What should {settings.identity.assistantName} call you?
            <input
              type="text"
              value={settings.identity.userName === "there" ? "" : settings.identity.userName}
              placeholder="Real name, nickname, Boss, Chief…"
              onChange={(e) =>
                void patch({ identity: { ...settings.identity, userName: e.target.value || "there" } })
              }
            />
          </label>
          <button className="primary" type="button" onClick={() => void patch({ firstRunComplete: true })}>
            Continue
          </button>
        </div>
      </div>
    );
  }

  async function togglePermission(key: PermissionKey, enabled: boolean) {
    const permissions = (await window.nova.setPermission(key, enabled)) as PermissionState;
    setState((s) => (s ? { ...s, permissions } : s));
  }

  async function onChat(e: FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content) {
      return;
    }
    setDraft("");
    await sendMessage(content);
  }

  async function toggleListen() {
    setError(null);
    if (!state || !state.permissions.microphone) {
      setError("Enable Microphone in Settings → Permissions first.");
      return;
    }
    if (mic === "listening" || mic === "processing") {
      await window.nova.stopListening();
      await captureRef.current.stop();
      return;
    }
    if (!webSpeechAvailable() && !hasWhisperKey) {
      setError("Need Chromium speech recognition or an OpenAI key for Whisper transcription.");
      return;
    }
    await window.nova.startListening();
  }

  async function onPttDown() {
    if (!state || !state.permissions.microphone) {
      setError("Enable Microphone in Settings → Permissions first.");
      return;
    }
    if (stopped) {
      return;
    }
    setHolding(true);
    interruptSpeech();
    try {
      await captureRef.current.startHold({
        onTranscript: (text) => void sendMessage(text),
        onError: (message) => setError(message)
      });
    } catch (err) {
      setHolding(false);
      setError(err instanceof Error ? err.message : "Microphone failed");
    }
  }

  async function onPttUp() {
    setHolding(false);
    await captureRef.current.releaseHold();
  }

  const micLabel = mic === "off" ? "MIC OFF" : mic === "listening" ? "MIC LISTENING" : "MIC PROCESSING";
  const sttHint = webSpeechAvailable()
    ? "On-device Chromium speech recognition is available."
    : hasWhisperKey
      ? "Utterances are transcribed with OpenAI Whisper."
      : "Add an OpenAI key for Whisper, or use a Chromium build with speech recognition.";

  return (
    <div className="hud">
      <header className="chrome">
        <span className="mark" />
        <span className="title">{settings.identity.assistantName}</span>
        <span className={`mic ${mic}`}>{micLabel}</span>
        <span className="spacer" />
        <button className="icon-btn" onClick={() => void window.nova.window("minimize")}>
          min
        </button>
        <button className="icon-btn" onClick={() => void window.nova.window("hide")}>
          hide
        </button>
        <button className="icon-btn" onClick={() => void window.nova.window("close")}>
          close
        </button>
      </header>

      {settings.hud.clickThrough ? (
        <div className="banner clickthrough">CLICK-THROUGH ON — use the tray or hotkeys · Disable click-through in the tray</div>
      ) : null}
      {stopped ? <div className="banner stop">EMERGENCY STOP — tools, speech, and automation halted</div> : null}

      <div className="body">
        <nav className="tabs">
          <button className={view === "chat" ? "active" : ""} onClick={() => setView("chat")}>
            Chat
          </button>
          <button className={view === "memory" ? "active" : ""} onClick={() => setView("memory")}>
            Memory
          </button>
          <button className={view === "computer" ? "active" : ""} onClick={() => setView("computer")}>
            Computer
          </button>
          <button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}>
            Settings
          </button>
        </nav>

        {view === "chat" ? (
          <>
            <div className="voice-bar">
              <button
                className={mic === "listening" ? "primary" : "icon-btn"}
                type="button"
                disabled={stopped}
                onClick={() => void toggleListen()}
              >
                {mic === "listening" || mic === "processing" ? "Stop listening" : "Start listening"}
              </button>
              <button
                className={holding ? "primary" : "icon-btn"}
                type="button"
                disabled={stopped || !state.permissions.microphone}
                onMouseDown={() => void onPttDown()}
                onMouseUp={() => void onPttUp()}
                onMouseLeave={() => {
                  if (holding) {
                    void onPttUp();
                  }
                }}
              >
                {holding ? "Release to send" : "Hold to talk"}
              </button>
              <label className="inline">
                <input
                  type="checkbox"
                  checked={settings.voice.mute}
                  onChange={(e) => void patch({ voice: { ...settings.voice, mute: e.target.checked } })}
                />
                Mute
              </label>
            </div>
            <div className="messages">
              {lines.length === 0 ? (
                <p className="hint">
                  {settings.identity.assistantName} is ready. Configure a provider key under Settings → AI.
                  {state.permissions.microphone
                    ? ` ${sttHint}`
                    : " Enable Microphone in Settings to speak."}{" "}
                    Wake-word gating (optional) and hotkeys are in Settings. Automated coding edits and security
                  execution tools are still <strong>unavailable</strong>.
                </p>
              ) : null}
              {lines.map((line) => (
                <div key={line.id} className={`bubble ${line.role}`}>
                  {line.content || (busy ? "…" : "")}
                </div>
              ))}
              {error ? <div className="bubble assistant">{error}</div> : null}
            </div>
            <form className="composer" onSubmit={onChat}>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Message ${settings.identity.assistantName}…`}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button className="primary" type="submit" disabled={busy}>
                  Send
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => {
                    interruptSpeech();
                    void window.nova.stopGeneration();
                  }}
                >
                  Stop
                </button>
              </div>
            </form>
            <button className="danger" type="button" onClick={() => void window.nova.emergencyStop()}>
              STOP EVERYTHING
            </button>
          </>
        ) : null}

        {view === "memory" ? (
          <div className="settings">
            <p className="hint">
              Memories are stored locally in SQLite and injected into the system prompt. Say “remember that …”
              in chat, or add them here.
            </p>
            <label className="stack">
              Category
              <select
                value={memoryCategory}
                onChange={(e) => setMemoryCategory(e.target.value as MemoryCategory)}
              >
                {MEMORY_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>
            <textarea
              value={memoryDraft}
              onChange={(e) => setMemoryDraft(e.target.value)}
              placeholder="Something NOVA should keep"
            />
            <button
              className="primary"
              type="button"
              onClick={async () => {
                const content = memoryDraft.trim();
                if (!content) {
                  return;
                }
                const item = (await window.nova.addMemory({
                  category: memoryCategory,
                  content
                })) as MemoryItem;
                setMemories((cur) => [item, ...cur]);
                setMemoryDraft("");
              }}
            >
              Save memory
            </button>
            {memories.length === 0 ? <p className="hint">No memories yet.</p> : null}
            {memories.map((item) => (
              <div key={item.id} className="memory-row">
                <div>
                  <strong>{item.category}</strong>
                  <div>{item.content}</div>
                </div>
                <button
                  className="icon-btn"
                  type="button"
                  onClick={async () => {
                    const next = (await window.nova.deleteMemory(item.id)) as MemoryItem[];
                    setMemories(next);
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {view === "computer" ? (
          <PhaseTools
            screenEnabled={state.permissions.screen}
            filesEnabled={state.permissions.files}
            emergencyStopped={stopped}
            automationPaused={settings.automationPaused}
            onOpenSettings={() => setView("settings")}
          />
        ) : null}

        {view === "settings" ? (
          <div className="settings">
            <div className="row">
              <span>Theme</span>
              <select
                value={settings.theme}
                onChange={(e) => void patch({ theme: e.target.value as AppSettings["theme"] })}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
            <div className="row">
              <span>Always on top</span>
              <input
                type="checkbox"
                checked={settings.hud.alwaysOnTop}
                onChange={(e) => void patch({ hud: { ...settings.hud, alwaysOnTop: e.target.checked } })}
              />
            </div>
            <div className="row">
              <span>HUD opacity</span>
              <input
                type="range"
                min={0.35}
                max={1}
                step={0.01}
                value={settings.hud.opacity}
                onChange={(e) =>
                  void patch({ hud: { ...settings.hud, opacity: Number(e.target.value) } })
                }
              />
            </div>
            <div className="row">
              <span>Click-through</span>
              <input
                type="checkbox"
                checked={settings.hud.clickThrough}
                onChange={(e) => void patch({ hud: { ...settings.hud, clickThrough: e.target.checked } })}
              />
            </div>
            <p className="hint">
              Click-through ignores mouse input on the HUD. Disable it from the tray item “Disable click-through”
              or {settings.hotkeys.toggleHud}.
            </p>

            <h3>Identity</h3>
            <label className="stack">
              Assistant name
              <input
                type="text"
                value={settings.identity.assistantName}
                onChange={(e) =>
                  void patch({ identity: { ...settings.identity, assistantName: e.target.value || "NOVA" } })
                }
              />
            </label>
            <label className="stack">
              What should I call you?
              <input
                type="text"
                value={settings.identity.userName}
                onChange={(e) =>
                  void patch({ identity: { ...settings.identity, userName: e.target.value || "there" } })
                }
              />
            </label>

            <h3>Personality</h3>
            <select
              value={settings.personality.preset}
              onChange={(e) =>
                void patch({
                  personality: {
                    ...settings.personality,
                    preset: e.target.value as AppSettings["personality"]["preset"]
                  }
                })
              }
            >
              <option value="professional">Professional</option>
              <option value="researcher">Researcher</option>
              <option value="assistant">Assistant</option>
              <option value="coach">Coach</option>
              <option value="custom">Custom</option>
            </select>
            {settings.personality.preset === "custom" ? (
              <textarea
                value={settings.personality.customInstructions}
                onChange={(e) =>
                  void patch({
                    personality: { ...settings.personality, customInstructions: e.target.value }
                  })
                }
              />
            ) : null}

            <h3>Voice</h3>
            <p className="hint">{sttHint} TTS uses the operating system speech synthesizer.</p>
            <div className="row">
              <span>Speak replies</span>
              <input
                type="checkbox"
                checked={settings.voice.autoSpeak}
                onChange={(e) => void patch({ voice: { ...settings.voice, autoSpeak: e.target.checked } })}
              />
            </div>
            <div className="row">
              <span>Mute</span>
              <input
                type="checkbox"
                checked={settings.voice.mute}
                onChange={(e) => void patch({ voice: { ...settings.voice, mute: e.target.checked } })}
              />
            </div>
            <div className="row">
              <span>Speed</span>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.05}
                value={settings.voice.rate}
                onChange={(e) => void patch({ voice: { ...settings.voice, rate: Number(e.target.value) } })}
              />
            </div>
            <div className="row">
              <span>Volume</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.voice.volume}
                onChange={(e) => void patch({ voice: { ...settings.voice, volume: Number(e.target.value) } })}
              />
            </div>
            <label className="stack">
              Voice
              <select
                value={settings.voice.voiceURI}
                onChange={(e) => void patch({ voice: { ...settings.voice, voiceURI: e.target.value } })}
              >
                <option value="">System default</option>
                {voices.map((voice) => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
            </label>
            <div className="row">
              <span>Require wake phrase</span>
              <input
                type="checkbox"
                checked={settings.voice.requireWakePhrase}
                onChange={(e) =>
                  void patch({ voice: { ...settings.voice, requireWakePhrase: e.target.checked } })
                }
              />
            </div>
            <label className="stack">
              Wake phrase
              <input
                type="text"
                value={settings.voice.wakePhrase}
                onChange={(e) => void patch({ voice: { ...settings.voice, wakePhrase: e.target.value } })}
              />
            </label>
            <p className="hint">
              Always-on “Hey NOVA” without Start listening needs a dedicated wake-word model (Porcupine or
              similar) and is not shipped. With listening on, optional gating drops utterances that do not start
              with the wake phrase or assistant name.
            </p>
            <button
              className="icon-btn"
              type="button"
              onClick={() => {
                interruptSpeech();
                void speakText(`This is ${settings.identity.assistantName}.`, settings.voice);
              }}
            >
              Test voice
            </button>

            <h3>Hotkeys</h3>
            {(Object.keys(HOTKEY_LABELS) as HotkeyAction[]).map((action) => (
              <label key={action} className="stack">
                {HOTKEY_LABELS[action]}
                <input
                  type="text"
                  value={settings.hotkeys[action]}
                  onChange={(e) =>
                    void patch({ hotkeys: { ...settings.hotkeys, [action]: e.target.value } })
                  }
                />
              </label>
            ))}
            <p className="hint">Electron accelerators, e.g. CommandOrControl+Shift+L. Invalid values reset.</p>

            <h3>Startup</h3>
            <div className="row">
              <span>Launch at login</span>
              <input
                type="checkbox"
                checked={settings.startup.launchAtLogin}
                disabled={!state.permissions.startup}
                onChange={(e) => void patch({ startup: { ...settings.startup, launchAtLogin: e.target.checked } })}
              />
            </div>
            {!state.permissions.startup ? (
              <p className="hint">Enable the Startup permission below before launch-at-login can take effect.</p>
            ) : null}
            <div className="row">
              <span>Start minimized</span>
              <input
                type="checkbox"
                checked={settings.startup.startMinimized}
                onChange={(e) =>
                  void patch({ startup: { ...settings.startup, startMinimized: e.target.checked } })
                }
              />
            </div>
            <div className="row">
              <span>Start in tray</span>
              <input
                type="checkbox"
                checked={settings.startup.startInTray}
                onChange={(e) => void patch({ startup: { ...settings.startup, startInTray: e.target.checked } })}
              />
            </div>
            <div className="row">
              <span>Open HUD on start</span>
              <input
                type="checkbox"
                checked={settings.startup.openHud}
                onChange={(e) => void patch({ startup: { ...settings.startup, openHud: e.target.checked } })}
              />
            </div>
            <div className="row">
              <span>Start listening</span>
              <input
                type="checkbox"
                checked={settings.startup.startListening}
                disabled={!state.permissions.microphone}
                onChange={(e) =>
                  void patch({ startup: { ...settings.startup, startListening: e.target.checked } })
                }
              />
            </div>
            <div className="row">
              <span>Greet on launch</span>
              <input
                type="checkbox"
                checked={settings.startup.greetUser}
                onChange={(e) => void patch({ startup: { ...settings.startup, greetUser: e.target.checked } })}
              />
            </div>

            <h3>AI</h3>
            <label className="stack">
              Provider
              <select
                value={providerId}
                onChange={(e) => {
                  const id = e.target.value;
                  setProviderId(id);
                  const found = PROVIDERS.find((p) => p.id === id);
                  if (found) {
                    setModel(found.models);
                  }
                }}
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="stack">
              Model
              <input type="text" value={model} onChange={(e) => setModel(e.target.value)} />
            </label>
            <label className="stack">
              API key (stored encrypted, never logged)
              <input
                type="password"
                value={apiKeyInput}
                placeholder={hasKey ? "Key saved — paste to replace" : "Paste key"}
                onChange={(e) => setApiKeyInput(e.target.value)}
              />
            </label>
            <button
              className="primary"
              type="button"
              onClick={async () => {
                await window.nova.setSecret(providerId, apiKeyInput);
                setApiKeyInput("");
                const r = (await window.nova.hasSecret(providerId)) as { stored: boolean };
                setHasKey(r.stored);
                const w = (await window.nova.hasSecret("openai")) as { stored: boolean };
                setHasWhisperKey(w.stored);
              }}
            >
              Save key
            </button>
            <p className="hint">
              Network permission must be on to send prompts. Whisper STT uses the OpenAI key even if you chat
              with another provider.
            </p>

            <h3>Permissions</h3>
            {(Object.keys(PERMISSION_CATALOG) as PermissionKey[]).map((key) => (
              <div key={key}>
                <div className="row">
                  <span>{PERMISSION_CATALOG[key].label}</span>
                  <input
                    type="checkbox"
                    checked={state.permissions[key]}
                    onChange={(e) => void togglePermission(key, e.target.checked)}
                  />
                </div>
                <p className="hint">{PERMISSION_CATALOG[key].explanation}</p>
              </div>
            ))}

            <h3>Automation</h3>
            <div className="row">
              <span>Pause screen and workspace tools</span>
              <input
                type="checkbox"
                checked={settings.automationPaused}
                disabled={stopped}
                onChange={(e) => void patch({ automationPaused: e.target.checked })}
              />
            </div>
            <p className="hint">Pausing blocks screen capture and workspace listing, reading, and writing. Emergency stop blocks them independently.</p>

            <div className="row">
              <button className="icon-btn" type="button" onClick={() => void window.nova.window("restart")}>
                Restart NOVA
              </button>
              {stopped ? (
                <button className="primary" type="button" onClick={() => void window.nova.resume()}>
                  Resume after stop
                </button>
              ) : null}
            </div>
            <p className="hint">
              v{state.version} · {state.platform}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
