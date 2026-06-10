# Phase 18: Refresh Import Batching - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Make normal report imports and explicit `--refresh` avoid unnecessary source processing and database writes for unchanged local telemetry/session files, while preserving appended-data auto-import and current report semantics.

</domain>

<decisions>
## Implementation Decisions

### Refresh Semantics
- Normal report commands must still auto-import newly appended configured sources before querying.
- Unchanged configured sources should be skipped using persisted checkpoint file-stat context where available.
- `--refresh` remains a correctness tool for changed files; it may skip unchanged files rather than re-reading and rewriting identical data.
- VS Code chat-session debug sidecar fingerprints remain part of the file-stat context so cached-token evidence is not missed.

### Batching Boundary
- Use Phase 17's file-backed store and `runImportMutationBatch` to share storage work across report auto-import source sets.
- Keep source discovery and parsing behavior local-first and content capture disabled by default.
- Do not implement report query/ranking caches, report SQL retuning, or release work; those remain Phase 19.

### the agent's Discretion
Implementation details are at the agent's discretion as long as CLI syntax, report JSON contracts, selected pricing, label ranking, manual-label behavior, and diagnostics remain stable.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/ingest.js` already has `fileStatContext`, `sameFileStat`, `checkpointFileStat`, and VS Code chat debug-sidecar stat handling.
- `src/sqlite-store.js` now exposes `runImportMutationBatch`, import checkpoints, and file-backed SQLite persistence.
- `test/report.test.js` already covers `--refresh` debug cached tokens, displayed credits, idempotent refresh, and stale VS Code chat skip behavior.
- `scripts/benchmark-storage.js` provides a JSON benchmark pattern with spike baseline references.

### Established Patterns
- Reports call `autoImportConfiguredSources` under the CLI store lock before querying.
- Import checkpoints are keyed by `(source, source_file)` and store JSON context.
- Session-log prompt content is used transiently and not persisted.
- Tests use temp homes and fixture JSONL/session files.

### Integration Points
- `autoImportConfiguredSources` is the report-time batching entry point.
- `ingestFile` owns generic OTel/hooks/Copilot-session imports.
- `ingestVscodeChatSessionFile` owns VS Code chat session and debug-sidecar refresh behavior.
- `readJsonl` currently reads whole files before filtering by line; Phase 18 can skip unchanged files before calling it.

</code_context>

<specifics>
## Specific Ideas

Preserve the Phase 17 benchmark output and add refresh-focused evidence through tests or benchmark output without changing normal report output.

</specifics>

<deferred>
## Deferred Ideas

- Report query/ranking reuse and output-equivalence release gates remain Phase 19.
- Dedicated performance diagnostics commands remain deferred future UX.

</deferred>
