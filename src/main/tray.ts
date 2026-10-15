import { nativeImage, Tray, Menu, app } from "electron";

export interface TrayHandlers {
  show: () => void;
  hide: () => void;
  startListening: () => void;
  stopListening: () => void;
  pauseAutomation: () => void;
  disableClickThrough: () => void;
  openSettings: () => void;
  emergencyStop: () => void;
  quit: () => void;
}

export function createTray(handlers: TrayHandlers): Tray {
  const icon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYGD4DwABBAEAfbFQiwAAAABJRU5ErkJggg=="
  );
  const tray = new Tray(icon);
  if (process.platform === "darwin") {
    tray.setTitle("NOVA");
  }
  tray.setToolTip("NOVA");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Show NOVA", click: handlers.show },
      { label: "Hide NOVA", click: handlers.hide },
      { type: "separator" },
      { label: "Start listening", click: handlers.startListening },
      { label: "Stop listening", click: handlers.stopListening },
      { label: "Pause automation", click: handlers.pauseAutomation },
      { label: "Disable click-through", click: handlers.disableClickThrough },
      { type: "separator" },
      { label: "Open settings", click: handlers.openSettings },
      { label: "Emergency stop", click: handlers.emergencyStop },
      { type: "separator" },
      { label: "Quit NOVA", click: handlers.quit }
    ])
  );
  tray.on("click", () => handlers.show());
  void app;
  return tray;
}
