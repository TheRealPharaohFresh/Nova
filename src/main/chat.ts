import type { AiProviderId } from "../shared/types.js";
import { ProviderNotConfiguredError } from "../agent/provider.js";

export interface ChatHistoryTurn {
  role: "user" | "assistant";
  content: string;
}

interface ChatArgs {
  conversationId: string;
  content: string;
  history: ChatHistoryTurn[];
  memoryBlock: string;
  providerId: string;
  model: string;
  apiKey: string;
  signal: AbortSignal;
  onToken: (chunk: string) => void;
  assistantName: string;
  userName: string;
  personality: string;
}

export function buildSystemPrompt(
  args: Pick<ChatArgs, "assistantName" | "userName" | "personality" | "memoryBlock">
): string {
  return [
    `You are ${args.assistantName}, a persistent desktop AI partner.`,
    `Address the user as ${args.userName} only when it feels natural — do not repeat the name every sentence.`,
    args.personality,
    args.memoryBlock,
    "Be concise. Never claim to have executed tools you did not run.",
    "Never help attack systems the user is not authorized to test.",
    "Personality never overrides safety, permissions, or emergency stop."
  ]
    .filter((part) => part && part.trim())
    .join(" ");
}

function historyMessages(args: ChatArgs): ChatHistoryTurn[] {
  const prior = args.history.filter((turn) => turn.content.trim());
  const last = prior[prior.length - 1];
  if (last?.role === "user" && last.content === args.content) {
    return prior;
  }
  return [...prior, { role: "user", content: args.content }];
}

function personalityText(preset: string, custom: string): string {
  switch (preset) {
    case "professional":
      return "Tone: technical and concise.";
    case "researcher":
      return "Tone: curious, analytical, investigative.";
    case "coach":
      return "Tone: motivational and encouraging.";
    case "custom":
      return custom.trim() || "Tone: helpful.";
    default:
      return "Tone: organized and proactive.";
  }
}

export { personalityText };

export async function chatComplete(args: ChatArgs): Promise<string> {
  const provider = args.providerId as AiProviderId;
  if (!args.apiKey.trim()) {
    throw new ProviderNotConfiguredError(provider);
  }

  if (provider === "openai" || provider === "local" || provider === "custom") {
    return streamOpenAiCompatible(args);
  }
  if (provider === "anthropic") {
    return streamAnthropic(args);
  }
  if (provider === "google") {
    return streamGoogle(args);
  }
  throw new ProviderNotConfiguredError(provider);
}

async function streamOpenAiCompatible(args: ChatArgs): Promise<string> {
  const url =
    args.providerId === "openai"
      ? "https://api.openai.com/v1/chat/completions"
      : "http://127.0.0.1:11434/v1/chat/completions";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`
    },
    body: JSON.stringify({
      model: args.model,
      stream: true,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(args)
        },
        ...historyMessages(args)
      ]
    }),
    signal: args.signal
  });

  if (!response.ok || !response.body) {
    throw new Error(`Provider error (${response.status}). Check model name and key in Settings.`);
  }

  return readSse(response, args, (json) => json.choices?.[0]?.delta?.content ?? "");
}

async function streamAnthropic(args: ChatArgs): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": args.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: args.model,
      max_tokens: 1024,
      stream: true,
      system: buildSystemPrompt(args),
      messages: historyMessages(args)
    }),
    signal: args.signal
  });
  if (!response.ok || !response.body) {
    throw new Error(`Anthropic error (${response.status}).`);
  }
  return readSse(response, args, (json) => {
    if (json.type === "content_block_delta") {
      return json.delta?.text ?? "";
    }
    return "";
  });
}

async function streamGoogle(args: ChatArgs): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(args.model)}:generateContent?key=${encodeURIComponent(args.apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: historyMessages(args).map((turn) => ({
        role: turn.role === "assistant" ? "model" : "user",
        parts: [{ text: turn.content }]
      }))
    }),
    signal: args.signal
  });
  if (!response.ok) {
    throw new Error(`Google error (${response.status}).`);
  }
  const json = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (text) {
    args.onToken(text);
  }
  return text;
}

async function readSse(
  response: Response,
  args: ChatArgs,
  pick: (json: Record<string, any>) => string
): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) {
        continue;
      }
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") {
        continue;
      }
      try {
        const json = JSON.parse(data) as Record<string, any>;
        const chunk = pick(json);
        if (chunk) {
          full += chunk;
          args.onToken(chunk);
        }
      } catch {
        // ignore malformed SSE leftovers
      }
    }
  }
  return full;
}
