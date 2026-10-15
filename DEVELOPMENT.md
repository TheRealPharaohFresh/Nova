# Development

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Electron + Vite HUD (hot reload renderer) |
| `npm test` | Vitest |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Production main/preload/renderer bundles |
| `npm run package` | electron-builder package (when ready) |

## Layout

Keep **pure logic** in `src/shared` so tests do not need to launch Electron.

Main-process code must not assume the renderer is trusted. Validate IPC.

## Adding an AI provider

1. Implement `AIProvider` in `src/agent/providers`.
2. Register in `src/agent/registry.ts`.
3. Never print API keys.

## Logging

Use `createLogger` from `src/shared/redact.ts` / main logger. If you add a log line, run a mental check: would this leak a key, cookie, or token?

## Git

Do not commit `.env`, user databases, or `out/` / `release/`.

## Phase rule

A phase is done only when it runs, tests exist, docs mention it, and unimplemented features are labeled unavailable.

Voice tests live in `tests/voice.test.ts`. Memory + SQLite coverage is in `tests/memory.test.ts`. Do not add UI controls that call unimplemented tools.
