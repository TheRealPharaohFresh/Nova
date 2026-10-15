import { globalShortcut } from "electron";
import type { HotkeyAction, HotkeySettings } from "../shared/types.js";

export function registerHotkeys(
  hotkeys: HotkeySettings,
  dispatch: (action: HotkeyAction) => void
): { registered: Partial<Record<HotkeyAction, string>>; failed: Partial<Record<HotkeyAction, string>> } {
  globalShortcut.unregisterAll();
  const registered: Partial<Record<HotkeyAction, string>> = {};
  const failed: Partial<Record<HotkeyAction, string>> = {};
  (Object.keys(hotkeys) as HotkeyAction[]).forEach((action) => {
    const accelerator = hotkeys[action];
    const ok = globalShortcut.register(accelerator, () => dispatch(action));
    if (ok) {
      registered[action] = accelerator;
    } else {
      failed[action] = accelerator;
    }
  });
  return { registered, failed };
}

export function unregisterHotkeys(): void {
  globalShortcut.unregisterAll();
}
