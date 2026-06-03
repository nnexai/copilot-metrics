# Phase 14: v0.4.0 confidence-aware label reports - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase changes label report semantics to use Phase 13 confidence rankings. Overview reports should count each session once under the top-ranked label by default. Specific-label reports should include only rank-1 sessions by default, with explicit top-k/all-match flags for broader overlapping inclusion. It also adds a per-session middle-detail view.

</domain>

<decisions>
## Implementation Decisions

### Default Report Semantics
- `report labels` defaults to top-1 label assignment: each ranked session contributes to exactly one label.
- Evidence-only labels remain visible when they are top-ranked for their evidence session, with zero token totals and evidence-only status.
- JSON should explicitly expose inclusion metadata such as `inclusion_mode: "top-label"` and `overlap: false`.
- Human output does not need extra noise for the default top-1 behavior; add only concise wording if needed for clarity.

### Specific Label Top-K
- `report label <id>` defaults to sessions where the requested label is rank 1.
- Add `--top-k <n>` to include sessions where the requested label ranks within K.
- Add broad all-match compatibility through `--top-k all` or `--all-matches`.
- JSON should mark broad reports as `inclusion_mode: "top-k"` or equivalent and `overlap: true`.

### Middle-Detail View
- Add `--session-detail` for one row per included session, separate from existing evidence-row `--detail`.
- Each row should include session ID/key, aggregate tokens, selected USD/credits, pricing basis, top label, requested label rank, confidence score, evidence count, and compact evidence summary.
- Session-detail aggregates across models but should include model count/list so it does not imply one model.
- Scope `--session-detail` to specific-label reports in Phase 14.

### Compatibility and Tests
- Existing `--detail` remains evidence/detail rows, filtered by the same inclusion mode as the label query.
- `--all-matches` is the explicit broad/legacy-overlap path.
- JSON structure should add report-level `inclusion` metadata and row-level confidence/rank fields while preserving existing numeric fields where possible.
- Tests should cover human and JSON output for overview top-label-only, label default rank-1, top-k, all-matches, and session-detail.

### the agent's Discretion
Reuse Phase 13 `label-confidence` helpers. Keep report SQL and aggregation understandable, even if some aggregation is easier in JavaScript after fetching usage/evidence rows.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/label-confidence.js` produces per-session rankings and label confidence summaries.
- `src/reports.js` owns label overview, label summary, label details, model breakdowns, and human formatting.
- `src/cli.js` owns report flag parsing and JSON payload shape.
- `test/report.test.js` already exercises CLI JSON and human report flows.

### Established Patterns
- CLI report commands auto-import configured sources before querying.
- JSON payloads wrap report rows under report-specific keys and diagnostics.
- Human output uses compact tables and short explanatory footers.

### Integration Points
- `report labels --json` should include top-label inclusion metadata.
- `report label <id> --json` should include inclusion metadata and rank-filtered totals.
- `--detail` and `--session-detail` should respect the selected inclusion mode.

</code_context>

<specifics>
## Specific Ideas

Default top-1 behavior should not require a noisy human-output warning because top-k/all-match modes require explicit flags.

</specifics>

<deferred>
## Deferred Ideas

Configurable scoring weights and manual label pinning remain future work.

</deferred>
