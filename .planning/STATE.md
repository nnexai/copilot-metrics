---
gsd_state_version: 1.0
milestone: v0.5.0
milestone_name: manual session labels
status: complete
last_updated: "2026-06-09T20:52:57.000Z"
last_activity: 2026-06-09 -- quick fix completed for manual label duplicate attribution
progress:
  total_phases: 2
  completed_phases: 2
  total_plans: 1
  completed_plans: 1
  percent: 100
---

# State: Copilot Metrics

**Initialized:** 2026-05-30
**Status:** Complete

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-06-09)

**Core value:** Give the user a trustworthy local CLI explanation of which Jira labels, repos, models, and Copilot surfaces are driving estimated AI Credit usage.
**Current focus:** Manual session labels with higher precedence than auto-detected labels.

## Workflow Settings

- Mode: YOLO
- Granularity: Coarse
- Execution: Parallel
- Git tracking: Yes
- Research: Yes
- Plan check: Yes
- Verifier: Yes
- Auto advance: Yes
- Text mode: Yes

## Current Milestone

v0.5.0 manual session labels

## Current Position

Phase: 16
Plan: 16-01
Status: Complete
Last activity: 2026-06-09 -- v0.5.0 released and archived

## Completed Milestone

v0.5.0 manual session labels completed:

- Phase 15: manual session label assignment CLI and storage.
- Phase 16: manual precedence ranking/report integration, stale-provenance tests, and `copilot-metrics@0.5.0` release.

Archived files:

- `.planning/milestones/v0.5.0-ROADMAP.md`
- `.planning/milestones/v0.5.0-REQUIREMENTS.md`
- `.planning/milestones/v0.5.0-MILESTONE-AUDIT.md`
- `.planning/milestones/v0.5.0-phases/`

## Previous Completed Milestone

v0.4.0 label association confidence completed:

- Phase 12: setup-time repeatable `--label-patterns`, persisted as `labelPatterns`.
- Phase 13: granular label evidence confidence model, `label-confidence:v1`.
- Phase 14: top-label default reports, explicit top-k/all-match inclusion, and `--session-detail`.

Archived files:

- `.planning/milestones/v0.4.0-ROADMAP.md`
- `.planning/milestones/v0.4.0-REQUIREMENTS.md`
- `.planning/milestones/v0.4.0-MILESTONE-AUDIT.md`
- `.planning/milestones/v0.4.0-phases/`

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-06-03:

| Category | Item | Status |
|----------|------|--------|
| nyquist | Phase 12 VALIDATION.md artifact missing | Process debt accepted |
| nyquist | Phase 13 VALIDATION.md artifact missing | Process debt accepted |
| nyquist | Phase 14 VALIDATION.md artifact missing | Process debt accepted |

## Quick Tasks Completed

| Date | Task | Summary |
|------|------|---------|
| 2026-06-09 | [release 0.5.2 evidence dedupe fix](quick/260609-release-0-5-2-evidence-dedupe/SUMMARY.md) | Released refresh label-evidence dedupe repair as `copilot-metrics@0.5.2`. |
| 2026-06-09 | [fix manual label duplicate attribution](quick/260609-fix-manual-label-duplicate-attribution/SUMMARY.md) | Deduped manual-label report rows by stable `span_id + model` and extended refresh repair to Copilot session duplicates. |
