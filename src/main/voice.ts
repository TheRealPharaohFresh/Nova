import { whisperFilename } from "../shared/voice.js";

export class TranscribeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranscribeError";
  }
}

export async function transcribeWhisper(args: {
  bytes: Uint8Array;
  mime: string;
  apiKey: string;
  signal: AbortSignal;
}): Promise<string> {
  if (!args.apiKey.trim()) {
    throw new TranscribeError("Speech-to-text needs an OpenAI API key (Whisper) in Settings → AI.");
  }
  if (args.bytes.byteLength < 256) {
    throw new TranscribeError("Recording was too short to transcribe.");
  }

  const file = new File([Buffer.from(args.bytes)], whisperFilename(args.mime), {
    type: args.mime.split(";")[0] || "audio/webm"
  });
  const form = new FormData();
  form.append("file", file);
  form.append("model", "whisper-1");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${args.apiKey}` },
    body: form,
    signal: args.signal
  });

  if (!response.ok) {
    throw new TranscribeError(`Whisper error (${response.status}). Check the OpenAI key and network permission.`);
  }
  const json = (await response.json()) as { text?: string };
  return (json.text ?? "").trim();
}
