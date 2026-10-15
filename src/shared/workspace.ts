import { readdirSync } from "node:fs";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

function isWithinRoot(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === "" || (pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${sep}`) && !isAbsolute(pathFromRoot));
}

function assertWithinRoot(root: string, candidate: string): void {
  if (!isWithinRoot(root, candidate)) {
    throw new Error("Workspace path escapes the project root.");
  }
}

export function resolveWorkspacePath(workspaceRoot: string, requestedPath: string): string {
  const root = resolve(workspaceRoot);
  const candidate = resolve(root, requestedPath);
  assertWithinRoot(root, candidate);
  return candidate;
}

async function resolveExistingWorkspacePath(workspaceRoot: string, requestedPath: string): Promise<string> {
  const root = await realpath(resolve(workspaceRoot));
  const candidate = resolveWorkspacePath(root, requestedPath);
  const actualPath = await realpath(candidate);
  assertWithinRoot(root, actualPath);
  return actualPath;
}

async function resolveWorkspaceWritePath(workspaceRoot: string, requestedPath: string): Promise<string> {
  const root = await realpath(resolve(workspaceRoot));
  const candidate = resolveWorkspacePath(root, requestedPath);
  let existingParent = dirname(candidate);

  while (true) {
    try {
      const actualParent = await realpath(existingParent);
      assertWithinRoot(root, actualParent);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      const nextParent = dirname(existingParent);
      if (nextParent === existingParent) {
        throw error;
      }
      existingParent = nextParent;
    }
  }

  await mkdir(dirname(candidate), { recursive: true });
  const actualParent = await realpath(dirname(candidate));
  assertWithinRoot(root, actualParent);

  try {
    const actualTarget = await realpath(candidate);
    assertWithinRoot(root, actualTarget);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
  return candidate;
}

export async function readWorkspaceFile(
  workspaceRoot: string,
  requestedPath: string
): Promise<{ path: string; content: string }> {
  const safePath = await resolveExistingWorkspacePath(workspaceRoot, requestedPath);
  const content = await readFile(safePath, "utf8");
  return { path: safePath, content };
}

export async function writeWorkspaceFile(
  workspaceRoot: string,
  requestedPath: string,
  content: string
): Promise<{ path: string; saved: true }> {
  const safePath = await resolveWorkspaceWritePath(workspaceRoot, requestedPath);
  await writeFile(safePath, content, "utf8");
  return { path: safePath, saved: true };
}

export async function listWorkspaceFiles(workspaceRoot: string, requestedRoot = "."): Promise<string[]> {
  const workspace = await realpath(resolve(workspaceRoot));
  const root = await realpath(resolveWorkspacePath(workspace, requestedRoot));
  assertWithinRoot(workspace, root);
  const files: string[] = [];

  function walk(current: string): void {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = resolve(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist" || entry.name === "out") {
          continue;
        }
        walk(fullPath);
        continue;
      }
      if (entry.isFile()) {
        files.push(relative(root, fullPath).split("\\").join("/"));
      }
    }
  }

  walk(root);
  return files;
}
