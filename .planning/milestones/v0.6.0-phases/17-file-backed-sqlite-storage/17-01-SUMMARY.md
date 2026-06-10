---
phase: 17
plan: 17-01
subsystem: storage-validation
tags:
  - performance
  - sqlite
  - testing
requires:
  - PERF-01
  - PERF-02
  - PERF-03
  - PERF-04
provides:
  - storage backend equivalence tests
  - native package smoke script
  - storage benchmark script
  - package artifact guardrails
affects:
  - test/storage-backend.test.js
  - scripts/verify-native-sqlite-package.js
  - scripts/benchmark-storage.js
  - scripts/verify-package.js
  - package.json
tech-stack:
  added:
    - better-sqlite3@12.10.0
  patterns:
    - fixture-backed storage equivalence tests
    - neutral-directory package smoke
key-files:
  created:
    - test/storage-backend.test.js
    - scripts/verify-native-sqlite-package.js
    - scripts/benchmark-storage.js
  modified:
    - scripts/verify-package.js
    - package.json
key-decisions:
  - Added migration-static assertions that reject sql.js runtime mechanics after the backend swap.
  - Kept package/native smoke as a local packed-tarball validation, leaving published npx checks for Phase 19.
requirements-completed:
  - PERF-01
  - PERF-02
  - PERF-03
  - PERF-04
duration: 0 min
completed: 2026-06-10
---

# Phase 17 Plan 17-01: Validation Harness Summary

Created the Phase 17 validation harness for storage backend equivalence, native package validation, benchmark reporting, and package artifact guardrails.

## Work Completed

- Added `test/storage-backend.test.js` covering schema initialization, persistence/reopen behavior, raw/usage/hook/evidence/warning/checkpoint/manual-label data, dedupe behavior, and migration-static checks.
- Added `scripts/verify-native-sqlite-package.js` to pack the package, install it in a neutral temp project, load `better-sqlite3`, run the installed CLI, import fixture data, assign a manual label, and run JSON reports.
- Added `scripts/benchmark-storage.js` to emit machine-readable checkpoint/write benchmark JSON with the original spike baseline values.
- Extended `scripts/verify-package.js` to reject SQLite database files, WAL/SHM sidecars, temp DB names, and copied benchmark stores.
- Added npm scripts for `benchmark:storage` and `verify:native-sqlite`.

## Verification

- `node --check test/storage-backend.test.js`
- `node --check scripts/verify-native-sqlite-package.js`
- `node --check scripts/benchmark-storage.js`
- `npm run verify:package`
- Later full Phase 17 gate also passed: `npm run benchmark:storage && npm test && npm run check && npm run verify:package && npm run verify:native-sqlite`

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

None.

## Next Phase Readiness

Ready for Plan 17-02.
