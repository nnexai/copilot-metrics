# Phase 18: Refresh Import Batching - Research

## Existing Behavior

- `autoImportConfiguredSources` discovers all configured sources, loads import state once, and then calls `ingestFile` for each source.
- Generic JSONL imports use raw-record high-water lines and raw fingerprints, but still call `readJsonl`, which reads the full file into memory before filtering lines.
- VS Code chat-session imports already store file-stat context, include debug-sidecar size/mtime in that context, and can skip unchanged historical files.
- Copilot session-state imports already use checkpoints for appended session logs.
- Phase 17 replaced `sql.js` full-file export with file-backed `better-sqlite3` and added `runImportMutationBatch` for shared connection reuse.

## Implementation Direction

- Generalize checkpoint file-stat storage beyond VS Code chat sessions so unchanged OTel, hook, and Copilot session files can be skipped before JSON parsing.
- During `--refresh`, re-read changed sources from the beginning but skip unchanged files when checkpoint stat context proves nothing changed.
- Wrap report-time auto-import source processing and final repair passes in `runImportMutationBatch` so large source sets share a storage connection.
- Preserve the existing import result shape; add a `reason: unchanged_file` only on skipped results where useful for diagnostics.

## Risks

- Skipping unchanged files must not hide appended data. File size and mtime must both match before skipping.
- VS Code debug sidecar fingerprints must stay in the VS Code chat stat context.
- Direct `import` commands should remain straightforward and idempotent; report-time optimization should not require new CLI flags.
- Persisting checkpoints for generic sources should not change report output, only reduce work.

## Verification Targets

- Fixture tests prove normal reports import appended data while a subsequent unchanged report skips source work.
- `--refresh` tests prove changed files are re-read and unchanged files do not get redundant checkpoint writes.
- Existing report refresh tests continue to pass unchanged.
- Benchmark output shows refresh/import path improvement against Phase 17/initial baseline.
