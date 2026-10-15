const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{8,}\b/g,
  /\bBearer\s+[A-Za-z0-9._\-+=/]+/gi,
  /\bapi[_-]?key["']?\s*[:=]\s*["']?[A-Za-z0-9._\-]+/gi,
  /\b(AIza[0-9A-Za-z_-]{20,})\b/g
];

const SENSITIVE_KEYS = new Set([
  "apikey",
  "api_key",
  "api-key",
  "authorization",
  "password",
  "secret",
  "token",
  "access_token",
  "refresh_token"
]);

export function redactText(input: string): string {
  let out = input;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, "[REDACTED]");
  }
  return out;
}

export function redactValue(key: string, value: unknown): unknown {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  const sensitive =
    SENSITIVE_KEYS.has(key.toLowerCase()) ||
    normalized.includes("apikey") ||
    normalized.includes("password") ||
    normalized.includes("secret") ||
    normalized.includes("token");
  if (sensitive) {
    return "[REDACTED]";
  }
  if (typeof value === "string") {
    return redactText(value);
  }
  return value;
}

export function redactMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    out[k] = redactValue(k, v);
  }
  return out;
}
