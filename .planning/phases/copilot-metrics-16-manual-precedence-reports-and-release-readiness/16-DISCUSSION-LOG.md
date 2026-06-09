# Phase 16: Manual precedence reports and release readiness - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-09
**Phase:** 16-Manual precedence reports and release readiness
**Areas discussed:** Manual precedence semantics, Provenance in report output, Detail and audit behavior, Release readiness boundary

---

## Manual Precedence Semantics

| Question | Selected |
|----------|----------|
| If a session has one or more manual labels, how should those rank against automatic evidence? | Manual labels always occupy the top ranks, sorted alphabetically; automatic labels remain visible below them. |
| In default non-overlapping reports, if a session has multiple manual labels, should its selected usage total appear under only one label or under each manual label? | Require `--top-k` or `--all-matches` to show additional manual labels with totals; default stays one label. |
| Should manual precedence be implemented as part of `label-confidence:v1`, or should it introduce a new scoring version? | Keep `label-confidence:v1` and add manual precedence as a new source/evidence class. |
| When manual labels are present, what should happen to automatic confidence scores? | Keep automatic scores unchanged below manual ranks; manual labels get an explicit score above the automatic range. |
| How should removal/clear affect ranking in the same store? | Remove manual precedence immediately; return to automatic ranking with no stale manual provenance in default reports. |
| For automatic labels below manual labels, should their ranks continue after manual ranks or keep their original automatic rank? | Continue after manual ranks. |
| Should a manual label be allowed to appear both as manual and automatic evidence for the same session? | Merge into one ranked label entry marked manual; keep automatic evidence stored and tracked inside merged evidence/audit data. |
| For a session with manual labels but no automatic label evidence rows, should reports still create ranking/report entries from the manual assignment alone? | Yes; manual assignment alone is enough for a known session. |
| If a manual assignment references a known session with multiple usage rows, how should totals attach? | Attribute every usage row in that session at report/ranking output time without rewriting the database. |
| Should manual precedence also affect unlabeled/unattributed reports? | Yes; manual assignment removes the session from unattributed output. |
| For sorting label report rows, how should manually attributed labels be ordered when credits/totals are otherwise equal? | Keep existing selected-credit/label-name sort; provenance does not reorder rows. |
| For top-k behavior with manual labels, should `--top-k 2` include two manual labels before any automatic label? | Yes; top-k uses final rank after manual precedence, so manual labels occupy the first slots. |

**Notes:** The user clarified that automatic labels matching a manual label are hidden only as separate output entries; internally the automatic evidence remains kept and tracked. The user also clarified that manual assignments are output-time attribution and must not overwrite stored usage or evidence.

---

## Provenance in Report Output

| Question | Selected |
|----------|----------|
| How should human-readable `report labels` show that a label total includes manual assignment? | Keep overview compact; manual provenance appears in detail/session-detail surfaces. |
| For JSON `report labels --json`, should manual provenance appear in the overview payload even if human overview stays compact? | No; keep JSON overview aligned with human overview. |
| For `report label <id> --session-detail`, how should a manually attributed session be marked? | Put manual provenance inside the existing `confidence` object. |
| For `report label <id> --detail`, which returns evidence rows, should manual assignments appear as synthetic detail rows? | Yes; include synthetic manual evidence rows. |
| How much timestamp provenance should reports expose for manual assignments? | Include `created_at` and `updated_at` in JSON detail/confidence metadata; human output can stay compact. |

---

## Detail and Audit Behavior

| Question | Selected |
|----------|----------|
| When manual labels override automatic labels, how should the displaced automatic labels be visible? | Keep automatic evidence visible in `--detail` and merged `confidence.evidence`. |
| If a requested label is automatic rank 1 but a different manual label overrides it, what should `report label <auto-label>` show by default? | Use the existing final-rank inclusion model; overridden sessions require `--top-k` or `--all-matches`. |
| For JSON confidence metadata, should we expose both final rank and original automatic rank? | No; expose only final rank. |
| Should the confidence source summary distinguish manual sources from automatic sources? | Yes; include `manual` as its own source in `source_summary`. |
| Should replacement/removal behavior have explicit report tests for stale manual provenance? | Yes; tests must prove `set` and `clear` update reports immediately and leave no stale default provenance. |

**Notes:** The user wanted manual labels to behave as a rank push, not a separate special report mode. Automatic-label sessions not overridden by manual labels should continue appearing normally.

---

## Release Readiness Boundary

| Question | Selected |
|----------|----------|
| Should Phase 16 include actually publishing `copilot-metrics@0.5.0` after implementation and verification pass? | Yes; include version metadata, README/changelog, tag/release workflow, and neutral-directory validation. |
| What should be the minimum release validation after publish? | Local tests/package checks, GitHub release workflow watch, npm package version verification, and `npx -y copilot-metrics@0.5.0 ...` from a neutral directory. |
| For published `npx` validation from a neutral directory, what should we prove? | Prove the binary runs and emits valid CLI/report diagnostics; empty telemetry is not a publish failure. |
| Should Phase 16 update milestone planning artifacts after release? | Yes; update planning artifacts as needed and archive/complete v0.5.0. |

---

## the agent's Discretion

- Exact helper names, SQL query shape, and compact human wording.
- Exact test fixture layout, as long as ranking/report/replacement/removal behavior is covered.

## Deferred Ideas

None.
