---
plan_id: 08-01
phase: 8
status: complete
completed: 2026-06-02
---

# Plan 08-01 Summary: Pricing evidence, estimate confidence, and report semantics

## Delivered

- Added pricing classification for trusted observed local charge evidence, high-confidence estimates, upper-bound estimates, included/zero evidence, unknown pricing, cache-read status, pricing source, and diagnostics.
- Added SQLite migration fields for actual charge evidence, upper-bound estimates, pricing basis/confidence/source, cache-read status, pricing metadata, and pricing diagnostics.
- Preserved Copilot CLI `totalNanoAiu`, request cost/count, and premium request counters from session-state shutdown logs.
- Added VS Code session-local price metadata extraction for model metadata and `billing.token_prices`-style records.
- Added VS Code companion debug-log lookup for `GitHub.copilot-chat/debug-logs/<session-id>/main.jsonl` and `llm_request.attrs.cachedTokens`.
- Added report `--refresh` so configured files can be re-read and stronger pricing/debug evidence merged without duplicating usage rows.
- Extended label, model, repo, detail, and unattributed JSON reports with pricing-basis fields while keeping human reports compact.
- Updated README, CHANGELOG, package metadata, and package-lock for `0.1.9`.

## Tests Added

- VS Code fallback with session-local pricing and unknown cache reads produces upper-bound estimates.
- VS Code debug logs upgrade cache-read status and high-confidence estimates.
- Copilot session-state `totalNanoAiu` is trusted as observed local charge evidence.
- Report `--refresh` re-reads configured sources and merges new debug pricing evidence into one usage row.

## Verification

All verification passed:

```bash
npm test
npm run check
npm run smoke
npm run verify:package
npm run check:readme-version
```

## Notes

- Local machine validation confirmed the VS Code Insiders debug-log layout, but current sampled logs did not contain positive `llm_request.attrs.cachedTokens` rows.
- Official GitHub billing reconciliation remains out of scope.
