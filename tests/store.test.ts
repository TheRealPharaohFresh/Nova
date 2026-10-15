import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, afterEach } from "vitest";
import { NovaStore } from "../src/main/store";

describe("NovaStore", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("persists json and never writes raw secrets into audit text", () => {
    const dir = mkdtempSync(join(tmpdir(), "nova-"));
    dirs.push(dir);
    const store = new NovaStore(join(dir, "nova.sqlite"));
    store.setJson("settings", { theme: "dark" });
    expect(store.getJson("settings", { theme: "light" })).toEqual({ theme: "dark" });
    store.audit("info", "saved key sk-abcdefghijklmnopqrstuvwxyz", { apiKey: "sk-abcdefghijklmnopqrstuvwxyz" });
    const rows = store.recentAudit(1);
    expect(rows[0].event).toContain("[REDACTED]");
    expect(rows[0].meta).toContain("[REDACTED]");
    expect(rows[0].meta).not.toContain("sk-abcdef");
    store.close();
  });
});
