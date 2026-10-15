interface CaptureSummary {
  width: number;
  height: number;
}

interface ReadResult {
  path: string;
  content: string;
}

interface WriteResult {
  path: string;
  saved: boolean;
}

export interface PhaseNineTenExampleInput {
  readPath: string;
  writePath: string;
  replacementContent: string;
}

export async function runPhaseNineTenExample(input: PhaseNineTenExampleInput) {
  const capture = (await window.nova.captureScreen()) as CaptureSummary;
  const files = (await window.nova.listWorkspaceFiles()) as string[];
  if (!files.includes(input.readPath)) {
    throw new Error("Choose a readPath from the workspace file list.");
  }

  const read = (await window.nova.readWorkspaceFile(input.readPath)) as ReadResult;
  const write = (await window.nova.writeWorkspaceFile(
    input.writePath,
    input.replacementContent
  )) as WriteResult;

  return {
    capture: { width: capture.width, height: capture.height },
    listedFiles: files.length,
    readPath: read.path,
    readCharacters: read.content.length,
    writePath: write.path,
    saved: write.saved
  };
}
