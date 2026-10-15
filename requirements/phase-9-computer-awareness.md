# Phase 9: Computer Awareness Requirements

## Goal

Enable Nova to understand the current user environment when the user explicitly grants Screen access.

## Functional requirements

- Capture a screenshot of the primary display only when the Screen permission is enabled.
- Require explicit consent before capturing any screen or window data.
- Keep the feature off by default.
- Return a structured result with image data and metadata suitable for downstream analysis.
- Store no screen data silently in logs or chat history.

## Security requirements

- The feature must be deny-by-default.
- All screen operations must respect emergency-stop and automation pause states.
- Screenshots must never be stored in plain text outside the active request lifecycle unless a user explicitly asks for persistence.
- Screen data must remain within the user-scoped workspace and security boundary.

## Acceptance criteria

- A user can enable the Screen permission in Settings.
- A request to capture a screenshot triggers an explicit, permission-checked path.
- Paths outside the allowed workspace are blocked for any downstream tool that consumes the frame.
- The feature is unavailable when the permission is off.
