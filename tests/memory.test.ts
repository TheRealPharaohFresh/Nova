import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { formatMemoriesForPrompt, parseRememberCommand } from "../src/shared/memory";
import { NovaStore } from "../src/main/store";
import { buildSystemPrompt } from "../src/main/chat";

describe("remember parser", () => {
  it("extracts facts from remember commands", () => {
    expect(parseRememberCommand("remember that I use vim")).toBe("I use vim");
    expect(parseRememberCommand("Please remember: ship on Fridays")).toBe("ship on Fridays");
    expect(parseRememberCommand("what is memory")).toBeNull();
  });
});

describe("memory persistence", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stores memories and chat turns", () => {
    const dir = mkdtempSync(join(tmpdir(), "nova-"));
    dirs.push(dir);
    const store = new NovaStore(join(dir, "nova.sqlite"));
    store.addMemory({
      id: "m1",
      category: "coding",
      content: "Prefers TypeScript",
      createdAt: new Date().toISOString()
    });
    store.ensureConversation("c1", "hello");
    store.insertMessage(
      { id: "t1", role: "user", content: "hello", createdAt: new Date().toISOString() },
      "c1"
    );
    expect(store.listMemories()[0]?.content).toBe("Prefers TypeScript");
    expect(store.listMessages("c1")).toHaveLength(1);
    store.close();
  });
});

describe("prompt memories", () => {
  it("injects memories into the system prompt", () => {
    const block = formatMemoriesForPrompt([
      {
        id: "1",
        category: "preferences",
        content: "Short answers",
        createdAt: "2026-01-01T00:00:00.000Z"
      }
    ]);
    const prompt = buildSystemPrompt({
      assistantName: "NOVA",
      userName: "Donald",
      personality: "Tone: concise.",
      memoryBlock: block
    });
    expect(prompt).toContain("Short answers");
    expect(prompt).toContain("Donald");
  });
});
