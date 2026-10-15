import type { HotkeyAction, HotkeySettings } from "./types.js";

export const DEFAULT_HOTKEYS: HotkeySettings = {
  toggleHud: "CommandOrControl+Shift+H",
  toggleListen: "CommandOrControl+Shift+L",
  pushToTalk: "CommandOrControl+Shift+Space",
  emergencyStop: "CommandOrControl+Shift+F12"
};

const ACCEL =
  /^(CommandOrControl|Command|Control|Ctrl|Alt|Option|AltGr|Shift|Super|Meta)(\+(CommandOrControl|Command|Control|Ctrl|Alt|Option|AltGr|Shift|Super|Meta))*\+([A-Za-z0-9]|F1[0-2]|F[1-9]|Space|Tab|Plus|Minus|\.)$/;

export function isValidAccelerator(value: string): boolean {
  return ACCEL.test(value.trim());
}

export function sanitizeHotkeys(partial: Partial<HotkeySettings> | undefined): HotkeySettings {
  const next: HotkeySettings = { ...DEFAULT_HOTKEYS, ...partial };
  (Object.keys(next) as HotkeyAction[]).forEach((key) => {
    if (!isValidAccelerator(next[key])) {
      next[key] = DEFAULT_HOTKEYS[key];
    }
  });
  return next;
}

export const HOTKEY_LABELS: Record<HotkeyAction, string> = {
  toggleHud: "Show / hide HUD",
  toggleListen: "Start / stop listening",
  pushToTalk: "Push-to-talk (one utterance)",
  emergencyStop: "Emergency stop"
};
