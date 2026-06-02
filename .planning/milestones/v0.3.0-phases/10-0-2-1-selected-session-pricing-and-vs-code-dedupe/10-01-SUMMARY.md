---
phase: 10
plan: 10-01
subsystem: selected-pricing
tags: [pricing, reports, vscode, repair, release]
requirements-completed:
  - SEL-01
  - SEL-02
  - SEL-03
  - SEL-04
  - SEL-05
  - SEL-06
  - SEL-07
  - SEL-08
  - SEL-09
  - SEL-10
  - SEL-11
status: complete
completed: 2026-06-02
---

# Plan 10-01 Summary: Selected-price aggregation, VS Code canonical identity repair, and release

## Delivered

- Added selected pricing fields for AI Credits, USD, basis, confidence, and source across pricing classification, ingestion, SQLite storage, repair, and reports.
- Changed report aggregation to sum exactly one selected local price per usage row while retaining estimates, upper bounds, displayed credits, inferred cache data, diagnostics, and warnings as evidence.
- Added VS Code duplicate repair for old OTel/chat/display alias rows, including idempotent merge, label evidence relinking, stronger pricing selection, and duplicate deletion.
- Updated VS Code usage identity to avoid token-bucket-derived keys for chat-session fallback rows.
- Backfilled selected pricing metadata during cost repair for upgraded existing stores.
- Updated tests, README, CHANGELOG, RELEASE, and package metadata for `copilot-metrics@0.2.1`.
- Normalized the Phase 10 planning directory to `10-0-2-1-selected-session-pricing-and-vs-code-dedupe` so GSD SDK phase detection works.

## Verification

- `npm test` passed: 60 tests.
- `npm run check` passed.
- `npm run smoke` passed.
- `npm run verify:package` passed for `copilot-metrics@0.2.1`.
- `npm run check:readme-version` passed.
- `npm pack --silent --dry-run --json` passed and produced a clean 21-file package manifest.

## Review

Inline code review found one migration/backfill gap: existing stores with populated estimates but null selected fields would not be repaired. The implementation now includes null selected-basis rows in `repairUsageCostEstimates()`, and the ingest tests cover that upgrade path.

## Release Gate

Local release preparation is complete. Public npm validation with `npx -y copilot-metrics@0.2.1 ...` remains pending until the human-gated GitHub/npm publish step completes.

## Self-Check

PASSED
