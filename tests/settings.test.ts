import { describe, expect, it } from "vitest";
import { routeMessage } from "../src/agent/orchestrator";
import { clampOpacity, mergeSettings } from "../src/shared/settings";

describe("orchestrator", () => {
  it("routes coding vs default conversation", () => {
    expect(routeMessage("refactor this typescript module").agent).toBe("coding");
    expect(routeMessage("good morning").agent).toBe("conversation");
  });
});

describe("settings", () => {
  it("clamps opacity into a usable HUD range", () => {
    expect(clampOpacity(0)).toBe(0.35);
    expect(clampOpacity(2)).toBe(1);
  });

  it("fills nested defaults", () => {
    const merged = mergeSettings({ theme: "light" });
    expect(merged.identity.assistantName).toBe("NOVA");
    expect(merged.theme).toBe("light");
    expect(merged.voice.wakePhrase).toBe("hey nova");
    expect(merged.hotkeys.toggleListen).toBe("CommandOrControl+Shift+L");
  });
});
