---
phase: 17
plan: 17-02
subsystem: storage-backend
tags:
  - performance
  - sqlite
  - better-sqlite3
requires:
  - PERF-01
  - PERF-02
  - PERF-03
provides:
  - file-backed SQLite backend
  - shared import mutation connection
  - sql.js runtime removal
affects:
  - src/sqlite-store.js
  - src/ingest.js
  - package.json
  - package-lock.json
  - test/ingest.test.js
  - test/report.test.js
tech-stack:
  added:
    - better-sqlite3@12.10.0
  patterns:
    - compatibility wrapper for existing store facade
    - connection-scoped import mutation batch
key-files:
  created: []
  modified:
    - src/sqlite-store.js
    - src/ingest.js
    - package.json
    - package-lock.json
    - test/ingest.test.js
    - test/report.test.js
key-decisions:
  - Kept the existing async public store facade stable while swapping the implementation to file-backed better-sqlite3.
  - Implemented `runImportMutationBatch` so parsed import, checkpoint, cost repair, and duplicate repair work can reuse one native connection.
  - Used standard SQLite single-quoted string literals in tests instead of relying on sql.js double-quoted string tolerance.
requirements-completed:
  - PERF-01
  - PERF-02
  - PERF-03
duration: 0 min
completed: 2026-06-10
---

# Phase 17 Plan 17-02: File-Backed SQLite Backend Summary

Replaced the `sql.js` load/export runtime with file-backed `better-sqlite3` while preserving the existing store facade and report/import behavior.

## Work Completed

- Replaced `sql.js` initialization, in-memory database loading, and `db.export()` persistence with a native `better-sqlite3` file-backed backend.
- Preserved the existing exported async helper names used by setup, import, labels, reports, and repair paths.
- Added a compatibility wrapper for the existing statement patterns so the migration stayed focused on storage mechanics.
- Added owner-local directory/file permission handling and conservative WAL/FULL synchronous settings.
- Added `runImportMutationBatch` and wired import paths to reuse a shared connection for already-parsed insert, checkpoint, repair, and cost-update work.
- Updated tests that directly mutate fixture stores to use `better-sqlite3` and standard SQLite string literals.

## Verification

- `npm test`
- `npm run check`
- `node --test test/storage-backend.test.js test/ingest.test.js`
- Later full Phase 17 gate also passed: `npm run benchmark:storage && npm test && npm run check && npm run verify:package && npm run verify:native-sqlite`

## Deviations from Plan

- Did not create `src/sqlite-better-store.js`; the backend implementation remains inside `src/sqlite-store.js` behind a compatibility wrapper. This kept the public facade stable and avoided a split with no current reuse benefit.
- Used explicit `BEGIN`/`COMMIT` transactions through the existing store helper shape rather than converting every mutation to `db.transaction()` callbacks. The implementation still removes full-file export mechanics and batches import mutation connection reuse.

## Issues Encountered

- Native SQLite rejected old test-only double-quoted string literals such as `WHERE session_id = "s1"`. Tests were updated to standard single-quoted SQL.

## Next Phase Readiness

Ready for Plan 17-03.
