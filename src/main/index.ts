import { app, ipcMain, safeStorage, session } from "electron";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { NovaStore } from "./store.js";
import { createLogger } from "./logger.js";
import { createHudWindow, applyClickThrough } from "./windows.js";
import { createTray } from "./tray.js";
import { emergencyStop } from "./emergencyStop.js";
import { capturePrimaryScreen } from "./screen.js";
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type ChatTurn,
  type HotkeyAction,
  type MemoryCategory,
  type MicStatus
} from "../shared/types.js";
import { mergeSettings, clampOpacity } from "../shared/settings.js";
import { DEFAULT_PERMISSIONS, type PermissionState } from "../shared/permissions.js";
import type { PermissionKey } from "../shared/types.js";
import { chatComplete, personalityText } from "./chat.js";
import { transcribeWhisper } from "./voice.js";
import { registerHotkeys, unregisterHotkeys } from "./hotkeys.js";
import { formatMemoriesForPrompt, isMemoryCategory, parseRememberCommand } from "../shared/memory.js";
import { listWorkspaceFiles, readWorkspaceFile, writeWorkspaceFile } from "../shared/workspace.js";

let hud: Electron.BrowserWindow | null = null;
let tray: Electron.Tray | null = null;
let store: NovaStore;
let log: ReturnType<typeof createLogger>;
let micStatus: MicStatus = "off";
let listenOpen = false;

function dataDir(): string {
  return join(app.getPath("userData"), "nova-data");
}

function loadSettings(): AppSettings {
  return mergeSettings(store.getJson<AppSettings>("settings", DEFAULT_SETTINGS));
}

function saveSettings(next: AppSettings): void {
  store.setJson("settings", next);
}

function loadPermissions(): PermissionState {
  return { ...DEFAULT_PERMISSIONS, ...store.getJson("permissions", DEFAULT_PERMISSIONS) };
}

function activeConversationId(): string {
  const existing = store.getJson<string>("activeConversationId", "");
  if (existing) {
    return existing;
  }
  const id = randomUUID();
  store.setJson("activeConversationId", id);
  store.ensureConversation(id, "NOVA chat");
  return id;
}

function broadcast(channel: string, payload: unknown): void {
  hud?.webContents.send(channel, payload);
}

function applyWindowPrefs(settings: AppSettings): void {
  if (!hud || hud.isDestroyed()) {
    return;
  }
  hud.setAlwaysOnTop(settings.hud.alwaysOnTop);
  hud.setOpacity(clampOpacity(settings.hud.opacity));
  applyClickThrough(hud, settings.hud.clickThrough);
}

function applyLoginItem(settings: AppSettings, permissions: PermissionState): void {
  const enabled = settings.startup.launchAtLogin && permissions.startup;
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: settings.startup.startInTray || settings.startup.startMinimized
  });
}

function showHud(): void {
  if (!hud || hud.isDestroyed()) {
    return;
  }
  hud.show();
  hud.focus();
}

function hideHud(): void {
  hud?.hide();
}

function toggleHud(): void {
  if (!hud || hud.isDestroyed()) {
    return;
  }
  if (hud.isVisible()) {
    hideHud();
  } else {
    showHud();
  }
}

function openSettings(): void {
  showHud();
  broadcast("nova:navigate", { view: "settings" });
}

function setMic(status: MicStatus, permissions: PermissionState): MicStatus {
  if (status !== "off" && !permissions.microphone) {
    log.warn("mic_blocked", { reason: "microphone permission off" });
    micStatus = "off";
    listenOpen = false;
    broadcast("nova:mic", { status: micStatus, listenOpen });
    return micStatus;
  }
  if (emergencyStop.isStopped() && status !== "off") {
    micStatus = "off";
    listenOpen = false;
    broadcast("nova:mic", { status: micStatus, listenOpen });
    return micStatus;
  }
  micStatus = status;
  if (status === "off") {
    listenOpen = false;
  }
  broadcast("nova:mic", { status: micStatus, listenOpen });
  log.info("mic_status", { status: micStatus, listenOpen });
  return micStatus;
}

function requireActiveTools(): void {
  if (emergencyStop.isStopped()) {
    throw new Error("Emergency stop is active.");
  }
  if (loadSettings().automationPaused) {
    throw new Error("Automation is paused.");
  }
}

function startListening(): void {
  listenOpen = true;
  setMic("listening", loadPermissions());
}

function stopListening(): void {
  listenOpen = false;
  setMic("off", loadPermissions());
}

function decryptSecret(providerId: string): string {
  const secrets = store.getJson<Record<string, string>>("secrets", {});
  const blob = secrets[providerId];
  if (!blob || !safeStorage.isEncryptionAvailable()) {
    return "";
  }
  try {
    return safeStorage.decryptString(Buffer.from(blob, "base64"));
  } catch {
    return "";
  }
}

function applyHotkeys(settings: AppSettings): void {
  const result = registerHotkeys(settings.hotkeys, (action) => handleHotkey(action));
  if (Object.keys(result.failed).length > 0) {
    log.warn("hotkeys_failed", result.failed);
  } else {
    log.info("hotkeys_registered", result.registered);
  }
}

function handleHotkey(action: HotkeyAction): void {
  if (action === "emergencyStop") {
    triggerEmergency("hotkey");
    return;
  }
  if (action === "toggleHud") {
    toggleHud();
    return;
  }
  if (action === "toggleListen") {
    if (listenOpen || micStatus === "listening") {
      stopListening();
    } else {
      startListening();
    }
    return;
  }
  if (action === "pushToTalk") {
    showHud();
    broadcast("nova:hotkey", { action });
  }
}

function triggerEmergency(source: "user" | "tray" | "hotkey"): void {
  emergencyStop.trigger(source);
  const settings = loadSettings();
  settings.emergencyStopped = true;
  settings.automationPaused = true;
  saveSettings(settings);
  broadcast("nova:settings", settings);
  stopListening();
  log.warn("emergency_stop", { source });
  broadcast("nova:emergency", { stopped: true });
}

function installMediaPermissions(): void {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    const micOn = loadPermissions().microphone;
    if (permission === "media" || permission === "mediaKeySystem") {
      callback(micOn);
      return;
    }
    callback(false);
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    if (permission === "media") {
      return loadPermissions().microphone;
    }
    return false;
  });
}

function registerIpc(): void {
  ipcMain.handle("nova:get-state", () => {
    const settings = loadSettings();
    const conversationId = activeConversationId();
    return {
      settings,
      permissions: loadPermissions(),
      micStatus,
      listenOpen,
      emergencyStopped: emergencyStop.isStopped(),
      version: app.getVersion(),
      platform: process.platform,
      conversationId,
      messages: store.listMessages(conversationId),
      memories: store.listMemories(),
      encryptionAvailable: safeStorage.isEncryptionAvailable()
    };
  });

  ipcMain.handle("nova:update-settings", (_e, partial: Partial<AppSettings>) => {
    const current = loadSettings();
    const next = mergeSettings({
      ...current,
      ...partial,
      hud: { ...current.hud, ...partial.hud },
      startup: { ...current.startup, ...partial.startup },
      identity: { ...current.identity, ...partial.identity },
      personality: { ...current.personality, ...partial.personality },
      voice: { ...current.voice, ...partial.voice },
      hotkeys: { ...current.hotkeys, ...partial.hotkeys }
    });
    next.hud.opacity = clampOpacity(next.hud.opacity);
    saveSettings(next);
    applyWindowPrefs(next);
    applyLoginItem(next, loadPermissions());
    if (partial.hotkeys) {
      applyHotkeys(next);
    }
    log.info("settings_updated", { keys: Object.keys(partial) });
    return next;
  });

  ipcMain.handle("nova:set-permission", (_e, key: PermissionKey, enabled: boolean) => {
    const permissions = loadPermissions();
    permissions[key] = enabled;
    store.setJson("permissions", permissions);
    if (key === "startup") {
      applyLoginItem(loadSettings(), permissions);
    }
    if (key === "microphone" && !enabled) {
      stopListening();
    }
    log.info("permission_changed", { key, enabled });
    return permissions;
  });

  ipcMain.handle("nova:window", (_e, action: "minimize" | "close" | "restart" | "hide" | "show") => {
    if (action === "minimize") {
      hud?.minimize();
    } else if (action === "hide") {
      hideHud();
    } else if (action === "show") {
      showHud();
    } else if (action === "close") {
      hideHud();
    } else if (action === "restart") {
      app.relaunch();
      app.exit(0);
    }
    return true;
  });

  ipcMain.handle("nova:emergency-stop", () => {
    triggerEmergency("user");
    return true;
  });

  ipcMain.handle("nova:resume", () => {
    emergencyStop.resume();
    const settings = loadSettings();
    settings.emergencyStopped = false;
    settings.automationPaused = false;
    saveSettings(settings);
    broadcast("nova:settings", settings);
    log.info("emergency_resume", {});
    broadcast("nova:emergency", { stopped: false });
    return true;
  });

  ipcMain.handle("nova:set-secret", (_e, providerId: string, secret: string) => {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("OS secret storage is unavailable on this machine.");
    }
    const payload = safeStorage.encryptString(secret).toString("base64");
    const secrets = store.getJson<Record<string, string>>("secrets", {});
    if (secret.trim() === "") {
      delete secrets[providerId];
    } else {
      secrets[providerId] = payload;
    }
    store.setJson("secrets", secrets);
    log.info("secret_updated", { providerId, hasKey: Boolean(secret.trim()) });
    return { stored: Boolean(secret.trim()) };
  });

  ipcMain.handle("nova:has-secret", (_e, providerId: string) => {
    const secrets = store.getJson<Record<string, string>>("secrets", {});
    return { stored: Boolean(secrets[providerId]) };
  });

  ipcMain.handle("nova:start-listening", () => {
    startListening();
    return { status: micStatus, listenOpen };
  });

  ipcMain.handle("nova:stop-listening", () => {
    stopListening();
    return { status: micStatus, listenOpen };
  });

  ipcMain.handle("nova:transcribe", async (_e, input: { bytes: Uint8Array | number[]; mime: string }) => {
    const permissions = loadPermissions();
    if (!permissions.microphone) {
      throw new Error("Microphone permission is off.");
    }
    if (!permissions.network) {
      throw new Error("Network permission is off. Whisper transcription needs it.");
    }
    if (emergencyStop.isStopped()) {
      throw new Error("Emergency stop is active.");
    }
    const bytes = input.bytes instanceof Uint8Array ? input.bytes : Uint8Array.from(input.bytes);
    setMic("processing", permissions);
    const controller = emergencyStop.beginGeneration();
    try {
      const text = await transcribeWhisper({
        bytes,
        mime: input.mime,
        apiKey: decryptSecret("openai"),
        signal: controller.signal
      });
      log.info("transcribe_ok", { chars: text.length });
      return { text };
    } finally {
      emergencyStop.stopGeneration();
      setMic(listenOpen ? "listening" : "off", loadPermissions());
    }
  });

  ipcMain.handle("nova:add-memory", (_e, input: { category: string; content: string }) => {
    if (!isMemoryCategory(input.category)) {
      throw new Error("Unknown memory category.");
    }
    const content = input.content.trim();
    if (!content) {
      throw new Error("Memory cannot be empty.");
    }
    const item = {
      id: randomUUID(),
      category: input.category as MemoryCategory,
      content,
      createdAt: new Date().toISOString()
    };
    store.addMemory(item);
    log.info("memory_added", { category: item.category });
    return item;
  });

  ipcMain.handle("nova:delete-memory", (_e, id: string) => {
    store.deleteMemory(id);
    log.info("memory_deleted", {});
    return store.listMemories();
  });

  ipcMain.handle("nova:list-memories", () => store.listMemories());

  ipcMain.handle(
    "nova:chat",
    async (_e, input: { conversationId: string; content: string; providerId: string; model: string }) => {
      const permissions = loadPermissions();
      if (!permissions.network) {
        throw new Error("Network permission is off. Enable it in Settings to use AI providers.");
      }
      if (emergencyStop.isStopped()) {
        throw new Error("Emergency stop is active. Resume before chatting.");
      }
      const content = input.content.trim();
      if (!content) {
        throw new Error("Empty message.");
      }
      const conversationId = input.conversationId || activeConversationId();
      store.setJson("activeConversationId", conversationId);
      const remember = parseRememberCommand(content);
      if (remember) {
        store.addMemory({
          id: randomUUID(),
          category: "instructions",
          content: remember,
          createdAt: new Date().toISOString()
        });
      }
      const userTurn: ChatTurn = {
        id: randomUUID(),
        role: "user",
        content,
        createdAt: new Date().toISOString()
      };
      store.ensureConversation(conversationId, content.slice(0, 48));
      store.insertMessage(userTurn, conversationId);

      const controller = emergencyStop.beginGeneration();
      try {
        const settings = loadSettings();
        const history = store.listMessages(conversationId, 40).map((turn) => ({
          role: turn.role,
          content: turn.content
        }));
        const text = await chatComplete({
          conversationId,
          content,
          history,
          memoryBlock: formatMemoriesForPrompt(store.listMemories()),
          providerId: input.providerId,
          model: input.model,
          apiKey: decryptSecret(input.providerId),
          signal: controller.signal,
          assistantName: settings.identity.assistantName,
          userName: settings.identity.userName,
          personality: personalityText(settings.personality.preset, settings.personality.customInstructions),
          onToken: (chunk) => broadcast("nova:chat-token", { conversationId, chunk })
        });
        store.insertMessage(
          {
            id: randomUUID(),
            role: "assistant",
            content: text,
            createdAt: new Date().toISOString()
          },
          conversationId
        );
        return { text, memories: store.listMemories() };
      } finally {
        emergencyStop.stopGeneration();
      }
    }
  );

  ipcMain.handle("nova:capture-screen", async () => {
    const permissions = loadPermissions();
    if (!permissions.screen) {
      throw new Error("Screen permission is off. Enable it in Settings to capture a screenshot.");
    }
    requireActiveTools();

    const result = await capturePrimaryScreen();
    log.info("screen_capture_ok", { sourceId: result.sourceId, width: result.width, height: result.height });
    return result;
  });

  ipcMain.handle("nova:list-workspace-files", async (_e, input?: { root?: string }) => {
    const permissions = loadPermissions();
    if (!permissions.files) {
      throw new Error("Files permission is off. Enable it before using workspace tools.");
    }
    requireActiveTools();
    return listWorkspaceFiles(process.cwd(), input?.root ?? ".");
  });

  ipcMain.handle("nova:read-workspace-file", async (_e, input: { path: string }) => {
    const permissions = loadPermissions();
    if (!permissions.files) {
      throw new Error("Files permission is off. Enable it before reading workspace files.");
    }
    requireActiveTools();
    return readWorkspaceFile(process.cwd(), input.path);
  });

  ipcMain.handle("nova:write-workspace-file", async (_e, input: { path: string; content: string }) => {
    const permissions = loadPermissions();
    if (!permissions.files) {
      throw new Error("Files permission is off. Enable it before writing workspace files.");
    }
    requireActiveTools();
    return writeWorkspaceFile(process.cwd(), input.path, input.content);
  });

  ipcMain.handle("nova:stop-generation", () => {
    emergencyStop.stopGeneration();
    return true;
  });
}

async function loadRenderer(win: Electron.BrowserWindow): Promise<void> {
  if (process.env.ELECTRON_RENDERER_URL) {
    await win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  store = new NovaStore(join(dataDir(), "nova.sqlite"));
  log = createLogger(join(dataDir(), "logs"), store);
  log.info("app_ready", { version: app.getVersion() });

  const settings = loadSettings();
  const permissions = loadPermissions();
  installMediaPermissions();

  hud = createHudWindow(settings);
  hud.on("ready-to-show", () => {
    if (settings.startup.startInTray && !settings.startup.openHud) {
      return;
    }
    if (settings.startup.startMinimized) {
      hud?.minimize();
      return;
    }
    showHud();
  });

  registerIpc();
  tray = createTray({
    show: showHud,
    hide: hideHud,
    startListening,
    stopListening,
    pauseAutomation: () => {
      const s = loadSettings();
      s.automationPaused = true;
      saveSettings(s);
      broadcast("nova:settings", s);
      log.info("automation_paused", {});
    },
    disableClickThrough: () => {
      const s = loadSettings();
      s.hud.clickThrough = false;
      saveSettings(s);
      applyWindowPrefs(s);
      broadcast("nova:settings", s);
    },
    openSettings,
    emergencyStop: () => triggerEmergency("tray"),
    quit: () => {
      tray?.destroy();
      app.quit();
    }
  });

  applyLoginItem(settings, permissions);
  applyHotkeys(settings);
  await loadRenderer(hud);

  if (settings.startup.startListening) {
    startListening();
  }
});

app.on("window-all-closed", () => {
  // Stay in tray on all platforms.
});

app.on("will-quit", () => {
  unregisterHotkeys();
});

app.on("before-quit", () => {
  store?.close();
});
