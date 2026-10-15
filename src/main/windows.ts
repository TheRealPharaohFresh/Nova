import { BrowserWindow, shell } from "electron";
import { join } from "node:path";
import type { AppSettings } from "../shared/types.js";

export function createHudWindow(settings: AppSettings): BrowserWindow {
  const win = new BrowserWindow({
    width: 420,
    height: 640,
    minWidth: 320,
    minHeight: 280,
    show: false,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: settings.hud.alwaysOnTop,
    skipTaskbar: false,
    hasShadow: true,
    vibrancy: "under-window",
    visualEffectState: "active",
    title: "NOVA",
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.setOpacity(settings.hud.opacity);
  applyClickThrough(win, settings.hud.clickThrough);

  win.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);
    return { action: "deny" };
  });

  return win;
}

export function applyClickThrough(win: BrowserWindow, enabled: boolean): void {
  if (enabled) {
    win.setIgnoreMouseEvents(true, { forward: true });
  } else {
    win.setIgnoreMouseEvents(false);
  }
}
