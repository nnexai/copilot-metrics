---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Local Copilot Usage Tracker
status: executing
last_updated: "2026-05-30T06:20:00Z"
last_activity: 2026-05-30 -- Phase 1 completed
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 1
  completed_plans: 1
  percent: 25
current_phase: 2
current_phase_name: OTel Ingestion, Normalization, and Cost Model
current_plan: 0
total_plans_in_phase: 0
---

# State: Copilot Metrics

**Initialized:** 2026-05-30
**Status:** Phase 1 complete; ready for Phase 2 discussion

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-30)

**Core value:** Give the user a trustworthy local CLI explanation of which Jira labels, repos, models, and Copilot surfaces are driving estimated AI Credit usage.
**Current focus:** Phase 2 - OTel Ingestion, Normalization, and Cost Model

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

Phase 2: OTel Ingestion, Normalization, and Cost Model

## Current Position

Phase: 2
Plan: Not started
Status: Ready to discuss
Last activity: 2026-05-30

Next command:

```bash
$gsd-discuss-phase 2
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
- Phase 1 created the initial npm/npx-friendly CLI, central data directory helper, setup guidance, local/global hook config preview/install, redacted hook logger, README, tests, and `skills/copilot-metrics/SKILL.md`.
