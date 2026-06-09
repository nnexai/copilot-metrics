# Phase 15: Manual label assignment CLI and storage - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers a CLI-first correction surface and durable local storage for manually assigning labels to known sessions. It covers manual label command shape, exact session targeting, storage of active manual assignments, basic input safety, and session-ID discoverability needed to use the correction workflow. Phase 16 owns ranking/report precedence and visible manual provenance in aggregate reports.

</domain>

<decisions>
## Implementation Decisions

### Command Shape and Correction Flow
- **D-01:** Add a top-level manual correction command family: `copilot-metrics label <session-id> ...`.
- **D-02:** Supported actions are `list`, `add <label...>`, `remove <label...>`, `set <label...>`, and `clear`.
- **D-03:** Do not add a command literally named `replace`; `set` is the full replacement workflow and overwrites the active manual label list for the session.
- **D-04:** `set` requires at least one label. Removing all manual labels uses `clear`, so accidental empty-set wipes are avoided.
- **D-05:** Every manual label command supports `--json`.
- **D-06:** JSON output returns the post-operation manual-label state, not just a success message. The expected contract includes `session_id`, `manual_labels`, `operation`, and `changed`.
- **D-07:** Duplicate `add` and missing-label `remove` are idempotent no-ops and return `changed: false`.

### Session Identity Target
- **D-08:** Phase 15 commands accept exact `session_id` only.
- **D-09:** Reject manual label mutations for a `session_id` that is not already known in local usage or label evidence.
- **D-10:** A manual assignment applies to the whole session: all usage rows, hook rows, and evidence rows sharing that `session_id`.
- **D-11:** The product intent is cost-attribution correction. If automatic evidence places a session under one label, manually setting a different label should move that session's default report totals to the manual label in Phase 16 while preserving automatic evidence for audit/detail views.
- **D-12:** Add or preserve enough session-ID visibility in correction-adjacent report surfaces: unattributed/unassigned output must show session IDs, and detailed label report output must show session IDs.
- **D-13:** Do not add a standalone session-listing command in Phase 15.

### Manual Storage Semantics
- **D-14:** Store manual labels in a separate active `manual_label_assignments` table, leaving automatic `label_evidence` rows untouched.
- **D-15:** Store only current active state, not full assignment history.
- **D-16:** Active rows store `session_id`, canonical `label`, `created_at`, and `updated_at`.
- **D-17:** Store one active row per `(session_id, label)`.
- **D-18:** Add store helper/query functions that return manual assignments by session so Phase 16 can integrate manual precedence without directly duplicating table access logic.

### Label Validation Strictness
- **D-19:** Manual labels are not validated against configured `labelPatterns` or built-in Jira regexes.
- **D-20:** Manual labels must be non-empty after trimming and are canonicalized to uppercase.
- **D-21:** Mutation commands should not warn when manual labels conflict with automatic evidence. Reassignment is expected; Phase 16 reports should surface provenance.

### the agent's Discretion
Planner may choose exact function names, table/index names, and human-readable phrasing as long as the command contract, storage separation, and idempotent mutation semantics above are preserved.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone Scope
- `.planning/PROJECT.md` — Current v0.5.0 milestone goal and the manual-label highest-precedence product decision.
- `.planning/REQUIREMENTS.md` — Phase 15 requirements MLAB-01, MLAB-02, MLAB-03, MLAB-04, and MLAB-09.
- `.planning/ROADMAP.md` — Phase 15/16 boundary; Phase 15 is CLI/storage, Phase 16 is ranking/report precedence and release readiness.
- `.planning/STATE.md` — Current workflow state and prior v0.4.0 summary.

### Prior Label Decisions
- `.planning/milestones/v0.4.0-phases/12-v0-4-0-setup-labelpattern-init/12-CONTEXT.md` — `labelPatterns` setup semantics and extractor compatibility.
- `.planning/milestones/v0.4.0-phases/13-v0-4-0-label-association-confidence-model/13-CONTEXT.md` — Granular evidence preservation and confidence scoring contract.
- `.planning/milestones/v0.4.0-phases/14-v0-4-0-confidence-aware-label-reports/14-CONTEXT.md` — Top-label default report semantics, top-k/all-match inclusion, and session-detail report behavior.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/cli.js` — Existing command routing, help text, flag parsing, `--json` output, store locking, and report command shape.
- `src/sqlite-store.js` — Store initialization, additive schema patterns, persistence helpers, and label evidence insertion/dedupe patterns.
- `src/label-extractors.js` — `canonicalLabel()` should be reused for manual label canonicalization, but manual labels must not be pattern-validated.
- `src/label-confidence.js` — Existing session-key and confidence-ranking helpers that Phase 16 will extend or merge with manual assignment state.
- `src/reports.js` — Current label detail/session-detail/unattributed report functions already expose or query session context and are the likely places to ensure correction discoverability.

### Established Patterns
- CLI commands support human-readable and JSON output; mutation JSON should return structured state useful for automation.
- SQLite schema changes are additive and idempotent.
- Reports initialize the store before querying.
- Existing label evidence remains granular and derived ranking is computed at query/report time.
- Top-label reports intentionally avoid overlapping session totals by default.

### Integration Points
- Add manual label action routing near other top-level CLI command handling in `src/cli.js`.
- Add `manual_label_assignments` schema and helper functions in `src/sqlite-store.js`.
- Use exact `session_id` existence checks against local usage/evidence/hook data before mutation.
- Ensure unattributed/unassigned and detailed label report output expose session IDs enough for users to run `copilot-metrics label <session-id> ...`.
- Phase 16 should consume the manual assignment helper rather than treating manual labels as ordinary automatic evidence.

</code_context>

<specifics>
## Specific Ideas

Example JSON response shape:

```json
{
  "session_id": "session-native",
  "manual_labels": ["DEMO-123", "DEMO-456"],
  "operation": "set",
  "changed": true
}
```

Example command surface:

```text
copilot-metrics label <session-id> list
copilot-metrics label <session-id> add DEMO-123 DEMO-456
copilot-metrics label <session-id> remove DEMO-123
copilot-metrics label <session-id> set DEMO-123 DEMO-456
copilot-metrics label <session-id> clear
```

</specifics>

<deferred>
## Deferred Ideas

- Add a future all-sessions listing command with date, metadata, current automatic attribution, and similar context to unattributed reports.

</deferred>

---

*Phase: 15-Manual label assignment CLI and storage*
*Context gathered: 2026-06-09*
