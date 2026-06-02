---
phase: 10
status: complete
created: 2026-06-02
---

# Phase 10 Research: Selected Session Pricing and VS Code Dedupe

## Research Complete

Phase 10 is a codebase-internal pricing/reporting correction. No live external pricing table is needed for planning because the phase does not change model prices; it changes which already-stored local price is selected for user-facing totals.

## Current Implementation Map

### Pricing Selection

- `src/pricing.js` currently classifies a row with `pricing_basis`, `estimate_confidence`, actual charge fields, displayed-credit fields, complete/upper-bound estimates, included/zero diagnostics, and warnings.
- `classifyPricing()` already has the intended row-level basis order for current inputs: actual charge, displayed credit, upper-bound/estimate, included/zero, unknown.
- Missing: explicit `selected_*` fields. Reports still need to infer selection from `pricing_basis` and separate evidence fields, which makes aggregation easy to get wrong.

### Report Aggregation

- `src/reports.js` aggregates `estimated_ai_credits` and `estimated_usd` across label, label summary, model, repo, detail, and unattributed report surfaces.
- `estimated_*` is intentionally retained as comparable token-price evidence even when displayed credits or included/zero evidence wins.
- Current issue: human tables label these columns as `Cr est.` / `$ est.` and JSON totals sum comparable estimates instead of a confidence-selected price.
- Needed: reports should expose selected totals as the primary user-facing totals and keep actual/displayed/estimate/upper-bound values as diagnostics.

### Store and Merge

- `src/sqlite-store.js` owns schema migration, `usage_records` insertion, duplicate detection by `usage_identity`, and `mergeUsageEvidence()`.
- `usage_records` already has `usage_identity` with a unique partial index.
- `mergeUsageEvidence()` preserves strongest basis and evidence fields but updates `estimated_*` from incoming usage, so selected fields should be recomputed or merged consistently when evidence improves.
- Needed: schema columns for selected AI Credits, selected USD, selected basis, selected confidence, selected source, and alias diagnostics; insert/update/repair paths must populate them idempotently.

### VS Code Identity

- `src/ingest.js` computes `usageIdentity(record)`.
- Current identity includes token bucket values for session/time fallback records. This can create duplicates when the same VS Code request is first imported with cache-read unknown and later with cache-read known, or when OTel and chat-session fallback provide different token details.
- For OTel/log rows with `span_id`, identity is `span:${span_id}|model:${model}`.
- VS Code chat-session fallback uses `span_id: request.responseId` and `session_id`, `timestamp`, `model`, token buckets.
- Needed: canonical VS Code identity logic that prefers response aliases and excludes token buckets from identity. Alias evidence should include top-level `responseId`, `result.metadata.responseId`, `modelMessageId`, request ID when present, and session/model/timestamp fallback.

### Existing Repair Paths

- `repairUsageCostEstimates()` recalculates cost fields on rows with missing/zero estimates.
- `backfillVscodeUsageResponseIds()` repairs missing VS Code response IDs from raw records.
- There is no current duplicate collapse repair for existing `usage_records` rows whose identities differ only because old identity formats included token buckets or fallback/OTel aliases diverged.
- Needed: a repair path callable during import/report refresh that merges duplicate rows into a canonical row, relinks `label_evidence.usage_record_id`, preserves diagnostics/source evidence, deletes duplicate `usage_records`, and is idempotent.

### Refresh

- `configuredSourceEntries()` discovers VS Code and Copilot session-log sources.
- `ingestConfiguredSources()` and report `--refresh` import configured sources before reports.
- Import checkpoints and high-water state already avoid reprocessing unchanged lines for source files, but broad session path discovery can still feel silent when many files are scanned.
- Needed: either target changed VS Code session files through source file mtime/checkpoint state or show progress/diagnostic counts when broad scanning is unavoidable.

## Recommended Implementation Strategy

1. Add a selected-price helper in `src/pricing.js`.
   - Input: row/evidence fields produced by `classifyPricing()`.
   - Output: `selected_ai_credits`, `selected_usd`, `selected_pricing_basis`, `selected_confidence`, `selected_source`.
   - Precedence: actual, displayed_credit, estimated, upper_bound, included_or_zero, unknown_price.
   - For included/zero, selected credits and USD are exactly zero even when token estimates are retained.

2. Persist selected fields in `usage_records`.
   - Add migration columns in `initStore()`.
   - Include selected fields in insert, duplicate merge, and cost repair update statements.
   - Make merge prefer selected fields from the strongest basis after evidence merge, not just the incoming row.

3. Switch report primary totals to selected fields.
   - Use selected credits/USD for label overview, label summary, label model breakdown, model report, repo report, label details, and unattributed report.
   - Keep `estimated_*`, `actual_*`, `displayed_*`, `upper_bound_*`, `inferred_cache_*`, diagnostics, and basis counts in JSON output.
   - Human report column labels should distinguish selected totals from diagnostics, for example `Cr sel.` / `$ sel.`.

4. Canonicalize VS Code usage identity.
   - Build a helper that collects aliases from `responseId`, `metadata.responseId`, `result.responseId`, `result.metadata.responseId`, `modelMessageId`, request IDs, session IDs, model, and timestamp.
   - For VS Code sources (`vscode`, `vscode-chat`), identity should prefer canonical response aliases and should not include token buckets.
   - Preserve alias list in diagnostics or metadata so repair/report details can explain the merge.

5. Add duplicate repair.
   - Group candidate VS Code rows by canonical response alias first, then by session/model/timestamp proximity when response aliases are missing.
   - Merge evidence into one survivor row, relink `label_evidence`, and delete duplicate rows.
   - Run repair after import refreshes and expose a count in import/report results.

6. Add targeted refresh/progress.
   - Prefer changed files based on checkpoint/high-water/mtime where available.
   - If broad discovery scans many VS Code session files, expose diagnostics in human/JSON output so the command is not silently doing a long scan.

## Validation Architecture

The validation must prove selected-price semantics and dedupe behavior, not just schema existence.

- Unit tests in `test/ingest.test.js`:
  - actual charge selects actual over displayed and estimate.
  - displayed `0.8 credits` selects 0.8 while retaining a higher token estimate.
  - displayed `0x` selects 0 while retaining nonzero token diagnostics.
  - VS Code OTel/chat aliases merge despite top-level vs metadata response ID differences.
  - old token-bucket identity rows repair into one row.

- Report tests in `test/report.test.js`:
  - label/model/repo/detail JSON primary totals use selected credits.
  - human tables use selected totals and compact basis markers.
  - repeated `report --refresh` is idempotent and reports repair/refresh diagnostics.

- Smoke/release checks:
  - `npm test`
  - `npm run check`
  - `npm run smoke`
  - `npm run verify:package`
  - `npm run check:readme-version`

## Risks

- Renaming existing `estimated_*` report fields would break downstream consumers. Prefer adding selected fields while keeping existing diagnostic estimate fields.
- Repair must not discard label evidence or raw records. Relink and preserve diagnostics before deleting duplicate usage rows.
- Timestamp-proximity matching can over-merge unrelated requests. Use it only when session ID and model match and timestamps are close; response aliases should be stronger.
- Existing stores with stale estimates may need both cost repair and duplicate repair. Import bookkeeping should not prevent repair from running.

