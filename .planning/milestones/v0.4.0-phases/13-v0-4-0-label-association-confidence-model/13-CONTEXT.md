# Phase 13: v0.4.0 label association confidence model - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase preserves granular label association evidence and adds deterministic confidence ranking over that evidence. It must not aggregate too early: each evidence entry should remain inspectable so scoring algorithms can change later without losing source detail. Phase 14 will change default report aggregation semantics.

</domain>

<decisions>
## Implementation Decisions

### Association Storage
- Extend existing label evidence storage rather than creating a lossy aggregate-only store.
- Keep evidence per entry and aggregate based on the selected confidence algorithm at query/report time.
- Deduplicate by label, session, usage linkage, source type, source field, and source value so re-imports do not inflate confidence.
- Add a lightweight repair/normalization path for existing evidence when needed.
- JSON inspection should expose source field/type/value, distinct evidence count, score contribution, and rank inputs.

### Confidence Scoring
- Compute scores from stored per-entry evidence when queried or when import summaries need them; do not persist final scores as the only truth.
- Initial source weights: cwd/folder and branch very high, metadata/session context high, prompt/response/tool-call lower but accumulating.
- Repeated distinct evidence entries should help with bounded accumulation; identical replayed evidence should not inflate scores.
- Tie-breaking should be deterministic: score, strongest evidence weight, distinct evidence count, first-seen timestamp/session order, then label alphabetically.

### Compatibility and Migration
- Keep current human report totals stable in Phase 13; Phase 14 changes default aggregation semantics.
- Schema changes must be additive or repairable so existing stores continue opening.
- Include scoring version/basis in JSON output so future algorithms can coexist or be compared.
- Custom extractor evidence participates in ranking using provided confidence/source fields when present and defaults otherwise.

### User-Facing Inspection
- Add machine-readable ranking/evidence fields to existing JSON label-related report payloads.
- Keep human report semantics minimal or unchanged until Phase 14.
- Evidence summaries should explain the winner with rank, score, scoring version, strongest source types, distinct evidence count, and compact source summaries.
- Required tests cover branch/folder dominance, accumulated lower-weight evidence, duplicate evidence de-dupe, deterministic ties, and JSON-visible rank details.

### the agent's Discretion
Prefer small, additive modules and report helpers that can be reused by Phase 14. Keep scoring data derived from granular evidence rather than prematurely materialized aggregates.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/sqlite-store.js` owns schema creation and migrations.
- `src/ingest.js` writes usage rows, hook rows, and label evidence.
- `src/reports.js` builds label overview, label detail, and JSON/human report payloads.
- `src/label-extractors.js` already normalizes source fields and per-entry confidence values.

### Established Patterns
- Report functions return plain objects or arrays that CLI wraps in JSON when requested.
- Tests use fixture ingestion into temporary SQLite stores and assert structured JSON-like results.
- Store migrations are additive and idempotent.

### Integration Points
- Confidence ranking should consume existing `label_evidence` rows.
- JSON report payloads for `report labels` and `report label <id>` should include ranking/evidence metadata without changing human totals.
- Phase 14 can reuse the same ranking helper to implement top-label and top-k report semantics.

</code_context>

<specifics>
## Specific Ideas

Do not store only final confidence scores. Preserve per-entry evidence and compute aggregate scores from the active algorithm/version.

</specifics>

<deferred>
## Deferred Ideas

Default top-label overview semantics, label top-k inclusion, and middle-detail human report views are deferred to Phase 14.

</deferred>
