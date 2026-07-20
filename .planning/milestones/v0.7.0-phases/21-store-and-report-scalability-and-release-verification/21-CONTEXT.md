# Phase 21: Store and Report Scalability and Release Verification - Context

**Gathered:** 2026-07-20
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss defaults informed by measured store/query research

<domain>
## Phase Boundary

Make repeated store access, large imports, and label reports proportional to necessary work, then prepare and verify the v0.7.0 release. Preserve selected pricing, attribution, confidence, manual-label precedence, diagnostics, ordering, privacy, and all human/JSON output contracts.

</domain>

<decisions>
## Implementation Decisions

### Store lifecycle and repair gating
- Use ordered, transactional schema/data migrations that can bootstrap existing unversioned stores safely.
- Run legacy duplicate cleanup before creating uniqueness indexes, record a migration only after the complete transaction succeeds, and reject unsupported future schema versions explicitly.
- Persist versioned repair markers for historical cost and usage-deduplication repairs. Run a repair only when its marker is stale or a relevant import/backfill mutation requires it.
- An unchanged report/import path must not rerun schema probes, legacy cleanup, historical cost scans, or duplicate scans.

### Set-based import behavior
- Batch raw-fingerprint and usage-identity lookups within SQLite bind limits and preserve within-batch duplicate behavior.
- Use `better-sqlite3` run results for inserted row IDs; avoid `last_insert_rowid()` queries and stale IDs after ignored inserts.
- Preserve stronger-pricing merges, evidence links, stable survivor IDs, counts, warning behavior, and every existing uniqueness contract.

### Persistent query indexes
- Add only indexes justified by representative `EXPLAIN QUERY PLAN` evidence for label, session, manual-label, and VS Code backfill lookups.
- Tests must assert named-index use and reject automatic indexes/full scans on the targeted hot paths.
- Accept bounded index write/storage overhead; do not add speculative indexes for whole-table aggregate scans.

### Shared label report context
- Build label ranking/details from one evidence-plus-usage read and manual report data from one raw manual join.
- Derive manual assignments before usage deduplication so multiple manual labels on one usage remain visible.
- Preserve deterministic row ordering and deep-equivalent overview, summary, models, details, session details, top-k/all-match, manual-only, and historical-deduplication output.

### Benchmarks and release
- Extend repeatable benchmarks for one-time migration, repeated initialized-store access, batch import, and report-context performance.
- Semantic/deep-output equivalence is blocking; elapsed time is machine-dependent evidence without brittle thresholds.
- Prepare v0.7.0 metadata and run every local release gate, including native SQLite verification and package-content checks.
- Push `main`, create GitHub release `v0.7.0`, wait for the publish workflow, then verify the registry and isolated `npx` commands. Never claim release success before npm confirms it.

### Privacy and compatibility
- Content capture remains disabled and no benchmark/fixture may persist prompt or response content.
- Existing unversioned stores, current configured sources, CLI commands, JSON schemas, human formatting, and setup flows remain supported.

</decisions>

<specifics>
## Measured Baseline and Target Evidence

- Repeated initialization on a synthetic 10k-row current store measured roughly 10-13 ms per call because schema probes and duplicate cleanup run each time.
- Current query plans show full scans for label/session lookups, an automatic index for manual joins, and a usage scan in VS Code backfill.
- Existing report benchmark measured a 3.25x shared-context improvement but checks output shape rather than deep equality; Phase 21 must strengthen it.
- Phase 20 benchmark evidence must remain part of the final verification matrix.

</specifics>

<deferred>
## Deferred Ideas

- Background services, concurrent parsing, new providers, dashboard work, pricing changes, and report feature changes remain outside v0.7.0.
- Full database connection pooling is unnecessary for this local serialized CLI unless benchmarks prove it is required.

</deferred>

---

*Phase: 21-store-and-report-scalability-and-release-verification*
*Context gathered: 2026-07-20*
