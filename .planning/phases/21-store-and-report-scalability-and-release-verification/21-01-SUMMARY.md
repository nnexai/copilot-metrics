---
phase: 21-store-and-report-scalability-and-release-verification
plan: "01"
subsystem: storage
tags: [sqlite, migrations, repair-markers, indexes, performance]
requires:
  - phase: 20-incremental-jsonl-and-lightweight-collection
    provides: Incremental imports and mutation/result counters
provides:
  - Transactional ordered SQLite schema migrations for new and unversioned stores
  - Durable, mutation-aware historical repair markers with retry semantics
  - Query-plan-proven persistent indexes for label, session, and VS Code backfill lookups
affects: [21-02, reports, import-performance, release-verification]
tech-stack:
  added: []
  patterns: [SQLite user_version migrations, transactional repair markers, EXPLAIN QUERY PLAN regression tests]
key-files:
  created: []
  modified: [src/sqlite-store.js, src/ingest.js, test/storage-backend.test.js, test/ingest.test.js]
key-decisions:
  - "Use SQLite user_version for ordered schema lifecycle and store_metadata only for non-schema maintenance state."
  - "Invalidate repair markers inside the same mutation transaction that inserts, merges, or backfills relevant usage."
  - "Add only four indexes selected by representative production query shapes."
patterns-established:
  - "Each schema migration commits its version only after all cleanup, DDL, and indexes succeed."
  - "Repair wrappers check a durable version before scanning and mark completion only after successful repair."
requirements-completed: [STR-01, STR-02, REP-01]
coverage:
  - id: D1
    description: New and unversioned stores migrate transactionally while current and future-version stores take safe deterministic paths.
    requirement: STR-01
    verification:
      - kind: integration
        ref: "test/storage-backend.test.js#schema migration lifecycle tests"
        status: pass
    human_judgment: false
  - id: D2
    description: Cost and duplicate repairs use retryable durable markers and unchanged refreshes perform no candidate scans.
    requirement: STR-02
    verification:
      - kind: integration
        ref: "test/ingest.test.js#unchanged configured-source refresh does not scan repair candidates"
        status: pass
      - kind: integration
        ref: "test/storage-backend.test.js#usage duplicate repair marker gates scans and repair retry after failure"
        status: pass
    human_judgment: false
  - id: D3
    description: Label, manual-session, and VS Code backfill queries select named persistent indexes without automatic indexes or targeted scans.
    requirement: REP-01
    verification:
      - kind: integration
        ref: "test/storage-backend.test.js#query plan uses named indexes for label lookup and manual join index"
        status: pass
      - kind: integration
        ref: "test/storage-backend.test.js#VS Code backfill index query plans avoid targeted scans and automatic indexes"
        status: pass
    human_judgment: false
duration: 9min
completed: 2026-07-20
status: complete
---

# Phase 21 Plan 01: Versioned Store Maintenance Summary

**Transactional store migrations, durable repair gating, and named hot-path indexes remove repeated maintenance scans without changing persisted usage semantics.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-20T10:15:18Z
- **Completed:** 2026-07-20T10:23:49Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Replaced every-open schema probing and legacy duplicate cleanup with ordered `PRAGMA user_version` migrations that bootstrap existing unversioned databases transactionally.
- Added durable cost and duplicate-usage repair versions, with invalidation tied to actual usage insertion, merge, and VS Code response-ID backfill mutations.
- Added label, usage-session, raw source/file/line, and usage source/raw-line/span indexes proven against representative production query shapes.

## Task Commits

1. **Task 1: Replace repeated schema probes with ordered transactional migrations** — `f52f031` (RED), `c3c80f6` (GREEN)
2. **Task 2: Gate historical repairs with durable versions and real mutations** — `295abad` (RED), `cba4ab0` (GREEN)
3. **Task 3: Add only query-plan-proven persistent indexes** — `99bf46e` (RED), `8d4baaa` (GREEN)

## Files Created/Modified

- `src/sqlite-store.js` — Ordered migrations, repair metadata helpers, mutation invalidation, gated duplicate repair, and persistent indexes.
- `src/ingest.js` — Gated cost repair and scan instrumentation propagated through configured-source imports.
- `test/storage-backend.test.js` — Migration adversaries, repair retry/marker cases, and representative query-plan fixtures.
- `test/ingest.test.js` — Cost marker retry and unchanged configured-refresh scan gating.

## Decisions Made

- Used schema version 1 to normalize all historical schema/cleanup behavior and schema version 2 for measured hot-path indexes, so already-current databases upgrade in order.
- Kept repair markers separate from schema versioning because imports can invalidate maintenance state without changing schema.
- Allowed the small manual-assignment side of the manual join to scan while requiring the large usage side to use `idx_usage_records_session`.

## Verification

- `node --test test/storage-backend.test.js test/ingest.test.js` — passed, 66/66 tests.
- `npm test` — passed, 124/124 tests.
- `npm run check` — passed syntax validation.
- `git diff --check` — passed.
- Representative query plans name all four new indexes and contain no automatic index or targeted large-side scan.

## TDD Gate Compliance

- Task 1: RED `f52f031`, GREEN `c3c80f6`.
- Task 2: RED `295abad`, GREEN `cba4ab0`.
- Task 3: RED `99bf46e`, GREEN `8d4baaa`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- SQLite correctly preferred a raw-record scan when the first backfill fixture placed every row in the selected file. The representative fixture was corrected to model multiple source files; the production query then selected the intended source/file/line index.

## User Setup Required

None - existing unversioned stores upgrade automatically on first open.

## Next Phase Readiness

- Plan 21-02 can batch fingerprint/identity lookups and consolidate report context on top of stable indexes and mutation counters.
- No blockers or deferred issues.

## Self-Check: PASSED

- All four implementation/test files and this summary exist.
- All six TDD task commits resolve in repository history.
- Full tests, syntax checks, and whitespace checks pass.

---
*Phase: 21-store-and-report-scalability-and-release-verification*
*Completed: 2026-07-20*
