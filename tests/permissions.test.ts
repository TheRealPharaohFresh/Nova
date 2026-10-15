import { describe, expect, it } from "vitest";
import { DEFAULT_PERMISSIONS, requirePermission, PermissionDeniedError } from "../src/shared/permissions";

describe("permissions", () => {
  it("denies by default", () => {
    expect(() => requirePermission(DEFAULT_PERMISSIONS, "microphone")).toThrow(PermissionDeniedError);
  });

  it("allows when enabled", () => {
    const state = { ...DEFAULT_PERMISSIONS, terminal: true };
    expect(() => requirePermission(state, "terminal")).not.toThrow();
  });
});
