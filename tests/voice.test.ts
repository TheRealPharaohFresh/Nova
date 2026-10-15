import { describe, expect, it } from "vitest";
import {
  clampVoiceRate,
  extractSpokenCommand,
  normalizeWakePhrase,
  rmsEnergy,
  whisperFilename
} from "../src/shared/voice";
import { isValidAccelerator, sanitizeHotkeys } from "../src/shared/hotkeys";

describe("voice dsp", () => {
  it("computes RMS of a buffer", () => {
    expect(rmsEnergy([])).toBe(0);
    expect(rmsEnergy([0, 0, 0])).toBe(0);
    expect(rmsEnergy([1, -1, 1, -1])).toBe(1);
  });

  it("clamps speech rate", () => {
    expect(clampVoiceRate(Number.NaN)).toBe(1);
    expect(clampVoiceRate(0.1)).toBe(0.5);
    expect(clampVoiceRate(9)).toBe(2);
  });

  it("picks whisper filenames from mime types", () => {
    expect(whisperFilename("audio/webm;codecs=opus")).toBe("utterance.webm");
    expect(whisperFilename("audio/mp4")).toBe("utterance.m4a");
  });
});

describe("wake phrase", () => {
  it("normalizes punctuation", () => {
    expect(normalizeWakePhrase("Hey, NOVA!")).toBe("hey nova");
  });

  it("passes through when gating is off", () => {
    expect(
      extractSpokenCommand("what's on my calendar", {
        requireWakePhrase: false,
        wakePhrase: "hey nova",
        assistantName: "NOVA"
      })
    ).toBe("what's on my calendar");
  });

  it("ignores speech without the wake phrase when gating is on", () => {
    expect(
      extractSpokenCommand("what's on my calendar", {
        requireWakePhrase: true,
        wakePhrase: "hey nova",
        assistantName: "NOVA"
      })
    ).toBeNull();
  });

  it("strips the longest matching prefix", () => {
    expect(
      extractSpokenCommand("Hey NOVA, pause automation", {
        requireWakePhrase: true,
        wakePhrase: "hey nova",
        assistantName: "NOVA"
      })
    ).toBe("pause automation");
  });
});

describe("hotkeys", () => {
  it("accepts electron accelerators and rejects junk", () => {
    expect(isValidAccelerator("CommandOrControl+Shift+L")).toBe(true);
    expect(isValidAccelerator("ctrl+alt+delete")).toBe(false);
  });

  it("falls back to defaults for invalid accelerators", () => {
    const hotkeys = sanitizeHotkeys({ toggleListen: "not a key" });
    expect(hotkeys.toggleListen).toBe("CommandOrControl+Shift+L");
  });
});
