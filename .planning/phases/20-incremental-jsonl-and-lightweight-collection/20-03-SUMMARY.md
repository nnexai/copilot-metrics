---
phase: 20-incremental-jsonl-and-lightweight-collection
plan: "03"
subsystem: ingestion
tags: [vscode, debug-logs, jsonl, caching, benchmarks]
requires:
  - phase: 20-01
    provides: Complete-line byte checkpoints and incremental recovery contracts
  - phase: 20-02
    provides: Dedicated lightweight hook executable and startup benchmark
provides:
  - Import-scoped VS Code debug sidecar resolution and parse caching
  - Complete Phase 20 fixture matrix for ingestion recovery, hook output, privacy, and debug reuse
  - Machine-readable incremental ingestion and hook startup npm benchmarks
affects: [phase-20-verification, phase-21-benchmarks, release-verification]
tech-stack:
  added: []
  patterns: [import-scoped positive-and-negative cache, semantic-equivalence performance harness]
key-files:
  created: [scripts/benchmark-incremental-jsonl.js]
  modified: [src/ingest.js, test/ingest.test.js, test/setup.test.js, package.json]
key-decisions:
  - "Scope VS Code debug caches to one source import and key parsed results by resolved sidecar path."
  - "Make benchmark correctness assertions blocking while treating elapsed timings as machine-dependent evidence."
patterns-established:
  - "Sidecar enrichment caches both evidence and absence without overriding known or explicit-zero token evidence."
  - "Performance benchmarks compare persisted semantic snapshots, not only row counts or timing."
requirements-completed: [COL-02, VER-01]
coverage:
  - id: D1
    description: Each resolved VS Code debug sidecar is parsed once per source import and enriches every eligible usage row without leaking payload content.
    requirement: COL-02
    verification:
      - kind: integration
        ref: "test/ingest.test.js#VS Code debug log is parsed once per import and enriches every eligible usage row"
        status: pass
      - kind: unit
        ref: "test/ingest.test.js#VS Code debug cache preserves explicit evidence and caches absent results"
        status: pass
    human_judgment: false
  - id: D2
    description: Phase 20 fixtures cover append, unchanged, truncation, replacement, malformed and partial lines, legacy checkpoints, generated hooks, privacy, and debug reuse.
    requirement: VER-01
    verification:
      - kind: integration
        ref: "node --test test/ingest.test.js test/setup.test.js"
        status: pass
    human_judgment: false
  - id: D3
    description: Incremental ingestion and hook startup benchmarks emit machine-readable equivalence and performance evidence.
    requirement: VER-01
    verification:
      - kind: other
        ref: "npm run benchmark:ingest -- 2000 10"
        status: pass
      - kind: other
        ref: "npm run benchmark:hooks -- 5"
        status: pass
    human_judgment: false
duration: 6min
completed: 2026-07-20
status: complete
---

# Phase 20 Plan 03: Debug Reuse and Verification Benchmarks Summary

**Import-scoped VS Code debug reuse plus semantic-equivalence benchmarks close Phase 20 with complete recovery, privacy, and compatibility coverage.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-20T09:33:13Z
- **Completed:** 2026-07-20T09:39:04Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Parsed each resolved VS Code debug sidecar at most once per import, including positive and absent evidence, while preserving explicit cache-read evidence.
- Completed the fixture matrix with an end-to-end execution of setup-generated hook configuration and persisted privacy assertions.
- Added repeatable npm benchmarks that block on usage, evidence, warning, and raw-record equivalence while reporting bytes read and elapsed timings.

## Task Commits

Each task was committed atomically:

1. **Task 1: Cache resolved VS Code debug evidence once per import** - `68b1bef` (RED tests), `3df4964` (GREEN performance implementation)
2. **Task 2: Complete the fixture-backed Phase 20 verification matrix** - `1fd7e7f` (test-only regression coverage)
3. **Task 3: Add incremental refresh benchmark and npm verification entrypoints** - `f94d8f7` (performance harness)

## Files Created/Modified

- `src/ingest.js` - Import-scoped resolution and parsed-result caches with an injectable test seam.
- `test/ingest.test.js` - Multi-request one-parse, persisted evidence, absence, precedence, and privacy coverage.
- `test/setup.test.js` - Execution of the actual setup-generated lightweight hook command with redaction assertions.
- `scripts/benchmark-incremental-jsonl.js` - Deterministic appended-byte versus clean complete-import benchmark.
- `package.json` - `benchmark:ingest` and `benchmark:hooks` npm entrypoints.

## Decisions Made

- Kept caches local to `applyVscodeDebugCachedTokens`, so every source-file import sees sidecar changes while repeated records share work.
- Cached resolved paths separately from parsed sidecar results, allowing multiple records and aliases to reuse positive or absent evidence safely.
- Compared stable persisted semantics and excluded source-path-dependent fingerprints from cross-file equality while still asserting raw-record counts.

## Verification

- `node --test test/ingest.test.js test/setup.test.js` - passed, 79/79 tests.
- `npm run benchmark:ingest -- 2000 10` - equivalent 2,010-row stores; 3,720 incremental bytes versus 745,730 complete bytes; 15.636x measured speedup.
- `npm run benchmark:hooks -- 5` - equivalent output; 1.382x measured median startup speedup.
- `npm test` - passed, 110/110 tests.
- `npm run check` - passed syntax checks.
- `git diff --check` - passed.

## TDD Gate Compliance

- Task 1 used explicit RED (`68b1bef`) then GREEN (`3df4964`) commits.
- Task 2 only extended tests for already-delivered Plan 20-01/20-02 behavior, so its fixture assertions passed on first execution and required no production change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Preserved milestone phase counts during plan state advancement**
- **Found during:** Plan close-out
- **Issue:** `state.update-progress` inferred one total/completed phase from the newly complete plan summaries, despite the roadmap defining two phases and Phase 20 still awaiting verification.
- **Fix:** Restored the roadmap-defined two-phase milestone count, kept completed phases at zero until verification, restored the progress field, and normalized decision prefixes emitted without phase context.
- **Files modified:** `.planning/STATE.md`
- **Verification:** State now reports Phase 20 ready for verification, Plan 3/3, and milestone phase counts 0/2.
- **Committed in:** Plan metadata commit

---

**Total deviations:** 1 auto-fixed (1 blocking issue).
**Impact on plan:** Planning metadata remains consistent with the two-phase roadmap; implementation scope is unchanged.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 20 input-side performance requirements and verification coverage are complete.
- Phase 21 can optimize store maintenance and report queries against the established semantic-equivalence benchmark pattern.
- No blockers or deferred issues.

## Self-Check: PASSED

- All five implementation/test/benchmark artifacts exist.
- All four task commits resolve in repository history.
- Plan-wide functional, benchmark, syntax, and whitespace verification passed.

---
*Phase: 20-incremental-jsonl-and-lightweight-collection*
*Completed: 2026-07-20*
