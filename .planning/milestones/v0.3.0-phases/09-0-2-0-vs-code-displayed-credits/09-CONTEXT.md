# Phase 9: 0.2.0 VS Code displayed credits - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship `copilot-metrics@0.2.0` with VS Code and VS Code Insiders chat-session displayed-credit parsing. When no stronger actual charge evidence exists, displayed credits such as `0.8 credits`, `0.8 credit`, and `0x` become the selected local pricing basis before complete or upper-bound token estimates. This remains advisory local evidence, not official GitHub billing authority.

</domain>

<decisions>
## Implementation Decisions

### Displayed-Credit Evidence Model
- Parse displayed credits from VS Code chat-session `result.details` and equivalent request/result/metadata locations without persisting prompt or assistant text.
- Store displayed-credit amount, original display text, source/session/request/response evidence, import timestamp, and diagnostics separately from actual charge fields and token-price estimates.
- Treat `0x` as included/zero displayed evidence, not as unknown pricing or an estimate failure.
- Keep actual charge evidence such as Copilot CLI `totalNanoAiu` stronger than displayed-credit evidence.

### Pricing Precedence And Diagnostics
- Select pricing basis in this order: actual, displayed-credit, high-confidence token estimate, upper-bound token estimate, included/zero, unknown price.
- Preserve comparable token estimates even when displayed credits win, so reports can show conflicts and diagnostics.
- When displayed credits are lower than uncached token pricing and cache-read pricing is known, derive bounded effective cache-read tokens as an inferred diagnostic only; never populate observed `cache_read_tokens` from this calculation.
- Add material conflict diagnostics when displayed credits differ substantially from token estimates while keeping both values visible.

### Report And Refresh Semantics
- JSON reports for labels, label details, models, repos, and unattributed usage should expose displayed-credit fields, inferred-cache fields, pricing basis, confidence, and source/session evidence.
- Human reports should stay compact and show displayed-credit basis with a short marker, while marking inferred fields with `*` or equivalent.
- Re-running reports with `--refresh` should merge displayed-credit evidence into matching existing usage rows and upgrade prior upper-bound rows without double-counting.
- Keep versioned release docs in sync with `package.json` and validate repo-local npm scripts before external publish validation.

### the agent's Discretion
Planner and implementer may choose exact helper names, SQL column names, marker text, and warning code names as long as the basis precedence, evidence separation, privacy defaults, and fixture tests prove the required semantics.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/ingest.js` already parses VS Code chat-session fallback records, extracts session/request metadata, applies debug-log cache evidence, and supports `--refresh` re-import.
- `src/pricing.js` owns actual/estimated/upper-bound basis classification and session-local price handling.
- `src/sqlite-store.js` owns schema migrations plus duplicate `usage_identity` merge behavior for stronger pricing evidence.
- `src/reports.js` owns label, model, repo, detail, and unattributed report JSON fields plus compact human tables.
- Existing tests cover VS Code fallback usage, session-local prices, upper-bound cache-unknown pricing, debug-log cache upgrades, duplicate merge, and report refresh.

### Established Patterns
- CommonJS modules, fixture-based `node:test`, and npm verification scripts.
- Store schema evolves through `addColumnIfMissing` so existing user stores migrate in place.
- Report JSON is the stable machine-readable surface; human reports remain dense and compact.
- Full prompt content remains transient for labels and must not be persisted by default.
- Custom extractors override the built-in Jira extractor when configured.

### Integration Points
- Extend VS Code fallback request merge to carry displayed-credit evidence from request/result/details metadata.
- Extend pricing classification to select displayed credits between actual evidence and token estimates.
- Extend duplicate merge and repair paths to preserve/upgrade displayed-credit fields and inferred diagnostics.
- Extend report SQL and formatters to include displayed and inferred fields across label/model/repo/detail surfaces.

</code_context>

<specifics>
## Specific Ideas

Use `.planning/research/2026-06-02-vscode-chronicle-session-indexing.md` for observed VS Code chat-session detail shapes. Continue Phase 8's distinction between actual local charge evidence, advisory estimates, upper bounds, and diagnostics.

</specifics>

<deferred>
## Deferred Ideas

- Chronicle/session-store metadata as an attribution source.
- Official billing API reconciliation.
- Treating VS Code `cacheKey` or `cacheType` as numeric cache reads.
- Rich opt-in content archive and redaction tools.

</deferred>
