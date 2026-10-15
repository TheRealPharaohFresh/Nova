import type { AiProviderId } from "../shared/types.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompleteOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface AIProvider {
  id: AiProviderId;
  label: string;
  complete(
    messages: ChatMessage[],
    options: CompleteOptions,
    onToken?: (chunk: string) => void
  ): Promise<string>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(id: AiProviderId) {
    super(`AI provider "${id}" is not configured. Add a key in Settings.`);
    this.name = "ProviderNotConfiguredError";
  }
}

export class UnavailableProviderError extends Error {
  constructor(id: AiProviderId) {
    super(`AI provider "${id}" is unavailable in this build.`);
    this.name = "UnavailableProviderError";
  }
}
