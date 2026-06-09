# Phase 16: Manual precedence reports and release readiness - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase makes active manual session labels the highest-precedence attribution source in confidence ranking and reports, exposes manual provenance in detail-oriented report surfaces, preserves automatic label evidence for auditability, verifies replacement/removal behavior, and carries the v0.5.0 release through publish validation and milestone close.

</domain>

<decisions>
## Implementation Decisions

### Manual Precedence Semantics
- **D-01:** Manual labels always occupy the top ranks for a session; when multiple manual labels exist, sort them alphabetically before any automatic label.
- **D-02:** Default report semantics remain non-overlapping. A multi-manual-label session contributes totals only to its final rank-1 label by default; additional manual labels contribute totals only through `--top-k` or `--all-matches`.
- **D-03:** Keep `label-confidence:v1`; manual precedence is a new highest-precedence source/evidence class, not a scoring-version break.
- **D-04:** Keep automatic confidence scores unchanged below manual ranks; manual labels get an explicit manual precedence score above the normal automatic range.
- **D-05:** `remove` and `clear` immediately remove manual precedence. The session returns to automatic ranking with no stale manual provenance in default reports.
- **D-06:** Final rank numbers continue after manual labels. With two manual labels, the strongest automatic label is final rank 3.
- **D-07:** If a label is both manual and automatic for the same session, output merges it into one ranked label entry marked manual. Matching automatic evidence is not emitted as a separate ranked entry, but it remains stored and tracked inside merged evidence/audit data.
- **D-08:** Manual assignment alone is enough to create ranking/report output for a known session; Phase 16 must not require automatic label evidence specifically.
- **D-09:** Manual assignment applies to every usage row in that session at report/ranking output time. Do not rewrite usage rows or automatic evidence in the database.
- **D-10:** Manual assignment removes the session from unattributed output, even when there is no automatic label evidence.
- **D-11:** Label report sorting keeps the existing primary order by selected credits/totals and label name. Manual provenance is displayed where appropriate but does not reorder rows by itself.
- **D-12:** `--top-k` uses final rank after manual precedence. All manual labels rank before any automatic label, so `--top-k 2` can include two manual labels when at least two exist.

### Provenance in Report Output
- **D-13:** Keep default `report labels` human output compact. Do not add a manual provenance column to overview tables.
- **D-14:** Keep `report labels --json` aligned with the compact overview contract. Manual provenance appears in detail/session-detail JSON, not per-label overview rows.
- **D-15:** For `report label <id> --session-detail`, manual provenance should live inside the existing `confidence` object rather than adding new top-level session-detail fields or row markers.
- **D-16:** `report label <id> --detail` should include synthetic manual evidence rows so manual provenance appears in the same evidence list as other sources.
- **D-17:** JSON should expose `created_at` and `updated_at` for manual evidence/detail rows and confidence metadata. Human output can stay compact.

### Detail and Audit Behavior
- **D-18:** Displaced automatic evidence stays visible in `--detail` and inside merged `confidence.evidence`. Final rank places automatic labels below manual ranks unless the automatic label matches a manual label.
- **D-19:** Manual labels push automatic labels further back in the existing inclusion model. `report label <auto-label>` defaults to sessions where that label is final rank 1; overridden sessions require `--top-k` or `--all-matches`. Sessions where the auto label remains final rank 1 continue to appear normally.
- **D-20:** Expose only final rank. Do not add `automatic_rank`.
- **D-21:** `source_summary` should include `manual` as its own source alongside automatic sources such as branch, cwd, prompt, and tool evidence.
- **D-22:** Tests must prove `set` and `clear` update reports immediately and leave no stale manual provenance in default outputs.

### Release Readiness Boundary
- **D-23:** Phase 16 includes the actual `copilot-metrics@0.5.0` publish path after implementation and verification pass.
- **D-24:** Release work includes version metadata, README/changelog updates, tag/release workflow, and published-package validation from a neutral directory.
- **D-25:** Minimum release validation is local tests/package checks, GitHub release workflow watch, npm package version verification, and `npx -y copilot-metrics@0.5.0 ...` from a neutral directory.
- **D-26:** Neutral-directory `npx` validation should prove the published binary runs and emits valid CLI/report diagnostics even without local telemetry. Empty data is not a publish failure.
- **D-27:** After successful publish, update planning artifacts as needed and archive/complete the v0.5.0 milestone.

### the agent's Discretion
Planner may choose exact helper names, SQL query shape, and compact human wording, but must preserve the ranking, inclusion, provenance, audit, and release contracts above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone Scope
- `.planning/PROJECT.md` — Current v0.5.0 milestone goal and manual-label highest-precedence product decision.
- `.planning/REQUIREMENTS.md` — Phase 16 requirements MLAB-05, MLAB-06, MLAB-07, MLAB-08, and MLAB-10.
- `.planning/ROADMAP.md` — Phase 16 goal, key work, and release-readiness boundary.
- `.planning/STATE.md` — Current workflow state and prior v0.4.0 summary.

### Prior Manual Label Decisions
- `.planning/phases/copilot-metrics-15-manual-label-assignment-cli-and-storage/15-CONTEXT.md` — Phase 15 command/storage contract, whole-session assignment, active-state-only storage, and manual-vs-auto evidence separation.

### Prior Label Confidence Decisions
- `.planning/milestones/v0.4.0-phases/12-v0-4-0-setup-labelpattern-init/12-CONTEXT.md` — `labelPatterns` setup semantics and extractor compatibility.
- `.planning/milestones/v0.4.0-phases/13-v0-4-0-label-association-confidence-model/13-CONTEXT.md` — Granular evidence preservation, `label-confidence:v1`, source summaries, and deterministic rank contract.
- `.planning/milestones/v0.4.0-phases/14-v0-4-0-confidence-aware-label-reports/14-CONTEXT.md` — Top-label default report semantics, top-k/all-match inclusion, and session-detail behavior.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/label-confidence.js` — Existing `label-confidence:v1` ranking helpers, source weights, session keys, rank sorting, source summaries, and evidence lists.
- `src/reports.js` — Existing top-label/top-k/all-match inclusion handling, label aggregation, evidence detail rows, session-detail rows, unattributed report, and compact human table formatting.
- `src/sqlite-store.js` — Existing `manual_label_assignments` table, active-state manual label helpers, session-existence checks, and additive schema patterns.
- `src/cli.js` — Existing `label <session-id>` command handling and report command surfaces.
- `test/report.test.js` and `test/label-confidence.test.js` — Existing fixture-oriented report/ranking coverage and Phase 15 manual-label command tests.

### Established Patterns
- Reports initialize the store before querying.
- Label evidence remains granular and ranking is derived at query/report time.
- Default label reports are top-label and non-overlapping.
- Broader overlapping inclusion requires explicit `--top-k` or `--all-matches`.
- Human overview reports stay compact; JSON/detail surfaces carry richer metadata.
- Selected credits/USD are the report totals; alternate pricing evidence stays diagnostic.
- SQLite schema changes are additive and idempotent.

### Integration Points
- Extend ranking input to combine `label_evidence` with active `manual_label_assignments` without mutating stored automatic evidence.
- Ensure manual assignments can create ranking/report rows for known sessions even when no automatic label evidence exists.
- Update `report label <id> --detail` to include synthetic manual evidence rows with timestamps.
- Update `report label <id> --session-detail` confidence metadata for manual provenance.
- Update `report unattributed` so manually labeled sessions are no longer listed as unattributed.
- Add release metadata/checks around package version, README/changelog, GitHub release workflow, npm package verification, and neutral-directory `npx` validation.

</code_context>

<specifics>
## Specific Ideas

Manual rank example:

```text
Manual labels: DEMO-100, DEMO-200
Automatic labels: DEMO-300, DEMO-100

Final ranking:
1. DEMO-100 (manual, merged with matching auto evidence)
2. DEMO-200 (manual)
3. DEMO-300 (automatic)
```

Default totals remain non-overlapping: only rank 1 contributes by default. `--top-k 2` can include both manual labels; `--all-matches` can include all manual and automatic matches.

Manual provenance should be visible in detail-oriented surfaces, not noisy overview tables.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 16-Manual precedence reports and release readiness*
*Context gathered: 2026-06-09*
