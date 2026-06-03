# Phase 14 Summary: v0.4.0 confidence-aware label reports

## Completed

- Changed label overview aggregation to top-label semantics by default.
- Changed specific-label reports to default to rank-1 sessions.
- Added `--top-k <n>`, `--top-k all`, and `--all-matches` inclusion modes.
- Added JSON inclusion metadata for default and broad report modes.
- Kept `--detail` as evidence-row detail while filtering by inclusion mode.
- Added `--session-detail` for per-session aggregate label report rows.
- Added report tests for top-label defaults, top-k/all-match inclusion, and session-detail.

## Changed Files

- `src/cli.js`
- `src/reports.js`
- `src/label-confidence.js`
- `test/report.test.js`

## Verification

- `npm test -- test/report.test.js`
- `npm run check`
- `npm test`
- CLI smoke for top-k session detail JSON
