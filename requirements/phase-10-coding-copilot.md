# Phase 10: Coding Copilot Requirements

## Goal

Add a minimal, safe coding-copilot layer that allows Nova to read and edit workspace files only when the user has opted in.

## Functional requirements

- Require the Files permission before any workspace read or write is allowed.
- Allow safe reads of files rooted within the current project workspace.
- Prevent directory traversal and writes outside the project root.
- Support reading a single file and writing a single file with explicit content replacement.
- Support listing project files so the assistant can inspect the active workspace.

## Security requirements

- Validate every requested path against the project root before it is opened.
- Reject writes outside the current workspace even if a relative path attempts to escape it.
- Do not silently mutate files; every write must be explicit and permission-gated.
- Respect emergency-stop and automation pause states before any write is executed.

## Acceptance criteria

- A user enables the Files permission before file access is possible.
- Project-root validation prevents path traversal attempts.
- Reading a valid workspace file returns the file content.
- Writing a valid workspace file stores the content and preserves the file path within the workspace.
- Writes fail cleanly without leaking the target path when the request is rejected.
