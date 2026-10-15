import { describe, expect, it } from "vitest";
import { redactMeta, redactText } from "../src/shared/redact";

describe("redactText", () => {
  it("redacts OpenAI-style keys", () => {
    expect(redactText("using sk-abcdefghijklmnopqrstuvwxyz")).toContain("[REDACTED]");
    expect(redactText("using sk-abcdefghijklmnopqrstuvwxyz")).not.toContain("sk-abcdef");
  });

  it("redacts bearer tokens", () => {
    expect(redactText("Authorization: Bearer abc.def.ghi")).toContain("[REDACTED]");
  });
});

describe("redactMeta", () => {
  it("redacts apiKey fields regardless of surrounding text", () => {
    const out = redactMeta({ apiKey: "sk-live-super-secret-value", model: "gpt-4o-mini" });
    expect(out.apiKey).toBe("[REDACTED]");
    expect(out.model).toBe("gpt-4o-mini");
  });
});
