---
quick_id: 260531-vscode-response-attribution
created: 2026-05-31
status: complete
---

# Plan: VS Code Response Attribution Bugfix

Fix the bug where VS Code Copilot token records import but remain unattributed to labels because OTel records and hook events do not share a session ID.

## Scope

- Link VS Code OTel token records to VS Code chat session labels by exact response ID.
- Keep prompt/chat content out of the metrics database by default.
- Backfill missing response IDs in existing local stores from already imported raw OTel records.
- Keep Copilot CLI session-state behavior unchanged.
- Release a package-json-versioned bugfix.

## Verification

- Fixture tests for VS Code log-record response IDs and timestamps.
- Fixture tests for VS Code chat session response ID label correlation.
- Fixture tests for existing-store backfill and dated model pricing-key normalization.
- Live report check for `HDASPF-321`.
- Full npm verification before release.
