---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Local Copilot Usage Tracker
status: ready_to_plan
last_updated: 2026-05-30T06:36:16.122Z
last_activity: 2026-05-30 -- Phase 3 execution started
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 3
  completed_plans: 3
  percent: 40
stopped_at: Phase 3 complete (1/1) — ready to discuss Phase 4
---

# State: Copilot Metrics

**Initialized:** 2026-05-30
**Status:** Ready to plan

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-30)

**Core value:** Give the user a trustworthy local CLI explanation of which Jira labels, repos, models, and Copilot surfaces are driving estimated AI Credit usage.
**Current focus:** Phase 4 — hardening and release readiness

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

Phase 3: Jira Label Attribution and CLI Querying

## Current Position

Phase: 4
Plan: Not started
Status: Executing Phase 3
Last activity: 2026-05-30

Next command:

```bash
$gsd-discuss-phase 3
```

## Notes

- User requested Node.js/npm for scripts.
- User requested metadata stored locally in a central user-level folder.
- User clarified the project focus is easy-install CLI tools, scripts, and hooks.
- User clarified Jira ticket IDs such as `DEMO-12345` are the most important labels and should be extracted from prompts, directories, branches, and tool-call context.
- User clarified dashboard work is not a current priority; queries need human-readable and machine-readable output.
- User clarified Copilot CLI integration tests may call the real CLI or test environments, but should use cheap models because verification is about output and telemetry shape.
- User supplied research context for OTel-based local Copilot usage tracking.
- Official billing/usage details are date-sensitive; pricing and API behavior should be refreshed during implementation.
- Phase 1 created the initial npm/npx-friendly CLI, central data directory helper, setup guidance, local/global hook config preview/install, redacted hook logger, README, tests, and `skills/copilot-metrics/SKILL.md`.
- Phase 5 added for GitHub Actions, GitHub repository readiness, npm package metadata, and npm publishing preparation.
- Phase 2 added SQLite-backed import, OTel normalization, GitHub AI Credit estimate pricing, malformed-row warnings, unknown-model warnings, and fixture coverage for VS Code, Copilot CLI, and hook JSONL.
