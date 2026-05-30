---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Local Copilot Usage Tracker
status: ready_to_plan
last_updated: "2026-05-30T05:50:00Z"
last_activity: 2026-05-30 -- Project initialized
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
current_phase: 1
current_phase_name: Project Foundation and Local Setup
current_plan: 0
total_plans_in_phase: 0
---

# State: Copilot Metrics

**Initialized:** 2026-05-30
**Status:** Ready for Phase 1 planning

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-30)

**Core value:** Give the user a trustworthy local CLI explanation of which Jira labels, repos, models, and Copilot surfaces are driving estimated AI Credit usage.
**Current focus:** Phase 1 - Project Foundation and Local Setup

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

## Current Phase

Phase 1: Project Foundation and Local Setup

## Current Position

Phase: 1
Plan: Not started
Status: Ready to plan
Last activity: 2026-05-30

Next command:

```bash
$gsd-plan-phase 1
```

## Notes

- User requested Node.js/npm for scripts.
- User requested metadata stored locally in a central user-level folder.
- User clarified the project focus is easy-install CLI tools, scripts, and hooks.
- User clarified Jira ticket IDs such as `HDASPF-12345` are the most important labels and should be extracted from prompts, directories, branches, and tool-call context.
- User clarified dashboard work is not a current priority; queries need human-readable and machine-readable output.
- User clarified Copilot CLI integration tests may call the real CLI or test environments, but should use cheap models because verification is about output and telemetry shape.
- User supplied research context for OTel-based local Copilot usage tracking.
- Official billing/usage details are date-sensitive; pricing and API behavior should be refreshed during implementation.
