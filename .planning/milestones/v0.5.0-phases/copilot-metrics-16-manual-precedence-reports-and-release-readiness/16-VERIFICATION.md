---
phase: 16
status: passed
verified: 2026-06-09
---

# Phase 16 Verification

## Automated Checks

| Command | Result |
|---------|--------|
| `node --check src/label-confidence.js && node --check src/sqlite-store.js && node --check src/reports.js && node --check src/cli.js` | passed |
| `node --test test/label-confidence.test.js test/report.test.js` | passed: 26/26 |
| `npm run check` | passed |
| `npm test` | passed: 83/83 |
| `npm run check:readme-version` | passed |
| `npm pack --silent --dry-run --json` | passed |
| `npm run verify:package` | passed |

## Release Checks

| Check | Result |
|-------|--------|
| GitHub release `v0.5.0` created | passed |
| Actions run `27234152962` build job | passed |
| Actions run `27234152962` publish-npm job | passed |
| `npm view copilot-metrics@0.5.0 version` | `0.5.0` |
| Neutral `npx -y copilot-metrics@0.5.0 report labels --json` with isolated homes | passed |

## Requirements Covered

- MLAB-05: manual labels outrank automatic evidence.
- MLAB-06: automatic evidence remains stored and visible in detail/audit output.
- MLAB-07: human report surfaces keep compact overview behavior while detail/session-detail expose provenance.
- MLAB-08: JSON detail/session-detail reports include manual provenance and inclusion metadata.
- MLAB-10: fixture tests cover assignment, replacement, removal, ranking precedence, report output, and stale provenance.

