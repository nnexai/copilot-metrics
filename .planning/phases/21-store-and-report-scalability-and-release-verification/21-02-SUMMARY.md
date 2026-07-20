---
phase: 21-store-and-report-scalability-and-release-verification
plan: "02"
subsystem: storage-reports
tags: [sqlite, batching, reports, benchmarks, performance]
requires:
  - phase: 21-store-and-report-scalability-and-release-verification
    provides: Versioned store lifecycle and persistent hot-path indexes
provides:
  - Bounded set-based raw fingerprint and usage identity lookups
  - Exact insert-result evidence linkage with within-batch identity merging
  - Two-read shared label report context with manual-before-dedupe ranking
  - Deep semantic storage, report, ingest, and hook benchmark evidence
affects: [21-03, release-verification]
tech-stack:
  added: []
  patterns: [bounded SQLite IN chunks, batch-local identity maps, two-read report context, deep benchmark assertions]
key-files:
  created: []
  modified: [src/sqlite-store.js, src/reports.js, test/ingest.test.js, test/report.test.js, scripts/benchmark-storage.js, scripts/benchmark-reports.js]
key-decisions:
  - "Chunk deduplicated SQLite identity inputs at 400 values, leaving conservative headroom below bind limits."
  - "Build manual ranking assignments from raw join rows before deduplicating the usage aggregation copy."
  - "Compare optimized repeated opens against the same legacy maintenance workload on equivalent copied stores."
requirements-completed: [STR-03, REP-02, VER-02]
coverage:
  - id: D1
    description: Large and repeated import identities use bounded set-based reads and exact insert-result IDs without changing merge or evidence behavior.
    requirement: STR-03
    verification:
      - kind: integration
        ref: "test/ingest.test.js#fingerprint batch lookup handles large duplicate input sets"
        status: pass
      - kind: integration
        ref: "test/ingest.test.js#identity batch merges within-batch duplicates using exact inserted IDs and stronger pricing"
        status: pass
    human_judgment: false
  - id: D2
    description: One evidence read and one raw manual join supply every label report while preserving multiple manual labels and deep outputs.
    requirement: REP-02
    verification:
      - kind: integration
        ref: "test/report.test.js#report context reads evidence and raw manual joins exactly once"
        status: pass
      - kind: integration
        ref: "test/report.test.js#shared label report context preserves report semantics"
        status: pass
    human_judgment: false
  - id: D3
    description: Storage, reports, incremental ingestion, and hook startup benchmarks block on semantic equivalence before reporting timings.
    requirement: VER-02
    verification:
      - kind: integration
        ref: "npm run benchmark:storage -- 1000"
        status: pass
      - kind: integration
        ref: "npm run benchmark:reports"
        status: pass
      - kind: integration
        ref: "npm run benchmark:ingest -- 2000 10"
        status: pass
      - kind: integration
        ref: "npm run benchmark:hooks -- 5"
        status: pass
    human_judgment: false
duration: 12min
completed: 2026-07-20
status: complete
---

# Phase 21 Plan 02: Batched Imports and Shared Reports Summary

**Bounded identity reads, exact insert-result linkage, a two-read label context, and deep semantic benchmarks make large imports and repeated reports scale without observable drift.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-20T10:20:00Z
- **Completed:** 2026-07-20T10:32:39Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Replaced raw-fingerprint and usage-identity N+1 lookups with deduplicated, bounded `IN` batches and a batch-local survivor map.
- Linked label evidence from each successful statement's exact `lastInsertRowid`, explicitly handling ignored inserts without stale IDs.
- Reduced shared label report construction from four source reads to exactly two while retaining both manual labels before usage deduplication.
- Expanded storage/report benchmarks to deep-assert migration, maintenance, batch-import, report, human, JSON, incremental-ingest, and hook equivalence.

## Task Commits

1. **Task 1: Batch import identities and use exact insert run results** — `b31c413` (RED), `b122928` (GREEN)
2. **Task 2: Build rankings and report rows from one evidence read and one manual join** — `970d312` (RED), `e5a4cec` (GREEN)
3. **Task 3: Extend storage and report benchmarks with blocking semantic equivalence** — `6262632` (performance)

## Files Created/Modified

- `src/sqlite-store.js` — Chunked identity reads, batch-local usage survivors, exact run-result IDs, and a narrow legacy-maintenance benchmark seam.
- `src/reports.js` — One evidence/usage read plus one raw manual join for shared report context.
- `test/ingest.test.js` — Large fingerprint and within-batch stronger-pricing/evidence regressions.
- `test/report.test.js` — Exact two-read instrumentation and complete context/standalone comparisons.
- `scripts/benchmark-storage.js` — Migration, repeated-open, legacy-maintenance, and mixed-import semantic/timing evidence.
- `scripts/benchmark-reports.js` — Deep public object, human, JSON, inclusion-mode, manual, and historical-dedupe equivalence.

## Decisions Made

- Used 400-value chunks so source/file predicates and future query additions retain safe SQLite bind headroom.
- Kept the existing deduped `manualRows` public context key, while deriving `manualAssignments` from raw rows first so ranking cannot lose a second label.
- Exposed legacy maintenance only as `_benchmarkLegacyMaintenance`; production initialization remains migration-driven.

## Verification

- `node --test test/ingest.test.js test/report.test.js` — passed, 81/81 tests.
- `npm test` — passed, 127/127 tests.
- `npm run check` — passed.
- `git diff --check` — passed.
- All four milestone benchmarks passed semantic assertions; measured repeated-open speedup was 7.38x, report context-backed speedup 8.02x, incremental ingestion speedup 19.71x, and hook startup speedup 1.53x on this machine.

## TDD Gate Compliance

- Task 1: RED `b31c413`, GREEN `b122928`.
- Task 2: RED `970d312`, GREEN `e5a4cec`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Test instrumentation initially counted one schema/index preparation alongside each batched query family; bounds were calibrated to include that fixed setup read while still rejecting per-record behavior.

## User Setup Required

None.

## Next Phase Readiness

- Plan 21-03 can prepare v0.7.0 release metadata and run the complete release-candidate gate.
- No blockers or deferred issues.

## Self-Check: PASSED

- All six implementation/test/benchmark files and this summary exist.
- All five TDD/performance commits resolve in repository history.
- Full tests, syntax checks, four benchmarks, and whitespace checks pass.

---
*Phase: 21-store-and-report-scalability-and-release-verification*
*Completed: 2026-07-20*
