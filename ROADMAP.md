# Roadmap

## Status

| Phase | Name | Status |
| --- | --- | --- |
| 0 | Foundation | Done |
| 1 | Desktop shell + HUD | Done |
| 2 | System tray + startup | Done |
| 3 | AI chat | Done (requires key + network permission; history persisted) |
| 4 | Identity | Done (first-run + settings) |
| 5 | Personality | Done (presets; cannot override safety) |
| 6 | Voice | Done (STT + TTS; mic permission required) |
| 7 | Wake word + hotkeys | Partial (global hotkeys + optional wake-phrase gating; no dedicated always-on model) |
| 8 | Memory | Done (local SQLite + Memory tab) |
| 9 | Computer awareness | Partial (explicit primary-display capture and in-session preview; no AI analysis/window context) |
| 10 | Coding copilot | Partial (permission-gated file browser, read, and explicit save; no AI-directed edit workflow) |
| 11 | Security workspace + scope engine | Scope engine tests exist; security workspace UI later |
| 12–16 | Research tools, hypotheses, evidence, reports | Planned (authorized scope only) |
| 17–18 | Opportunity finder / business builder | Planned |
| 19 | Background automation | Planned |
| 20 | Testing + hardening | Partial (unit tests) |
| 21 | Production packaging | Not started |
| 22 | Auto-updates + release | Not started |

## Current

Phases 0–10 are runnable or partially implemented except a dedicated always-on wake-word engine. Voice uses Chromium speech recognition when present, otherwise OpenAI Whisper. TTS uses the OS synthesizer. Security *execution* tools are not shipped.

## Remaining work

### Near-term

- **Phase 7 — Voice:** add an optional dedicated wake-word engine; current wake-phrase matching works only while listening is already active.
- **Phase 9 — Computer awareness:** add explicit window selection/capture and a permission-gated way to send a user-approved screenshot to an AI provider for analysis. Current capture is a primary-display preview only.
- **Phase 10 — Coding copilot:** add AI-generated edit proposals with a reviewable diff and explicit approval before writing. Current tools browse, read, and directly edit one file at a time; they do not invoke AI for code changes.
- **Phase 10 — Workspace selection:** let the user choose and persist an active project root instead of using the process working directory.
- **Phase 11 — Security workspace:** build scope management and reviewable evidence workflows on top of the existing fail-closed scope engine. Do not add active security execution until authorization, permissions, budgets, and audit behavior are fully designed and tested.

### Release readiness

- Expand automated coverage for IPC permission/pause gates, screen-capture consent, workspace UI flows, and platform-specific path behavior.
- Run desktop smoke tests on macOS, Windows, and Linux, including permission prompts, tray behavior, and screen capture.
- Complete production packaging, installer signing/notarization where applicable, and verify clean-machine installs.
- Design and test a secure update and release process before enabling automatic updates.

## Known issues

- No production installer yet.
- Dedicated always-on wake word (Porcupine / similar) is not implemented; optional wake-phrase gating only applies while listening.
- Click-through: use tray **Disable click-through** or the show/hide hotkey. The HUD cannot receive clicks while click-through is on.

The remaining-work list above is the source of truth for next milestones.
