# Phase 20: Incremental JSONL and Lightweight Collection - Context

**Gathered:** 2026-07-20
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss defaults accepted from the measured performance audit

<domain>
## Phase Boundary

Make append-only JSONL refresh proportional to newly appended input and reduce hook/debug collection overhead. Preserve every existing ingestion, privacy, warning, attribution, deduplication, and explicit-refresh contract; store/report-wide maintenance belongs to Phase 21.

</domain>

<decisions>
## Implementation Decisions

### Incremental checkpoint contract
- Persist byte offset, completed line count, file size/mtime, and stable file identity where available in checkpoint context.
- Advance the byte checkpoint only through the final complete newline so a trailing partial JSON value is retried when more bytes arrive.
- Treat truncation, replacement, rotation, incompatible legacy context, and explicit refresh as safe reset conditions with full-read fallback.
- Keep record line numbers and malformed complete-line warnings identical to full-file parsing.

### Compatibility and recovery
- Existing line-only checkpoints remain readable and upgrade on the next successful import without losing or duplicating usage.
- The unique raw fingerprint and usage identity contracts remain the final deduplication guard.
- Explicit `--refresh` continues to re-evaluate changed recent files while unchanged files stay skipped.
- Content capture and redaction defaults do not change.

### Lightweight collection
- Add a dedicated hook executable that imports only path and hook-logging code; generated hook configuration should use it.
- Keep the existing `copilot-metrics hook-log` command for backward compatibility.
- Avoid a daemon or background-service requirement.
- Benchmark fresh-process startup so the lightweight path is compared with the existing full CLI path.

### Debug-log reuse and verification
- Parse each resolved VS Code debug log once per source-file import and share the cached-token result across usage records.
- Cover append, unchanged, truncation, replacement/rotation, malformed complete lines, trailing partial lines, legacy checkpoints, hook output, and debug reuse with fixture/temp-file tests.
- Add a repeatable incremental JSONL benchmark without weakening functional assertions.

### the agent's Discretion
- Exact helper names, checkpoint JSON field names, streaming/chunk implementation, and benchmark sizes are implementation details.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/jsonl.js` owns JSONL parsing and line-aware warning output.
- `src/ingest.js` owns file-stat checkpoint decisions, fallback normalization, debug cached-token extraction, and checkpoint persistence.
- `src/hook-logger.js` already provides privacy-preserving hook redaction and append-only output.
- `test/ingest.test.js` and `test/setup.test.js` provide temp-file and hook configuration patterns.

### Established Patterns
- Runtime code is CommonJS on Node.js 20+ with synchronous local filesystem operations and Promise-shaped store APIs.
- Checkpoints store extensible context JSON alongside a line high-water mark.
- Fixture-backed tests assert semantic outputs and privacy boundaries.

### Integration Points
- `readJsonl` and `readSessionRecords` feed both telemetry and fallback-session imports.
- `ingestFile` and `ingestVscodeChatSessionFile` write checkpoint context after successful mutations.
- Setup-generated hook commands and `package.json` bin/files metadata determine the installed collection path.

</code_context>

<specifics>
## Specific Ideas

Optimize the measured hot paths: a checkpointed 9.22 MB JSONL still took about 25 ms to retrieve ten appended records, and the full hook CLI added roughly 18 ms median over a hook-only process.

</specifics>

<deferred>
## Deferred Ideas

- Optional long-lived hook collector.
- Parallel parsing of multiple changed source files.
- Store-wide maintenance and report-query optimization (Phase 21).

</deferred>
