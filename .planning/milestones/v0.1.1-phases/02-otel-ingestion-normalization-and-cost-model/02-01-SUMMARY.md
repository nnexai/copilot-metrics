---
phase: 02-otel-ingestion-normalization-and-cost-model
plan: 01
status: complete
completed: 2026-05-30
key_files:
  - src/paths.js
  - src/jsonl.js
  - src/sqlite-store.js
  - src/otel.js
  - src/pricing.js
  - src/ingest.js
  - src/cli.js
  - test/ingest.test.js
  - test/fixtures/vscode-otel.jsonl
  - test/fixtures/copilot-cli-otel.jsonl
  - test/fixtures/hook-events.jsonl
  - README.md
---

# Phase 2 Plan 01 Summary

## Accomplishments

- Added a SQLite store path under the central user-level data directory.
- Added JSONL parsing with malformed-row warnings.
- Added SQLite schema creation and insert helpers using the portable npm dependency `sql.js`.
- Added OTel span flattening, attribute extraction, LLM/root/tool classification, and normalized token/model/context fields.
- Added versioned GitHub Copilot model pricing and AI Credit cost estimation.
- Added import pipeline for VS Code OTel, Copilot CLI OTel, and hook JSONL records.
- Added CLI commands: `store init`, `import`, and `pricing list`.
- Added fixture tests covering malformed JSONL, root-agent double-count prevention, known model pricing, unknown pricing warnings, and hook event import.
- Updated README with import commands and current limits.

## Verification

- `npm test` passed.
- `npm run check` passed.
- `node bin/copilot-metrics.js store init --home /tmp/copilot-metrics-phase2 --json` passed.
- `node bin/copilot-metrics.js import --source vscode --file test/fixtures/vscode-otel.jsonl --home /tmp/copilot-metrics-phase2 --json` passed.

## Notes

- Pricing is versioned as `github-copilot-2026-06-01` and sourced from GitHub Copilot model pricing docs checked on 2026-05-30.
- SQLite uses `sql.js`, so npm/npx/node remain the only required runtime prerequisites.
