# Architecture

## Overview

```
┌─────────────────────────────────────────────────────────┐
│  Renderer (React HUD / Settings / Workspaces)           │
│  contextBridge IPC only — no Node in the UI             │
└──────────────────────────┬──────────────────────────────┘
                           │ preload (whitelist)
┌──────────────────────────▼──────────────────────────────┐
│  Electron main process                                  │
│  Windows · Tray · Hotkeys · Startup · safeStorage       │
│  SQLite · Logger · Emergency stop · Policy chain        │
└─────────────┬─────────────────────────────┬─────────────┘
              │                             │
              ▼                             ▼
     Agent orchestrator              Tool execution
     (specialist agents)             (never called by the model directly)
```

## Directories

| Path | Role |
| --- | --- |
| `src/main` | Electron main: windows, tray, IPC, DB, secrets, agent runtime |
| `src/preload` | `contextBridge` API |
| `src/renderer` | HUD, settings, screen preview, and workspace file browser |
| `src/shared` | Types, permission checks, and workspace boundary operations |
| `src/agent` | Provider abstraction and orchestrator stubs |
| `tests` | Vitest unit tests |
| `docs` | Extra notes as phases land |

## Data flow

1. UI event or hotkey → IPC.
2. Main validates payload, permissions, active/pause state, and workspace boundaries.
3. For consequential actions: Policy → Permission → Scope → Risk.
4. Tool or provider runs.
5. Result + audit row; UI updates.

The language model **cannot** skip this chain.

## Agent architecture (target)

```
NOVA CORE
├── Conversation Agent
├── Coding Agent
├── Security Research Agent
├── Recon Agent
├── Evidence Agent
├── Report Agent
├── Opportunity Agent
├── Computer Interaction Agent
└── Memory Agent
```

Early phases ship the orchestrator **interface** and conversation path. Specialists are added when their phase is implemented.

## Database

SQLite file in the app user-data directory (`nova.sqlite`).

Tables (Phase 0+): `settings`, `audit_log`, `conversations`, `messages`, `memories`, `permissions`.

## Permission system

Each capability (microphone, clipboard, files, network, startup, …) is stored as `off` until the user turns it on. The UI explains what each permission does. Denying a permission makes related features **unavailable**, not silently degraded.

## Tool architecture

Every external action implements:

- `name`, `description`, `permissions`, `riskLevel`
- `validate()` then `execute()` then `audit()`

AI output is treated as untrusted data, never as executable instructions.
