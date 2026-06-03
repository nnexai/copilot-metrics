# Phase 13 Summary: v0.4.0 label association confidence model

## Completed

- Added `src/label-confidence.js` with versioned query-time scoring over granular `label_evidence` rows.
- Added source weights for branch/cwd/folder, metadata/context, and lower-weight prompt/message/tool evidence.
- Added bounded accumulation for distinct lower-weight evidence.
- Added duplicate-evidence de-dupe in scoring and insert-time duplicate skipping for label evidence rows.
- Added deterministic tie-breaking by score, strongest weight, distinct evidence count, first seen, then label.
- Added JSON confidence summaries to label overview and specific-label JSON payloads.
- Kept human report output and current report total semantics unchanged for Phase 14.
- Added tests for dominance, accumulation, duplicate de-dupe, deterministic ties, confidence summaries, and JSON visibility.

## Changed Files

- `src/label-confidence.js`
- `src/reports.js`
- `src/sqlite-store.js`
- `test/label-confidence.test.js`
- `test/report.test.js`

## Verification

- `npm test -- test/label-confidence.test.js test/report.test.js`
- `npm run check`
- `npm test`
- Isolated CLI smoke for confidence metadata in `report labels --json`
