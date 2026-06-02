# Phase 8: 0.1.9 Better pricing estimates - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship `copilot-metrics@0.1.9` with pricing reports that use the strongest observed local pricing evidence when present, compute high-confidence estimates when token and price buckets are complete, and explicitly label upper-bound estimates when cache-read counts are missing. This phase changes local import/storage/report semantics only; official GitHub billing remains out of scope.

</domain>

<decisions>
## Implementation Decisions

### Pricing Evidence Model
- Keep distinct fields for observed charge, estimated charge, upper-bound charge, confidence, pricing basis, and source evidence so actual evidence never overwrites estimates.
- Treat Copilot CLI `totalNanoAiu` as trusted observed local charge evidence when present. Preserve source/session/model provenance and surface it ahead of estimates, while still labeling it as local observed evidence rather than official billing authority.
- Prefer session-local token prices when present, including VS Code/Insiders model metadata and Copilot session pricing records; fall back to the static table with a clear static-pricing warning.
- Preserve `0x`, `multiplierNumeric: 0`, quota SKU, `requests.cost: 0`, and `totalPremiumRequests: 0` as inclusion or plan evidence, not as proof that token-level estimates are zero.

### Cache And Diagnostics Semantics
- Expose cache-read availability as `known`, `explicit_zero`, or `unknown`; `unknown` with prompt/output tokens produces upper-bound pricing semantics under the fully uncached input assumption.
- Store and report VS Code `cacheKey` and `cacheType` as diagnostics only; never convert them into numeric cache-read tokens.
- Import context utilization evidence only as redacted diagnostics, separate from billable token buckets.
- Redact auth-like values before persistence and output, with fixture tests for VS Code extension, AHP, agenthost, and hook-adjacent logs.

### Report Shape And Release Boundary
- Keep human reports compact by adding basis/confidence markers and aggregate actual/estimated/upper-bound totals without widening every table unnecessarily.
- Make JSON reports fully auditable for labels, models, repos, and details: actual charge, estimated charge, upper-bound charge, basis counts, confidence, cache state, source, session, request/exchange, and model evidence.
- Re-imported duplicate exchanges should keep one usage row and merge or preserve the strongest pricing evidence.
- Run repo-local verification through npm scripts and validate `copilot-metrics@0.1.9` from an isolated directory after publish.

### the agent's Discretion
Planner and implementer may choose exact column names, helper boundaries, warning codes, and report marker text as long as the semantics above are visible in tests and JSON output remains stable for downstream tooling.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/pricing.js` contains the static model pricing table and current advisory estimate calculation.
- `src/otel.js` normalizes OTel spans and Copilot CLI `session.shutdown` `modelMetrics` rows into usage records.
- `src/ingest.js` handles configured sources, fallback parsing, auto-import before reports, cost repair, and label evidence generation.
- `src/sqlite-store.js` owns schema migration, usage-row insertion, duplicate identity updates, label evidence, import warnings, and persisted checkpoints.
- `src/reports.js` owns label, model, repo, detail, and unattributed report queries plus compact human formatting.
- `src/cli.js` wires report auto-import diagnostics into both JSON and human report output.
- Existing fixtures already cover OTel token categories, Copilot CLI session shutdown metrics, VS Code fallback sessions, duplicate fallback imports, and VS Code log diagnostics.

### Established Patterns
- The project is CommonJS and uses fixture-based `node:test` coverage.
- Store migrations use `addColumnIfMissing` in `initStore`, preserving existing local SQLite files.
- Reports initialize the store before querying and support both human-readable and JSON output.
- Cost output is advisory and should not imply official billing authority.
- Content capture is disabled by default; prompt-like fields may be used transiently for labels but should not be persisted in full.
- Custom label extractors override the built-in Jira extractor when configured.

### Integration Points
- Extend usage normalization to carry pricing evidence, cache availability, and diagnostic metadata from OTel, Copilot CLI session logs, VS Code chat session fallback, and VS Code diagnostics logs.
- Extend store schema and duplicate update paths so observed charges and session-local price metadata survive re-imports and source dedupe.
- Extend estimate calculation to classify high-confidence, upper-bound, unknown-price, included/zero, and conflict cases.
- Extend report queries and formatters to aggregate mixed pricing evidence without collapsing upper bounds into exact totals.
- Add privacy tests ensuring auth-like diagnostics are redacted before storage and output.

</code_context>

<specifics>
## Specific Ideas

Use `.planning/research/2026-06-02-pricing-evidence-local-logs.md` as implementation evidence. It records observed Copilot CLI `totalNanoAiu`, `requests.cost`, `totalPremiumRequests`, VS Code model pricing metadata, cache metadata, `multiplierNumeric: 0`, quota SKU, context utilization lines, and auth-token redaction risk without copying prompt or assistant content.

</specifics>

<deferred>
## Deferred Ideas

- Official GitHub usage report import and reconciliation.
- Network proxying, TLS interception, private API scraping, or any behavior that makes local estimates authoritative billing.
- Rich opt-in content archive and redaction tooling.
- Dashboard views.

</deferred>
