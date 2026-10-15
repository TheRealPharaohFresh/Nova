import { pickRecorderMime, rmsEnergy } from "../../shared/voice";

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function speechRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function webSpeechAvailable(): boolean {
  return speechRecognitionCtor() !== null;
}

export interface CaptureHandlers {
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
  onLevel?: (rms: number) => void;
}

export class MicCapture {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private recognition: SpeechRecognitionLike | null = null;
  private audioContext: AudioContext | null = null;
  private raf = 0;
  private chunks: Blob[] = [];
  private speaking = false;
  private speechMs = 0;
  private silenceMs = 0;
  private startedAt = 0;
  private mode: "off" | "vad" | "hold" = "off";
  private handlers: CaptureHandlers | null = null;
  private threshold = 0.04;
  private transcribing = false;

  async startVad(handlers: CaptureHandlers, threshold: number): Promise<void> {
    await this.stop();
    this.handlers = handlers;
    this.threshold = threshold;
    this.mode = "vad";
    const Ctor = speechRecognitionCtor();
    if (Ctor) {
      this.startWebSpeech(Ctor, true);
      return;
    }
    await this.startMedia(handlers);
  }

  async startHold(handlers: CaptureHandlers): Promise<void> {
    await this.stop();
    this.handlers = handlers;
    const Ctor = speechRecognitionCtor();
    if (Ctor) {
      this.mode = "hold";
      this.startWebSpeech(Ctor, false);
      return;
    }
    this.mode = "hold";
    await this.startMedia(handlers);
    this.beginRecorder();
  }

  async releaseHold(): Promise<void> {
    if (this.mode !== "hold") {
      return;
    }
    if (this.recognition) {
      this.recognition.stop();
      return;
    }
    await this.endRecorder();
    this.stopMediaOnly();
    this.mode = "off";
  }

  async stop(): Promise<void> {
    this.mode = "off";
    if (this.recognition) {
      this.recognition.onend = null;
      this.recognition.onerror = null;
      this.recognition.onresult = null;
      try {
        this.recognition.abort();
      } catch {
        // already stopped
      }
      this.recognition = null;
    }
    if (this.recorder && this.recorder.state !== "inactive") {
      await this.endRecorder();
    }
    this.stopMediaOnly();
  }

  private startWebSpeech(Ctor: SpeechRecognitionCtor, continuous: boolean): void {
    const rec = new Ctor();
    rec.continuous = continuous;
    rec.interimResults = false;
    rec.lang = navigator.language || "en-US";
    rec.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      if (result?.isFinal) {
        const text = result[0]?.transcript?.trim() ?? "";
        if (text) {
          this.handlers?.onTranscript(text);
        }
      }
    };
    rec.onerror = (event) => {
      if (event.error === "aborted" || event.error === "no-speech") {
        return;
      }
      if (event.error === "network" || event.error === "service-not-allowed") {
        this.recognition = null;
        if (this.handlers) {
          void this.startMedia(this.handlers).then(() => {
            if (this.mode === "hold") {
              this.beginRecorder();
            }
          });
        }
        return;
      }
      this.handlers?.onError(`Speech recognition: ${event.error}`);
    };
    rec.onend = () => {
      if (this.mode === "vad" && this.recognition === rec) {
        try {
          rec.start();
        } catch {
          // restart can throw if we just aborted
        }
      }
    };
    this.recognition = rec;
    rec.start();
  }

  private async startMedia(handlers: CaptureHandlers): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true }
    });
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const data = new Float32Array(analyser.fftSize);

    const tick = (): void => {
      analyser.getFloatTimeDomainData(data);
      const rms = rmsEnergy(data);
      handlers.onLevel?.(rms);
      if (this.mode === "vad") {
        this.tickVad(rms);
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private tickVad(rms: number): void {
    const now = performance.now();
    if (now - this.startedAt > 20000 && this.speaking) {
      void this.endRecorder();
      return;
    }
    if (!this.speaking) {
      if (rms > this.threshold) {
        this.speechMs += 16;
        if (this.speechMs > 220) {
          this.beginRecorder();
        }
      } else {
        this.speechMs = 0;
      }
      return;
    }
    if (rms < this.threshold) {
      this.silenceMs += 16;
      if (this.silenceMs > 850) {
        void this.endRecorder();
      }
    } else {
      this.silenceMs = 0;
    }
  }

  private beginRecorder(): void {
    if (!this.stream || this.recorder) {
      return;
    }
    const mime = pickRecorderMime();
    this.chunks = [];
    this.speaking = true;
    this.silenceMs = 0;
    this.startedAt = performance.now();
    this.recorder = new MediaRecorder(this.stream, { mimeType: mime });
    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };
    this.recorder.start();
  }

  private endRecorder(): Promise<void> {
    return new Promise((resolve) => {
      const recorder = this.recorder;
      if (!recorder) {
        this.speaking = false;
        resolve();
        return;
      }
      recorder.onstop = () => {
        const mime = recorder.mimeType || pickRecorderMime();
        const blob = new Blob(this.chunks, { type: mime });
        this.recorder = null;
        this.chunks = [];
        this.speaking = false;
        this.speechMs = 0;
        this.silenceMs = 0;
        if (blob.size > 512 && !this.transcribing) {
          this.transcribing = true;
          void this.sendBlob(blob, mime).finally(() => {
            this.transcribing = false;
          });
        }
        resolve();
      };
      if (recorder.state === "recording") {
        recorder.stop();
      } else {
        this.recorder = null;
        this.speaking = false;
        resolve();
      }
    });
  }

  private async sendBlob(blob: Blob, mime: string): Promise<void> {
    try {
      const buffer = new Uint8Array(await blob.arrayBuffer());
      const result = (await window.nova.transcribe({
        bytes: Array.from(buffer),
        mime
      })) as { text: string };
      if (result.text) {
        this.handlers?.onTranscript(result.text);
      }
    } catch (err) {
      this.handlers?.onError(err instanceof Error ? err.message : "Transcription failed");
    }
  }

  private stopMediaOnly(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.audioContext?.close().catch(() => undefined);
    this.audioContext = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.recorder = null;
    this.speaking = false;
  }
}
