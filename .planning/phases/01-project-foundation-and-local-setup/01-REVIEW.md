---
status: fixed
phase: 01-project-foundation-and-local-setup
reviewed: 2026-05-30
---

# Phase 1 Code Review

## Findings Fixed

- VS Code OTel setup now emits current setting keys: `github.copilot.chat.otel.exporterType`, `github.copilot.chat.otel.outfile`, and `github.copilot.chat.otel.captureContent`.
- Copilot CLI OTel setup now emits current environment variables: `COPILOT_OTEL_ENABLED`, `COPILOT_OTEL_EXPORTER_TYPE`, `COPILOT_OTEL_FILE_EXPORTER_PATH`, and `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT`.
- Hook config now emits a `hooks` object with command hook entries instead of the earlier non-current `events` shape.
- Data directories, config files, hook config files, and hook JSONL files now request private Unix permissions.
- Global hook path now respects `COPILOT_HOME`.
- `hook-log` now tolerates non-object JSON payloads.

## Verification

- `npm test` passed.
- `npm run check` passed.
- `node bin/copilot-metrics.js setup vscode --json` prints current OTel keys.
- `node bin/copilot-metrics.js setup copilot-cli --json` prints current OTel variables.
- `node bin/copilot-metrics.js hooks preview --scope local --json` prints current hook config shape.
