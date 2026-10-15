import type { AppSettings } from "./types.js";
import { DEFAULT_SETTINGS } from "./types.js";
import { sanitizeHotkeys } from "./hotkeys.js";
import { clampVoiceRate, clampVoiceVolume } from "./voice.js";

export function mergeSettings(partial: Partial<AppSettings> | null | undefined): AppSettings {
  const src = partial ?? {};
  const voice = { ...DEFAULT_SETTINGS.voice, ...src.voice };
  voice.rate = clampVoiceRate(voice.rate);
  voice.volume = clampVoiceVolume(voice.volume);
  if (!voice.wakePhrase.trim()) {
    voice.wakePhrase = DEFAULT_SETTINGS.voice.wakePhrase;
  }
  return {
    ...DEFAULT_SETTINGS,
    ...src,
    hud: { ...DEFAULT_SETTINGS.hud, ...src.hud },
    startup: { ...DEFAULT_SETTINGS.startup, ...src.startup },
    identity: { ...DEFAULT_SETTINGS.identity, ...src.identity },
    personality: { ...DEFAULT_SETTINGS.personality, ...src.personality },
    voice,
    hotkeys: sanitizeHotkeys({ ...DEFAULT_SETTINGS.hotkeys, ...src.hotkeys })
  };
}

export function clampOpacity(value: number): number {
  if (Number.isNaN(value)) {
    return DEFAULT_SETTINGS.hud.opacity;
  }
  return Math.min(1, Math.max(0.35, value));
}
