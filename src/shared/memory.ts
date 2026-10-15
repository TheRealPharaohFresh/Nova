import type { MemoryCategory, MemoryItem } from "./types.js";

export const MEMORY_CATEGORIES: MemoryCategory[] = [
  "preferences",
  "identity",
  "personality",
  "coding",
  "projects",
  "security",
  "business",
  "goals",
  "instructions"
];

export function isMemoryCategory(value: string): value is MemoryCategory {
  return (MEMORY_CATEGORIES as string[]).includes(value);
}

/** "remember that I use vim" / "please remember: ship Fridays" */
export function parseRememberCommand(text: string): string | null {
  const match = text
    .trim()
    .match(/^(?:please\s+)?remember(?:\s+that)?[:\s]+(.+)$/i);
  if (!match?.[1]) {
    return null;
  }
  const content = match[1].trim();
  return content.length > 0 ? content : null;
}

export function formatMemoriesForPrompt(items: MemoryItem[], limit = 24): string {
  if (items.length === 0) {
    return "";
  }
  const slice = items.slice(0, limit);
  const lines = slice.map((item) => `- [${item.category}] ${item.content}`);
  return `Known memories (persist these; do not invent extra facts):\n${lines.join("\n")}`;
}
