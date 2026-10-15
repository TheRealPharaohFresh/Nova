import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { redactMeta, redactText } from "../shared/redact.js";
import type { NovaStore } from "./store.js";

export interface Logger {
  info(event: string, meta?: Record<string, unknown>): void;
  warn(event: string, meta?: Record<string, unknown>): void;
  error(event: string, meta?: Record<string, unknown>): void;
}

export function createLogger(logDir: string, store: NovaStore): Logger {
  mkdirSync(logDir, { recursive: true });
  const file = join(logDir, "nova.log");

  const write = (level: "info" | "warn" | "error", event: string, meta: Record<string, unknown>) => {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      event: redactText(event),
      meta: redactMeta(meta)
    });
    appendFileSync(file, `${line}\n`);
    store.audit(level, event, meta);
  };

  return {
    info: (event, meta = {}) => write("info", event, meta),
    warn: (event, meta = {}) => write("warn", event, meta),
    error: (event, meta = {}) => write("error", event, meta)
  };
}
