# Phase 17: File-Backed SQLite Storage - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the repeated full-file `sql.js` store load/export pattern with a file-backed SQLite storage path while preserving the existing store API and behavior. This phase covers backend storage mechanics, storage equivalence tests, package/native dependency validation, and a representative storage benchmark. It does not implement refresh source-skipping, refresh batching, report query caching, label ranking changes, or release publishing.

</domain>

<decisions>
## Implementation Decisions

### the agent's Discretion
All implementation choices are at the agent's discretion - this is an infrastructure storage migration. Use the ROADMAP goal, PERF-01 through PERF-04, existing store facade contracts, and the Phase 17 plans to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/sqlite-store.js` is the public storage facade used by setup, ingestion, labels, reports, and repair helpers.
- `src/ingest.js` owns source discovery/parsing and should keep file IO outside storage transactions.
- `src/reports.js` and `src/cli.js` depend on stable async store helpers and report semantics.
- Existing tests in `test/ingest.test.js`, `test/report.test.js`, and `test/setup.test.js` provide fixture patterns for equivalence coverage.
- Existing package checks live in `scripts/verify-package.js`; performance spike evidence lives under `.planning/spikes/001-sqlite-performance/`.

### Established Patterns
- Use Node.js, npm scripts, fixture-based `node:test` coverage, and local temp homes for CLI/storage verification.
- Preserve central user-level storage defaults and owner-local file permissions where supported.
- Keep report output semantics unchanged: selected pricing, top-label defaults, manual-label precedence, diagnostics, and JSON contracts must remain stable.
- Prefer prepared statements and bound parameters for labels, paths, session IDs, diagnostics, and report filters.

### Integration Points
- `package.json` and `package-lock.json` will carry the runtime native dependency and verification scripts.
- `scripts/verify-native-sqlite-package.js` should validate packed-package install and CLI behavior from a neutral temp directory.
- `scripts/benchmark-storage.js` should benchmark representative storage write/checkpoint work without absorbing Phase 18 or Phase 19 scope.

</code_context>

<specifics>
## Specific Ideas

No additional user requirements - follow the existing Phase 17 plans and keep performance work behavior-preserving.

</specifics>

<deferred>
## Deferred Ideas

- Refresh source-skipping and import batching remain Phase 18.
- Report query/ranking reuse and release publishing remain Phase 19.

</deferred>
