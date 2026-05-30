---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Local Copilot Usage Tracker
status: ready_for_audit
last_updated: "2026-05-30T07:20:00.000Z"
last_activity: 2026-05-30 -- Phase 4/4.1 release readiness complete; manual Copilot CLI telemetry and hook validation passed with gpt-5-mini
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 5
  completed_plans: 5
  percent: 100
---

# State: Copilot Metrics

**Initialized:** 2026-05-30
**Status:** Ready for audit

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-30)

**Core value:** Give the user a trustworthy local CLI explanation of which Jira labels, repos, models, and Copilot surfaces are driving estimated AI Credit usage.
**Current focus:** Release-candidate audit

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

All planned implementation phases complete

## Current Position

Phase: All
Plan: 5 of 5
Status: Ready for audit
Last activity: 2026-05-30 -- Phase 4/4.1 release readiness complete; manual Copilot CLI telemetry and hook validation passed with gpt-5-mini

Next command:

```bash
$gsd-audit-milestone
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
- Phase 4.1 was inserted after user correction that VS Code also has hook support and must be researched instead of guessed.
- Phase 4 added release candidate docs, MIT license, changelog, package metadata/files allowlist, smoke/package verification, GitHub Actions npm publish workflow, and manual Copilot CLI validation helper.
- Automated verification passed: `npm test`, `npm run check`, `npm run smoke`, and `npm run verify:package`.
- Manual Copilot CLI validation passed with `gpt-5-mini`: telemetry JSONL existed and imported, hook JSONL existed, and hook import recorded 16 hook events.
