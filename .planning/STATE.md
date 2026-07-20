---
gsd_state_version: 1.0
milestone: v0.7.0
milestone_name: Ingestion and Reporting Scalability
current_phase: 20
current_phase_name: Incremental JSONL and Lightweight Collection
current_plan: 2
total_plans_in_phase: 3
status: executing
stopped_at: Completed 20-01-PLAN.md
last_updated: "2026-07-20T09:25:25.013Z"
last_activity: 2026-07-20
last_activity_desc: Completed Plan 20-01 incremental JSONL byte checkpoints
progress:
  total_phases: 2
  completed_phases: 0
  total_plans: 3
  completed_plans: 1
  percent: 33
---

# State: Copilot Metrics

**Initialized:** 2026-05-30
**Status:** v0.7.0 Phase 20 in progress

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-07-20)

**Core value:** Give the user a trustworthy local CLI explanation of which Jira labels, repos, models, and Copilot surfaces are driving estimated AI Credit usage.
**Current focus:** Phase 20 — Incremental JSONL and Lightweight Collection

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

Phase: 20 of 21 (Incremental JSONL and Lightweight Collection)
Plan: 2 of 3
Status: Ready to execute
Last activity: 2026-07-20 — v0.7.0 roadmap created with 13/13 requirements mapped

Progress: [███░░░░░░░] 33%

## Current Roadmap

Two coarse phases execute in order:

- Phase 20: incremental JSONL checkpoints plus lightweight hook/debug-log collection.
- Phase 21: store/report scalability, benchmarks, and release verification.

## Accumulated Context

### Decisions

- Phase 20 owns input-side scaling and its fixture verification so recovery semantics are proven before store/report optimization.
- Phase 21 owns store/report scaling and final benchmark/release proof while preserving all observable contracts.
- [Phase 20]: Store versioned JSONL byte offsets and completed-line counts in import checkpoint context.
- [Phase 20]: Advance JSONL checkpoints only through complete newlines and retry trailing partial bytes.
- [Phase 20]: Validate stable file identity with dev:ino where the platform exposes it.

### Blockers/Concerns

None.

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

- Discuss or plan Phase 20.

## Session Continuity

Last session: 2026-07-20T09:24:41.232Z
Stopped at: Completed 20-01-PLAN.md
Resume file: None

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 20 P01 | 9min | 3 tasks | 3 files |
