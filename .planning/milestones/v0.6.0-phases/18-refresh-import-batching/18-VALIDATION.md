---
phase: 18
slug: refresh-import-batching
status: draft
nyquist_compliant: true
created: 2026-06-10
---

# Phase 18 - Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Node built-in `node:test` |
| Quick run | `node --test test/report.test.js test/ingest.test.js` |
| Full gate | `npm test && npm run check && npm run verify:package && npm run verify:native-sqlite` |

## Per-Task Verification Map

| Task ID | Requirement | Test Type | Automated Command |
|---------|-------------|-----------|-------------------|
| 18-01-01 | PERF-05, PERF-06, PERF-08 | report integration | `node --test test/report.test.js` |
| 18-01-02 | PERF-07 | unit/integration | `node --test test/ingest.test.js test/report.test.js` |
| 18-01-03 | PERF-13 | benchmark | `npm run benchmark:storage` |

## Manual-Only Verifications

None for Phase 18. Published `npx` validation remains Phase 19.

## Validation Sign-Off

- [x] Automated tests cover changed behavior.
- [x] Existing refresh semantics tests remain in scope.
- [x] No watch-mode commands.
- [x] Performance evidence is machine-readable.
