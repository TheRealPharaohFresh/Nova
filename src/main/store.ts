import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { redactMeta, redactText } from "../shared/redact.js";
import type { ChatTurn, MemoryItem } from "../shared/types.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

export class NovaStore {
  private readonly db: DatabaseSync;

  constructor(filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true });
    this.db = new DatabaseSync(filePath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        level TEXT NOT NULL,
        event TEXT NOT NULL,
        meta TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  getJson<T>(key: string, fallback: T): T {
    const row = this.db.prepare("SELECT value FROM kv WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    if (!row) {
      return fallback;
    }
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return fallback;
    }
  }

  setJson(key: string, value: unknown): void {
    this.db
      .prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(key, JSON.stringify(value));
  }

  audit(level: LogLevel, event: string, meta: Record<string, unknown> = {}): void {
    const safe = redactMeta(meta);
    this.db
      .prepare("INSERT INTO audit_log (ts, level, event, meta) VALUES (?, ?, ?, ?)")
      .run(new Date().toISOString(), level, redactText(event), JSON.stringify(safe));
  }

  recentAudit(limit = 50): Array<{ ts: string; level: string; event: string; meta: string }> {
    return this.db
      .prepare("SELECT ts, level, event, meta FROM audit_log ORDER BY id DESC LIMIT ?")
      .all(limit) as Array<{ ts: string; level: string; event: string; meta: string }>;
  }

  ensureConversation(id: string, title: string): void {
    const now = new Date().toISOString();
    const existing = this.db.prepare("SELECT id FROM conversations WHERE id = ?").get(id) as
      | { id: string }
      | undefined;
    if (existing) {
      this.db
        .prepare("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?")
        .run(title, now, id);
      return;
    }
    this.db
      .prepare("INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)")
      .run(id, title, now, now);
  }

  insertMessage(turn: ChatTurn, conversationId: string): void {
    this.db
      .prepare(
        "INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)"
      )
      .run(turn.id, conversationId, turn.role, turn.content, turn.createdAt);
    this.db
      .prepare("UPDATE conversations SET updated_at = ? WHERE id = ?")
      .run(turn.createdAt, conversationId);
  }

  listMessages(conversationId: string, limit = 80): ChatTurn[] {
    const rows = this.db
      .prepare(
        "SELECT id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC"
      )
      .all(conversationId) as Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      created_at: string;
    }>;
    return rows.slice(-limit).map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at
    }));
  }

  listMemories(): MemoryItem[] {
    const rows = this.db
      .prepare("SELECT id, category, content, created_at FROM memories ORDER BY created_at DESC")
      .all() as Array<{ id: string; category: MemoryItem["category"]; content: string; created_at: string }>;
    return rows.map((row) => ({
      id: row.id,
      category: row.category,
      content: row.content,
      createdAt: row.created_at
    }));
  }

  addMemory(item: MemoryItem): void {
    this.db
      .prepare("INSERT INTO memories (id, category, content, created_at) VALUES (?, ?, ?, ?)")
      .run(item.id, item.category, item.content, item.createdAt);
  }

  deleteMemory(id: string): void {
    this.db.prepare("DELETE FROM memories WHERE id = ?").run(id);
  }

  close(): void {
    this.db.close();
  }
}
