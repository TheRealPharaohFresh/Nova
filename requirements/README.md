# Project Requirements

This folder captures the baseline requirements and enablement needs for the current Nova development state.

## Current stage

The app is built through Phase 8, with initial Phase 9 and Phase 10 workflows implemented:

- Computer awareness / primary-display capture and preview
- Workspace file browsing, reading, and explicit replacement writes

AI screenshot analysis and AI-directed coding edits remain future work. This is not a greenfield starter project anymore. The project assumes the following are already present and working:

## Required developer environment

- Node.js 22+
- npm 10+
- Git
- Access to a local desktop environment for Electron testing
- macOS, Windows, or Linux host with desktop app runtime support

## Required app/runtime capabilities

- Electron app shell and tray support
- Local SQLite persistence
- Permission model with explicit opt-in controls
- Secure secret storage for AI provider keys
- Network access for AI provider integration
- Microphone access for voice workflows
- Screen access for Phase 9
- Filesystem access for Phase 10 workspace operations

## Required project expectations

- Work must remain fail-closed and permission-gated
- Features must default to off until the user enables them
- Secret material must never be hard-coded or logged
- AI actions must not bypass policy, permission, or scope checks
- Any new capability must be reflected in the roadmap and security model

## Deliverables expected at this milestone

- A documented baseline for environment, dependencies, and permissions
- Primary-display capture preview behind Screen permission, including explicit per-capture consent
- Workspace listing, reading, and explicit writes behind Files permission
- Emergency-stop and automation-pause gates for screen and workspace operations
- Tests covering workspace reads/writes, traversal, and symlink boundaries

## Associated docs

- [../README.md](../README.md)
- [../ROADMAP.md](../ROADMAP.md)
- [../SECURITY.md](../SECURITY.md)
- [../ARCHITECTURE.md](../ARCHITECTURE.md)
