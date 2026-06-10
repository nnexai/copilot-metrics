---
phase: 17
plan: 17-03
subsystem: storage-package-validation
tags:
  - performance
  - package
  - release-prep
requires:
  - PERF-01
  - PERF-03
  - PERF-04
provides:
  - native packed-package smoke
  - storage benchmark evidence
  - README native dependency note
affects:
  - scripts/verify-native-sqlite-package.js
  - scripts/benchmark-storage.js
  - scripts/verify-package.js
  - package.json
  - README.md
tech-stack:
  added:
    - better-sqlite3@12.10.0
  patterns:
    - packed tarball install validation
    - JSON benchmark output
key-files:
  created:
    - scripts/verify-native-sqlite-package.js
    - scripts/benchmark-storage.js
  modified:
    - scripts/verify-package.js
    - package.json
    - README.md
key-decisions:
  - Native package validation uses `copilot-cli-otel.jsonl` because that fixture has a stable `session-cli` session for manual-label smoke.
  - Published `npx` validation remains Phase 19 release work; Phase 17 validates local packed-tarball install outside the checkout.
requirements-completed:
  - PERF-01
  - PERF-03
  - PERF-04
duration: 0 min
completed: 2026-06-10
---

# Phase 17 Plan 17-03: Native Package and Benchmark Summary

Validated the native file-backed storage path through benchmark, full local tests, package artifact verification, and neutral-directory packed-package install.

## Work Completed

- Finalized native package smoke to install the packed tarball in a temp project, require `better-sqlite3`, run the installed binary, initialize a temp home, import fixture usage, assign a manual label, and run a JSON label report.
- Finalized storage benchmark output as JSON with backend name, package version, Node version, operation count, elapsed milliseconds, and spike baseline references.
- Updated README install notes to state Node.js 20+ and the `better-sqlite3` runtime dependency.
- Verified package contents exclude SQLite database files, WAL/SHM sidecars, temp DB files, and copied benchmark stores.

## Verification

- `npm run benchmark:storage`
  - Latest output: 1000 checkpoint writes in 111.877 ms on Node v26.0.0.
  - Spike baseline references: sql.js helper checkpoint writes 46,341.27 ms; isolated better-sqlite3 transaction 1.38 ms.
- `npm test`
  - 89 tests passed.
- `npm run check`
- `npm run verify:package`
  - Package verification passed for `copilot-metrics@0.5.2`; 22 files; unpacked size 263,223 bytes.
- `npm run verify:native-sqlite`
  - Packed package installed in neutral temp project.
  - `better-sqlite3` native load passed with version 12.10.0.
  - Installed CLI produced JSON report output with 20 label rows.

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

- Initial native smoke used session `s1` with a fixture that did not contain that session. The script now imports `copilot-cli-otel.jsonl` and labels `session-cli`.

## Next Phase Readiness

Phase 17 is ready for verification and transition. Refresh batching remains deferred to Phase 18; report query/ranking optimization and release remain deferred to Phase 19.
