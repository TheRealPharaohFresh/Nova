import { desktopCapturer } from "electron";

export interface CaptureScreenResult {
  sourceId?: string;
  width: number;
  height: number;
  dataUrl: string;
}

export async function capturePrimaryScreen(): Promise<CaptureScreenResult> {
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width: 1920, height: 1080 }
  });

  const source = sources.find((item) => item.name === "Screen 1") ?? sources[0];
  if (!source) {
    throw new Error("No display source is available for capture.");
  }

  const thumbnail = source.thumbnail;
  const { width, height } = thumbnail.getSize();

  return {
    sourceId: source.id,
    width,
    height,
    dataUrl: thumbnail.toDataURL()
  };
}
