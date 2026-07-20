---
gsd_state_version: 1.0
milestone: v0.7.0
milestone_name: Ingestion and Reporting Scalability
status: completed
stopped_at: v0.7.0 published, verified, audited, and archived
last_updated: "2026-07-20T11:13:11.852Z"
last_activity: 2026-07-20
last_activity_desc: Milestone v0.7.0 completed and archived
progress:
  total_phases: 2
  completed_phases: 2
  total_plans: 6
  completed_plans: 6
current_phase: 21
current_phase_name: Store and Report Scalability and Release Verification
current_plan: 3
total_plans_in_phase: 3
---

# State: Copilot Metrics

**Initialized:** 2026-05-30
**Status:** v0.7.0 milestone complete

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-07-20)

**Core value:** Give the user a trustworthy local CLI explanation of which Jira labels, repos, models, and Copilot surfaces are driving estimated AI Credit usage.
**Current focus:** Awaiting next milestone definition

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

No active milestone; v0.7.0 Ingestion and Reporting Scalability shipped 2026-07-20.

## Current Position

Phase: Milestone v0.7.0 complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-07-20 — Milestone v0.7.0 completed and archived

## Current Roadmap

v0.7.0 phases 20-21 are archived under `.planning/milestones/v0.7.0-phases/`.

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
- [Phase 21]: Chunk deduplicated SQLite identity inputs at 400 values with conservative bind headroom.
- [Phase 21]: Derive manual rankings from raw join rows before usage aggregation dedupe.
- [Phase 21]: Confirm VER-03 only after the GitHub publish workflow, npm registry, and isolated exact-version commands succeed.

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

- Start the next milestone with /gsd-new-milestone

## Session Continuity

Last session: 2026-07-20T11:15:00Z
Stopped at: v0.7.0 published, verified, audited, and archived
Resume file: None

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 20 P01 | 9min | 3 tasks | 3 files |
| Phase 20 P02 | 4min | 3 tasks | 7 files |
| Phase 20 P03 | 6min | 3 tasks | 5 files |
| Phase 21 P01 | 9min | 3 tasks | 4 files |
| Phase 21 P02 | 12min | 3 tasks | 6 files |
| Phase 21 P03 | 2min | 2 tasks | 4 files |
