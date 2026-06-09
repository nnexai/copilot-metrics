---
phase: 15
plan: 15-01
status: complete
completed_at: 2026-06-09
subsystem: manual-labels
tags:
  - cli
  - sqlite
  - labels
key-files:
  - src/sqlite-store.js
  - src/cli.js
  - test/report.test.js
---

# Summary 15-01: Manual label assignment CLI and storage

## Completed

- Added `manual_label_assignments` as separate active manual assignment storage with one row per `(session_id, label)`.
- Added store helpers to list, add, remove, set, and clear manual labels while preserving automatic `label_evidence`.
- Added exact known-session checks across usage, label evidence, and hook event rows.
- Added `copilot-metrics label <session-id> list|add|remove|set|clear` with `--json` support and compact human output.
- Implemented basic label safety for manual labels: trim, uppercase, reject empty values, and no regex validation.
- Added focused CLI tests for assignment, replacement, removal, idempotent no-ops, unknown session rejection, empty label rejection, and session ID visibility in report surfaces.
- Fixed local GSD phase discovery for hyphenated `project_code` prefixes so `copilot-metrics-15-...` phase artifacts are recognized.

## Verification

- `npm run check` passed.
- `node --test test/report.test.js` passed.
- `npm test` passed.

## Deviations

- No standalone session-listing command was added; this is explicitly deferred by the Phase 15 context.
- Manual labels are not pattern-validated; this follows the Phase 15 decision that manual corrections should only require basic safety and uppercase canonicalization.

## Self-Check

PASSED. The implementation satisfies Phase 15 requirements MLAB-01, MLAB-02, MLAB-03, MLAB-04, and MLAB-09.
