---
phase: 20-incremental-jsonl-and-lightweight-collection
plan: "01"
subsystem: ingestion
tags: [jsonl, incremental-io, checkpoints, utf8, sqlite]

requires:
  - phase: 18-refresh-import-batching
    provides: batched import mutation and unchanged-file checkpoint behavior
provides:
  - Byte-range JSONL parsing bounded by complete newline checkpoints
  - Versioned ingestion checkpoint validation and safe reset behavior
  - Database-level equivalence coverage for privacy, attribution, warnings, and deduplication
affects: [20-02, 20-03, phase-21-benchmarks]

tech-stack:
  added: []
  patterns: [bounded synchronous chunk reads, versioned JSONL checkpoint context, stable file identity validation]

key-files:
  created: []
  modified: [src/jsonl.js, src/ingest.js, test/ingest.test.js]

key-decisions:
  - "Store JSONL resume state under context.jsonl version 1 with byte_offset and completed_lines."
  - "Commit offsets only through newline-complete records and retry trailing partial bytes on the next import."
  - "Use dev:ino as stable local file identity when available, with size and boundary validation on every resume."

patterns-established:
  - "Incremental readers return observations and caller-directed reset signals instead of silently accepting incompatible offsets."
  - "Legacy or incompatible checkpoints reset through existing fingerprint and usage-identity deduplication guards."

requirements-completed: [ING-01, ING-02, ING-03]

coverage:
  - id: D1
    description: Append-only JSONL imports read only bytes after the last complete-line checkpoint and unchanged files invoke no reader.
    requirement: ING-01
    verification:
      - kind: integration
        ref: "test/ingest.test.js#incremental ingest checkpoints bytes and reads only appended JSONL payload"
        status: pass
      - kind: integration
        ref: "test/ingest.test.js#incremental ingest skips unchanged files without invoking JSONL reads"
        status: pass
    human_judgment: false
  - id: D2
    description: Truncation, rotation, invalid boundaries, partial writes, legacy checkpoints, and explicit refresh recover safely.
    requirement: ING-02
    verification:
      - kind: integration
        ref: "node --test --test-name-pattern='incremental|checkpoint|append|unchanged|truncation|replacement|rotation|legacy|refresh' test/ingest.test.js"
        status: pass
    human_judgment: false
  - id: D3
    description: Incremental imports preserve warning lines, privacy redaction, Jira attribution, raw fingerprints, and usage identities.
    requirement: ING-03
    verification:
      - kind: integration
        ref: "node --test test/ingest.test.js"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-07-20
status: complete
---

# Phase 20 Plan 01: Incremental JSONL Byte Checkpoints Summary

**Bounded byte-range JSONL reads with complete-line checkpoints, safe file-reset recovery, and database-level behavioral equivalence coverage**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-20T09:14:18Z
- **Completed:** 2026-07-20T09:22:55Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added a synchronous chunked JSONL range reader that preserves absolute line numbers, CRLF/UTF-8 byte correctness, and trailing-partial retry semantics.
- Added versioned byte/line/stat/identity checkpoints shared by telemetry, Copilot session, and VS Code session JSONL imports, with safe full-read fallback for every reset condition.
- Proved incremental and complete imports produce equivalent usage, evidence, warnings, redaction, fingerprints, and deduplication outcomes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define and implement the complete-line byte reader contract** - `0441a2b` (RED tests), `7f29507` (GREEN implementation)
2. **Task 2: Validate, reset, and upgrade ingestion checkpoints** - `78eb3f6` (RED tests), `168d7d0` (GREEN implementation)
3. **Task 3: Lock privacy, warning, attribution, and deduplication equivalence** - `b0c1e0c` (test-only regression coverage)

## Files Created/Modified

- `src/jsonl.js` - Byte-range-aware complete-line JSONL reader with bounded chunks and reset signals.
- `src/ingest.js` - Checkpoint normalization, resume/reset selection, stable identity validation, and atomic context persistence.
- `test/ingest.test.js` - Temp-file and database coverage for append, unchanged, recovery, partial, warning, privacy, attribution, and deduplication behavior.

## Decisions Made

- Kept the legacy no-options and `afterLine` reader behavior intact; byte-range behavior is selected explicitly through `startByte` and `completedLines`.
- Used a one-byte preceding-newline probe to reject non-line byte positions before decoding payload bytes.
- Reset legacy checkpoints through a complete read so they upgrade immediately while existing fingerprints and usage identities prevent duplicates.

## Verification

- `node --test --test-name-pattern='readJsonl|incremental JSONL' test/ingest.test.js` - passed (6/6 focused reader tests).
- `node --test --test-name-pattern='incremental|checkpoint|append|unchanged|truncation|replacement|rotation|legacy|refresh' test/ingest.test.js` - passed (10/10 focused recovery tests).
- `node --test test/ingest.test.js` - passed (48/48 ingestion tests).
- `npm run check` - passed syntax validation for the CLI and all source modules.
- Read instrumentation proved every append payload read began at or after the saved byte offset; unchanged-file instrumentation recorded zero reads.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Normalized freshly initialized milestone state for plan advancement**
- **Found during:** Plan close-out
- **Issue:** `state.advance-plan` could not parse the pre-execution `Plan: —` placeholder, and progress recalculation inferred one total phase from currently planned summaries.
- **Fix:** Added the canonical current/total plan metadata, advanced to Plan 2 of 3, and preserved the roadmap-defined two-phase milestone total.
- **Files modified:** `.planning/STATE.md`
- **Verification:** `state.advance-plan` returned `advanced: true` with current plan 2 of 3.
- **Committed in:** Plan metadata commit

---

**Total deviations:** 1 auto-fixed (1 blocking issue).
**Impact on plan:** Planning metadata now reflects the completed plan without changing implementation scope.

## Issues Encountered

- Task 3 is a test-only lock on behavior implemented by Tasks 1 and 2, so its new assertions passed on their first run as intended; no production change was required.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 20-02 can build the lightweight collection path on the now-stable incremental ingestion contract.
- Plan 20-03 can benchmark the byte checkpoint path using the included read instrumentation.
- No blockers or deferred issues.

## Self-Check: PASSED

- All three modified implementation/test files and this summary exist.
- All five task commits resolve in repository history.
- `git diff --check` reported no whitespace errors.

---
*Phase: 20-incremental-jsonl-and-lightweight-collection*
*Completed: 2026-07-20*
