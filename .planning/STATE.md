---
gsd_state_version: 1.0
milestone: v0.7.0
milestone_name: Ingestion and Reporting Scalability
status: planning
last_updated: "2026-07-20T08:56:12.464Z"
last_activity: 2026-07-20
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# State: Copilot Metrics

**Initialized:** 2026-05-30
**Status:** v0.7.0 milestone planning

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-07-20)

**Core value:** Give the user a trustworthy local CLI explanation of which Jira labels, repos, models, and Copilot surfaces are driving estimated AI Credit usage.
**Current focus:** Defining ingestion and reporting scalability requirements

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

v0.7.0 Ingestion and Reporting Scalability

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-07-20 — Milestone v0.7.0 started

## Current Roadmap

Requirements and roadmap are being defined for v0.7.0.

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

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
