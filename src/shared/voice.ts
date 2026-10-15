/** RMS of a normalized PCM window in 0..1. */
export function rmsEnergy(samples: ArrayLike<number>): number {
  if (samples.length === 0) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const v = samples[i] ?? 0;
    sum += v * v;
  }
  return Math.sqrt(sum / samples.length);
}

export function normalizeWakePhrase(phrase: string): string {
  return phrase
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * If wake-gating is on, only utterances that start with the wake phrase (or assistant name) become commands.
 * Returns the command text with the prefix stripped, or null to ignore.
 */
export function extractSpokenCommand(
  transcript: string,
  options: { requireWakePhrase: boolean; wakePhrase: string; assistantName: string }
): string | null {
  const spoken = transcript.trim();
  if (!spoken) {
    return null;
  }
  if (!options.requireWakePhrase) {
    return spoken;
  }
  const haystack = normalizeWakePhrase(spoken);
  const prefixes = [options.wakePhrase, `hey ${options.assistantName}`, options.assistantName]
    .map(normalizeWakePhrase)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    if (haystack === prefix) {
      return null;
    }
    if (haystack.startsWith(`${prefix} `)) {
      return haystack.slice(prefix.length).trim() || null;
    }
  }
  return null;
}

export function clampVoiceRate(rate: number): number {
  if (Number.isNaN(rate)) {
    return 1;
  }
  return Math.min(2, Math.max(0.5, rate));
}

export function clampVoiceVolume(volume: number): number {
  if (Number.isNaN(volume)) {
    return 1;
  }
  return Math.min(1, Math.max(0, volume));
}

export function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") {
    return "audio/webm";
  }
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "audio/webm";
}

export function whisperFilename(mime: string): string {
  if (mime.includes("mp4") || mime.includes("m4a")) {
    return "utterance.m4a";
  }
  if (mime.includes("ogg")) {
    return "utterance.ogg";
  }
  if (mime.includes("wav") || mime.includes("wave")) {
    return "utterance.wav";
  }
  return "utterance.webm";
}
