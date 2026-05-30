# Phase 6: 0.1.1 Zero-friction setup, automatic hook ingestion, and complete token reporting - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship `copilot-metrics@0.1.1` as a patch release that turns the CLI into a setup-once local tool. This phase covers persisted setup/configuration, automatic idempotent imports before report commands, complete label token reporting, and clear hook-only attribution semantics. It does not add official GitHub reconciliation, collector mode, dashboard views, or richer prompt capture.

</domain>

<decisions>
## Implementation Decisions

### Setup Persistence
- `init` remains the primary command for creating the central data directory and local `config.json`.
- `setup all` also persists the central config so users can follow setup guidance without a separate manual initialization step.
- Environment variables and `--home` remain explicit overrides for custom or automated runs.

### Automatic Imports
- Report commands import configured VS Code OTel, Copilot CLI OTel, and hook JSONL sources before querying.
- Auto-import must be idempotent: repeated report commands cannot double-count previously imported records.
- Missing configured JSONL files are treated as empty sources, not errors.

### Report Semantics
- Label overview and single-label reports expose input, output, cache read, cache creation, and reasoning token totals in human and JSON output.
- Hook-only label evidence remains visible but is distinguished from token-bearing usage through usage-record counts and a human-readable token status.
- Empty or hook-only stores should produce clear report output instead of SQLite errors or misleading token totals.

### Hook Command Stability
- Generated hook commands should work for checkout-local `bin/*.js` paths and installed executable shims.
- Hook logging remains redacted by default and does not store full prompts unless explicitly requested.

</decisions>

<code_context>
## Existing Code Insights

- `src/cli.js` owns command routing and already resolves central paths once per invocation.
- `src/setup.js` creates data directories, default config, telemetry snippets, and hook configs.
- `src/ingest.js` parses JSONL, normalizes OTel/hook records, attaches label evidence, estimates costs, and writes through `src/sqlite-store.js`.
- `src/sqlite-store.js` uses `sql.js`, creates tables on demand, and persists a single local SQLite file.
- `src/reports.js` owns query SQL and human report formatting.
- Tests are fixture-based and run through `node --test`; smoke verification exercises CLI import and reports.

</code_context>

<specifics>
## Specific Ideas

- Add raw-record fingerprints to the local store and filter parsed rows before normalization so duplicate imports cannot create duplicate usage or hook events.
- Add a report preflight that ensures directories/config exist, then imports configured source files before query functions run.
- Keep report JSON flat and backward compatible by adding fields instead of nesting existing fields.
- Add compact human columns for cache and reasoning tokens.
- Add focused tests for setup persistence, auto-import idempotency, hook-only output, and complete token category reporting.

</specifics>

<deferred>
## Deferred Ideas

- Official billing reconciliation remains v2 work.
- Local OTLP collector mode remains v2 work.
- Richer prompt capture and purge/redaction controls remain v2 work.
- Dashboard/UI reporting remains deferred until CLI reports prove the data model.

</deferred>
