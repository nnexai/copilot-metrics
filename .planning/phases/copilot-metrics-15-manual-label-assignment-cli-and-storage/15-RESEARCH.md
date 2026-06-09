---
phase: 15
status: complete
generated_at: 2026-06-09
---

# Phase 15 Research: Manual label assignment CLI and storage

## RESEARCH COMPLETE

Phase 15 is a contained CLI and SQLite storage change.

## Existing patterns

- `src/cli.js` owns top-level command routing, global `--json`, `--home`, store locking, and human-readable output.
- `src/sqlite-store.js` owns additive schema initialization and persistence helpers around `sql.js`.
- `src/label-extractors.js` exposes `canonicalLabel()`, which trims and uppercases labels without requiring regex validation.
- Reports already expose session IDs in label detail/session-detail and unattributed output, so Phase 15 does not need a standalone session-listing command.
- Tests use `node:test`, temp homes, and the real CLI through `bin/copilot-metrics.js`.

## Implementation implications

- Add `manual_label_assignments` as a separate active-state table with one row per `(session_id, label)`.
- Store helper APIs should call `initStore()` first, open the SQLite DB, mutate in a transaction, persist, and return post-operation state.
- Unknown session rejection should check local `usage_records`, `label_evidence`, and `hook_events` by exact `session_id`.
- Manual labels should only be trimmed and uppercased. Empty values are rejected; regex/pattern validation is explicitly out of scope by Phase 15 context.
- CLI JSON should return `{ session_id, manual_labels, operation, changed }` for all manual label operations.

## Validation strategy

- Add fixture-style CLI tests to `test/report.test.js` using existing fixtures.
- Cover list/add/remove/set/clear, idempotent duplicate add, idempotent missing remove, unknown session rejection, empty label rejection, uppercase canonicalization, and session ID visibility in detail/unattributed report surfaces.
- Run focused tests first, then `npm test`.
