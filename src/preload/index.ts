import { contextBridge, ipcRenderer } from "electron";
import type { AppSettings, MicStatus, PermissionKey } from "../shared/types.js";

const api = {
  getState: () => ipcRenderer.invoke("nova:get-state"),
  updateSettings: (partial: Partial<AppSettings>) => ipcRenderer.invoke("nova:update-settings", partial),
  setPermission: (key: PermissionKey, enabled: boolean) =>
    ipcRenderer.invoke("nova:set-permission", key, enabled),
  window: (action: "minimize" | "close" | "restart" | "hide" | "show") =>
    ipcRenderer.invoke("nova:window", action),
  emergencyStop: () => ipcRenderer.invoke("nova:emergency-stop"),
  resume: () => ipcRenderer.invoke("nova:resume"),
  setSecret: (providerId: string, secret: string) => ipcRenderer.invoke("nova:set-secret", providerId, secret),
  hasSecret: (providerId: string) => ipcRenderer.invoke("nova:has-secret", providerId),
  startListening: () => ipcRenderer.invoke("nova:start-listening"),
  stopListening: () => ipcRenderer.invoke("nova:stop-listening"),
  transcribe: (input: { bytes: number[]; mime: string }) => ipcRenderer.invoke("nova:transcribe", input),
  captureScreen: () => ipcRenderer.invoke("nova:capture-screen"),
  readWorkspaceFile: (path: string) => ipcRenderer.invoke("nova:read-workspace-file", { path }),
  writeWorkspaceFile: (path: string, content: string) =>
    ipcRenderer.invoke("nova:write-workspace-file", { path, content }),
  listWorkspaceFiles: (root?: string) => ipcRenderer.invoke("nova:list-workspace-files", { root }),
  addMemory: (input: { category: string; content: string }) => ipcRenderer.invoke("nova:add-memory", input),
  deleteMemory: (id: string) => ipcRenderer.invoke("nova:delete-memory", id),
  listMemories: () => ipcRenderer.invoke("nova:list-memories"),
  chat: (input: { conversationId: string; content: string; providerId: string; model: string }) =>
    ipcRenderer.invoke("nova:chat", input),
  stopGeneration: () => ipcRenderer.invoke("nova:stop-generation"),
  on: (channel: string, fn: (payload: unknown) => void) => {
    const allowed = new Set([
      "nova:mic",
      "nova:navigate",
      "nova:emergency",
      "nova:settings",
      "nova:chat-token",
      "nova:hotkey"
    ]);
    if (!allowed.has(channel)) {
      return () => undefined;
    }
    const listener = (_event: unknown, payload: unknown) => fn(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
};

export type NovaApi = typeof api;

contextBridge.exposeInMainWorld("nova", api);

declare global {
  interface Window {
    nova: NovaApi;
    __MIC__?: MicStatus;
  }
}
