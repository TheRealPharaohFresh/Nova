import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listWorkspaceFiles,
  readWorkspaceFile,
  resolveWorkspacePath,
  writeWorkspaceFile
} from "../src/shared/workspace";

describe("workspace safety", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  it("accepts files inside the project root", async () => {
    const root = mkdtempSync(join(tmpdir(), "nova-workspace-"));
    dirs.push(root);
    const filePath = join(root, "src", "index.ts");
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(filePath, "console.log('ok');\n");

    expect(resolveWorkspacePath(root, "src/index.ts")).toBe(filePath);
    await expect(listWorkspaceFiles(root)).resolves.toContain("src/index.ts");
  });

  it("blocks traversal outside the project root", () => {
    const root = mkdtempSync(join(tmpdir(), "nova-workspace-"));
    dirs.push(root);

    expect(() => resolveWorkspacePath(root, "../outside.txt")).toThrow(/escapes the project root/);
  });

  it("reads an existing workspace file and returns its resolved path", async () => {
    const root = mkdtempSync(join(tmpdir(), "nova-workspace-"));
    dirs.push(root);
    mkdirSync(join(root, "docs"), { recursive: true });
    writeFileSync(join(root, "docs", "guide.md"), "Workspace guide\n");

    await expect(readWorkspaceFile(root, "docs/guide.md")).resolves.toEqual({
      path: join(realpathSync(root), "docs", "guide.md"),
      content: "Workspace guide\n"
    });
  });

  it("writes a workspace file after creating missing parent directories", async () => {
    const root = mkdtempSync(join(tmpdir(), "nova-workspace-"));
    dirs.push(root);

    await expect(writeWorkspaceFile(root, "notes/drafts/demo.txt", "Explicit write\n")).resolves.toEqual({
      path: join(realpathSync(root), "notes", "drafts", "demo.txt"),
      saved: true
    });
    await expect(readWorkspaceFile(root, "notes/drafts/demo.txt")).resolves.toMatchObject({
      content: "Explicit write\n"
    });
  });

  it("rejects outside reads and writes without exposing the requested path", async () => {
    const root = mkdtempSync(join(tmpdir(), "nova-workspace-"));
    const outside = mkdtempSync(join(tmpdir(), "nova-outside-"));
    dirs.push(root, outside);
    const outsideFile = join(outside, "private.txt");
    writeFileSync(outsideFile, "private");

    await expect(readWorkspaceFile(root, outsideFile)).rejects.toThrow(/escapes the project root/);
    await expect(writeWorkspaceFile(root, outsideFile, "changed")).rejects.toThrow(/escapes the project root/);
    await expect(readWorkspaceFile(root, "../private.txt")).rejects.toThrow(/escapes the project root/);
  });

  it("rejects reads and writes through symlinks that point outside the workspace", async () => {
    const root = mkdtempSync(join(tmpdir(), "nova-workspace-"));
    const outside = mkdtempSync(join(tmpdir(), "nova-outside-"));
    dirs.push(root, outside);
    writeFileSync(join(outside, "secret.txt"), "do not read");
    symlinkSync(outside, join(root, "external"), "dir");

    await expect(readWorkspaceFile(root, "external/secret.txt")).rejects.toThrow(/escapes the project root/);
    await expect(writeWorkspaceFile(root, "external/new.txt", "do not write")).rejects.toThrow(
      /escapes the project root/
    );
    const readError = await readWorkspaceFile(root, "external/secret.txt").then(
      () => null,
      (error: unknown) => error
    );
    expect(readError).toBeInstanceOf(Error);
    if (!(readError instanceof Error)) {
      throw new Error("Expected symlink escape to be rejected.");
    }
    expect(readError.message).not.toContain("external");
    await expect(listWorkspaceFiles(root)).resolves.not.toContain("external/secret.txt");
  });

  it("rejects a workspace root that is a symlink outside the permitted root", async () => {
    const root = mkdtempSync(join(tmpdir(), "nova-workspace-"));
    const outside = mkdtempSync(join(tmpdir(), "nova-outside-"));
    dirs.push(root, outside);
    symlinkSync(outside, join(root, "linked"), "dir");

    await expect(listWorkspaceFiles(root, "linked")).rejects.toThrow(/escapes the project root/);
  });
});
