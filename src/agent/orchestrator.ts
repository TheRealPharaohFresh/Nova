export type AgentName =
  | "conversation"
  | "coding"
  | "security"
  | "recon"
  | "evidence"
  | "report"
  | "opportunity"
  | "computer"
  | "memory";

export interface RouteDecision {
  agent: AgentName;
  reason: string;
}

const KEYWORDS: Array<{ agent: AgentName; needles: string[] }> = [
  { agent: "coding", needles: ["code", "refactor", "typescript", "python", "bug", "stack trace"] },
  { agent: "security", needles: ["bounty", "scope", "finding", "cwe", "idor", "xss"] },
  { agent: "opportunity", needles: ["income", "freelance", "saas", "pricing"] },
  { agent: "memory", needles: ["remember", "forget", "my preference"] }
];

/** Cheap router: avoids extra model calls for obvious specialist intent. */
export function routeMessage(text: string): RouteDecision {
  const lower = text.toLowerCase();
  for (const row of KEYWORDS) {
    if (row.needles.some((n) => lower.includes(n))) {
      return { agent: row.agent, reason: `Matched specialist keywords for ${row.agent}` };
    }
  }
  return { agent: "conversation", reason: "Default conversation agent" };
}
