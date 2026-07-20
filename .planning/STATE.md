---
gsd_state_version: 1.0
milestone: v0.7.0
milestone_name: Ingestion and Reporting Scalability
current_phase: 21
current_phase_name: Store and Report Scalability and Release Verification
status: executing
stopped_at: Completed 21-01-PLAN.md
last_updated: "2026-07-20T10:24:37.267Z"
last_activity: 2026-07-20
last_activity_desc: Completed Plan 21-01 versioned store maintenance and persistent indexes
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 6
  completed_plans: 4
current_plan: 1
total_plans_in_phase: 3
---

# State: Copilot Metrics

**Initialized:** 2026-05-30
**Status:** Executing

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-07-20)

**Core value:** Give the user a trustworthy local CLI explanation of which Jira labels, repos, models, and Copilot surfaces are driving estimated AI Credit usage.
**Current focus:** Phase 21 — Store and Report Scalability and Release Verification

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

Phase: 21 of 21 (Store and Report Scalability and Release Verification)
Plan: 1 of 3
Status: Executing — Plan 21-01 complete
Last activity: 2026-07-20 — Completed versioned store maintenance and persistent index plan

Progress: [███████░░░] 67%

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
- [Phase 20]: Keep legacy hook-log compatibility while generated hooks use the dedicated hook executable.
- [Phase 20]: Use npx --package to select the secondary hook bin without embedding ephemeral cache paths.
- [Phase 20]: Scope VS Code debug caches to one source import and key parsed results by resolved sidecar path.
- [Phase 20]: Make benchmark correctness assertions blocking while treating elapsed timings as machine-dependent evidence.
- [Phase 21]: Use SQLite user_version for ordered schema lifecycle and store_metadata for maintenance state.
- [Phase 21]: Invalidate repair markers only inside relevant usage mutation transactions.
- [Phase 21]: Require named persistent indexes for measured label, session, and VS Code backfill plans.

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

- Execute Plan 21-02 batched import identities, shared report context, and scalability benchmarks.

## Session Continuity

Last session: 2026-07-20T10:24:37.261Z
Stopped at: Completed 21-01-PLAN.md
Resume file: None

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 20 P01 | 9min | 3 tasks | 3 files |
| Phase 20 P02 | 4min | 3 tasks | 7 files |
| Phase 20 P03 | 6min | 3 tasks | 5 files |
| Phase 21 P01 | 9min | 3 tasks | 4 files |
