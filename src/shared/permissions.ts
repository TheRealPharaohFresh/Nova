import type { PermissionKey } from "./types.js";

export type PermissionState = Record<PermissionKey, boolean>;

export const DEFAULT_PERMISSIONS: PermissionState = {
  microphone: false,
  screen: false,
  clipboard: false,
  browser: false,
  files: false,
  terminal: false,
  network: false,
  startup: false,
  notifications: false
};

export function isPermissionEnabled(
  state: PermissionState,
  key: PermissionKey
): boolean {
  return state[key] === true;
}

export function requirePermission(
  state: PermissionState,
  key: PermissionKey
): void {
  if (!isPermissionEnabled(state, key)) {
    throw new PermissionDeniedError(key);
  }
}

export class PermissionDeniedError extends Error {
  readonly permission: PermissionKey;

  constructor(permission: PermissionKey) {
    super(`Permission denied: ${permission}`);
    this.name = "PermissionDeniedError";
    this.permission = permission;
  }
}
