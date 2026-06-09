# Phase 15: Manual label assignment CLI and storage - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-09
**Phase:** 15-Manual label assignment CLI and storage
**Areas discussed:** Command Shape and Correction Flow, Session Identity Target, Manual Storage Semantics, Label Validation Strictness

---

## Command Shape and Correction Flow

| Option | Description | Selected |
|--------|-------------|----------|
| `label session <session-id> ...` | Group correction under an explicit session subdomain. | |
| Separate top-level commands | Use commands like `labels assign` and `labels remove`. | |
| `session label <session-id> ...` | Useful if broader session management is in scope. | |
| `label <session-id> ...` | User-proposed terse top-level manual correction command. | yes |

**User's choice:** Use `copilot-metrics label <session-id> ...`.
**Notes:** The command family should include `list`, `add`, `remove`, `set`, and `clear`. Drop a literal `replace` command; `set` overwrites the full manual label list. `set` with no labels is not allowed; `clear` removes all manual labels. All commands support `--json`, and JSON returns the post-operation state with `session_id`, `manual_labels`, `operation`, and `changed`.

---

## Session Identity Target

| Option | Description | Selected |
|--------|-------------|----------|
| Exact `session_id` only | Clear target and avoids accidental row-level correction. | yes |
| `session_id` plus usage record ID fallback | Covers records without session IDs but weakens command meaning. | |
| Internal session keys | Accept `session:<id>`, `usage:<id>`, or `hook:<id>` style keys. | |

**User's choice:** Exact `session_id` only.
**Notes:** Reject unknown sessions. A manual assignment applies to every row sharing that `session_id`. The user clarified this is a cost-attribution correction workflow: manually reassigning a session should move default report costs from one label to another in Phase 16. Session IDs must be visible in unassigned/unattributed output and detailed label reports. A standalone all-sessions listing command is deferred.

---

## Manual Storage Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Separate `manual_label_assignments` table | Keeps active manual state separate from automatic evidence. | yes |
| Manual rows in `label_evidence` | Reuses existing ranking input but blurs active state and audit semantics. | |
| Both table and generated evidence rows | More powerful but heavier for Phase 15. | |

**User's choice:** Separate active assignment table.
**Notes:** Store only current active state, not full history. Active rows store label plus `created_at` and `updated_at`. Store one row per `(session_id, label)`. Add store helper/query functions that return manual assignments by session for Phase 16.

---

## Label Validation Strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Validate against configured patterns | Initially considered, but rejected. | |
| Use built-in Jira pattern only | Simpler but too restrictive. | |
| Pattern-free labels with basic safety | Do not regex-validate; trim, require non-empty, uppercase. | yes |

**User's choice:** Manual labels should not be validated against anything.
**Notes:** Basic safety remains: trim input, reject empty labels, and canonicalize to uppercase. Duplicate adds and missing-label removes are idempotent no-ops with `changed: false`. Do not warn when manual labels differ from automatic evidence because reassignment is the expected use case.

---

## the agent's Discretion

- Exact helper names, table/index names, and human-readable output wording may be chosen during planning and implementation.

## Deferred Ideas

- Add a future all-sessions listing command with date, metadata, current automatic attribution, and similar context to unattributed reports.
