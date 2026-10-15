import { describe, expect, it } from "vitest";
import { EmergencyStop } from "../src/main/emergencyStop";

describe("emergency stop", () => {
  it("aborts in-flight generation without model involvement", () => {
    const stop = new EmergencyStop();
    const controller = stop.beginGeneration();
    expect(controller.signal.aborted).toBe(false);
    stop.trigger("user");
    expect(stop.isStopped()).toBe(true);
    expect(controller.signal.aborted).toBe(true);
    expect(stop.isSpeaking()).toBe(false);
  });
});
