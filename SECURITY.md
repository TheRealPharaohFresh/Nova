# Security

## Threat model (abridged)

| Threat | Mitigation |
| --- | --- |
| Stolen API keys | Electron `safeStorage`; never log secrets; `.gitignore` for `.env` |
| Prompt injection from web/files | Untrusted content is data only; tools require policy + permission + scope |
| Unauthorized scanning / testing | Fail-closed **scope engine**; autonomous mode cannot widen scope |
| Model “jailbreak” to run tools | Tools are not exposed to the model as raw shell; main process owns execution |
| Secret recording | Mic/screen off by default; status always visible; no silent retention |
| Supply chain | Pin dependencies; no unverified auto-update execution (Phase 22) |

## Permissions

All sensitive access is opt-in. See the in-app Permissions dashboard (later phases). Microphone, screen, clipboard, files, terminal, network, startup, and notifications each have an explanation and an on/off control.

## Scope enforcement

The scope engine is a **safety subsystem**, not a suggestion:

1. Identify target
2. Compare to authorized assets
3. Apply exclusions
4. Rate limits and tool permissions
5. Risk class
6. Allow or **block**

If uncertain → **BLOCK**. The model cannot override this.

NOVA must not be used to attack systems the user is not authorized to test.

## Secret handling

- No hard-coded keys.
- Redact tokens, `Bearer`, `sk-`, and password-like fields in logs.
- Encrypted persistence via `safeStorage` when the OS supports it.

## Autonomous-agent safeguards

- Emergency stop is **UI/main-process** owned, not model-owned.
- Autonomous security mode (when implemented) still requires explicit scope, allowlists, budgets, and audit logs.
- No unrestricted autonomous attacks.

## What this project will not implement

Mechanisms intended to bypass authorization, evade monitoring, steal credentials, deploy malware, or attack arbitrary third parties.
