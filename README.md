# NOVA

NOVA is a persistent desktop AI partner: a transparent HUD, voice-ready assistant, coding copilot, and **authorized** security-research workspace. It is not a website chatbot.

This repository is built **incrementally**. It ships a runnable desktop shell with AI, voice, memory, permission-gated screen capture, and constrained workspace file operations. Features that are not implemented yet are labeled **unavailable**—they are not fake buttons.

## Technology choice

| Layer | Choice | Why |
| --- | --- | --- |
| Desktop | **Electron** + **electron-vite** | Transparent / always-on-top / click-through HUD, tray, global shortcuts, startup items, microphone, and `safeStorage` without requiring a Rust toolchain (Rust/cargo were not present on the first-run machine). |
| UI | React + TypeScript | Fast iteration for HUD and settings. |
| Styling | CSS (compact HUD design system) | Zero extra CSS toolchain risk in Phase 0–1; Tailwind can be added later if needed. |
| Local data | SQLite via Node `node:sqlite` | Embedded, no native addon compile step. |
| Secrets | Electron `safeStorage` | OS-backed encryption; keys never hard-coded or written to logs. |
| AI | `AIProvider` interface | OpenAI, Anthropic, Google, and local/custom OpenAI-compatible endpoints are pluggable. |
| Tests | Vitest | Unit tests for redaction, permissions, and the fail-closed scope engine. |

Tauri remains a valid future port (smaller binaries, Rust isolation). Electron was the production-capable path given the available runtimes.

## Security boundary

NOVA is for **ethical, authorized** work only. The scope engine is **fail-closed**: if a target is not explicitly in scope, the action is blocked. NOVA does not include exploit development, malware, credential theft, or attacks on unauthorized systems.

## Requirements

- macOS, Windows, or Linux
- Node.js 22+ (developed on Node 26)
- npm 10+

## Setup

```bash
git clone <repo>
cd nova
npm install
cp .env.example .env   # optional; do not put real keys in git
```

## Run locally

```bash
npm run dev
```

This starts Vite + Electron. The HUD window and system tray should appear.

## Phase 9/10 demo

Open the **Computer** tab to see the screen-capture preview and workspace file browser.

- Turn on **Screen** and **Files** under Settings → Permissions.
- Choose **Capture primary display** and confirm the prompt to take a one-time screenshot. The preview stays in the Computer tab and is not added to chat history.
- Select a file in the workspace browser to read it. Edit its contents and choose **Save changes**; NOVA asks for confirmation before replacing the file.
- File reads and writes are restricted to the project root, including protection against symlinks that point outside it. Emergency stop and the automation-pause setting disable these operations.

`examples/phase-9-10-flow.ts` shows the exact renderer-side IPC sequence:

```ts
import { runPhaseNineTenExample } from "./examples/phase-9-10-flow";

const result = await runPhaseNineTenExample({
  readPath: "README.md",
  writePath: "examples/output/phase-demo.txt",
  replacementContent: "Written explicitly through NOVA's workspace API.\n"
});
```

The flow calls `window.nova.captureScreen()`, `listWorkspaceFiles()`, `readWorkspaceFile(path)`, and `writeWorkspaceFile(path, content)` in order. It performs a real write to the supplied `writePath`; use a disposable destination when trying the example. Screen and Files permissions must be enabled.

## Tests

```bash
npm test
npm run typecheck
```

## Build / package

```bash
npm run build
npm run package
```

Production installers (Phase 21) are not complete until the app is stable. `npm run package` produces an unpackaged/packaged Electron app via electron-builder when configured.

## Configuration

- **Settings UI** — theme, HUD, startup, voice, hotkeys, AI provider.
- **API keys** — enter in Settings; stored encrypted. Never committed. Whisper STT uses the OpenAI key.
- **Permissions** — each OS/capability permission is off until you enable it. Microphone must be on before listening.
- **Voice** — Start listening, hold-to-talk, mute, rate/volume/voice. Replies can be spoken with OS TTS.
- **Memory** — local SQLite; also “remember that …” in chat.

## Security model (short)

See [SECURITY.md](SECURITY.md). Agent output never bypasses: Policy → Permissions → Scope → Risk → Tool → Audit.
