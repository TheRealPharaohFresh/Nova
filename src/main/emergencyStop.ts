import { EventEmitter } from "node:events";

export type StopReason = "user" | "tray" | "hotkey" | "error";

export class EmergencyStop extends EventEmitter {
  private stopped = false;
  private speaking = false;
  private generation: AbortController | null = null;

  isStopped(): boolean {
    return this.stopped;
  }

  isSpeaking(): boolean {
    return this.speaking;
  }

  setSpeaking(value: boolean): void {
    this.speaking = value;
    if (this.stopped) {
      this.speaking = false;
    }
  }

  beginGeneration(): AbortController {
    this.generation?.abort();
    this.generation = new AbortController();
    if (this.stopped) {
      this.generation.abort();
    }
    return this.generation;
  }

  stopGeneration(): void {
    this.generation?.abort();
    this.generation = null;
  }

  trigger(reason: StopReason): void {
    this.stopped = true;
    this.speaking = false;
    this.stopGeneration();
    this.emit("stop", reason);
  }

  resume(): void {
    this.stopped = false;
    this.emit("resume");
  }
}

export const emergencyStop = new EmergencyStop();
