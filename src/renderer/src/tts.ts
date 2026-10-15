export interface SpeakOptions {
  mute: boolean;
  rate: number;
  volume: number;
  voiceURI: string;
}

export function listSpeechVoices(): SpeechSynthesisVoice[] {
  if (typeof speechSynthesis === "undefined") {
    return [];
  }
  return speechSynthesis.getVoices();
}

export function interruptSpeech(): void {
  if (typeof speechSynthesis === "undefined") {
    return;
  }
  speechSynthesis.cancel();
}

export function speakText(text: string, options: SpeakOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    if (options.mute || !text.trim()) {
      resolve();
      return;
    }
    if (typeof speechSynthesis === "undefined") {
      reject(new Error("Text-to-speech is not available in this runtime."));
      return;
    }
    interruptSpeech();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate;
    utterance.volume = options.volume;
    const voices = listSpeechVoices();
    const chosen = voices.find((v) => v.voiceURI === options.voiceURI);
    if (chosen) {
      utterance.voice = chosen;
    }
    utterance.onend = () => resolve();
    utterance.onerror = (event) => {
      if (event.error === "canceled" || event.error === "interrupted") {
        resolve();
        return;
      }
      reject(new Error(`TTS error: ${event.error}`));
    };
    speechSynthesis.speak(utterance);
  });
}
