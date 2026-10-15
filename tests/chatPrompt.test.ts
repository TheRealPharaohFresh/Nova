import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "../src/main/chat";

describe("system prompt", () => {
  it("includes chosen names and forbids safety override", () => {
    const prompt = buildSystemPrompt({
      assistantName: "NOVA",
      userName: "Boss",
      personality: "Tone: concise.",
      memoryBlock: ""
    });
    expect(prompt).toContain("NOVA");
    expect(prompt).toContain("Boss");
    expect(prompt.toLowerCase()).toContain("never overrides safety");
  });
});
