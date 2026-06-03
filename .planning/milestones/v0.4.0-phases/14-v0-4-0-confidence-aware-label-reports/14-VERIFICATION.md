---
status: passed
verified_at: "2026-06-03T09:11:01+02:00"
---

# Phase 14 Verification

## Result

Passed.

## Evidence

- `npm test -- test/report.test.js` passed: 14 tests.
- `npm run check` passed syntax checks for `bin/copilot-metrics.js` and `src/*.js`.
- `npm test` passed: 76 tests.
- CLI smoke passed: `report label DEMO-54321 --top-k 2 --session-detail --json` returned `top-k`, `overlap=true`, and one included session.

## Success Criteria

- Overview totals use top-label semantics by default.
- Specific-label reports default to rank-1 sessions.
- `--top-k` and `--all-matches` explicitly broaden inclusion and mark overlap in JSON.
- `--session-detail` returns one aggregate row per included session.
- Existing `--detail` remains evidence-row detail filtered by inclusion mode.
