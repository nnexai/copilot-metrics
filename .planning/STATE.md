---
gsd_state_version: 1.0
milestone: v0.1.1
milestone_name: Local Copilot Usage Tracker
status: completed
last_updated: "2026-05-30T08:07:34.481Z"
last_activity: 2026-05-30 — Milestone v0.1.1 completed and archived
progress:
  total_phases: 7
  completed_phases: 7
  total_plans: 6
  completed_plans: 6
  percent: 100
---

# State: Copilot Metrics

**Initialized:** 2026-05-30
**Status:** v0.1.1 milestone complete

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-30)

**Core value:** Give the user a trustworthy local CLI explanation of which Jira labels, repos, models, and Copilot surfaces are driving estimated AI Credit usage.
**Current focus:** Milestone v0.1.1 archived; cleanup/commit gate pending

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

Phase: Milestone v0.1.1 complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-05-30 — Milestone v0.1.1 completed and archived

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
- Phase 6 added and completed `copilot-metrics@0.1.1`: setup-once config persistence, idempotent auto-import before reports, complete cache/reasoning token reporting, hook-only label status, installed shim hook command support, docs/changelog/package version updates.
- Phase 6 automated verification passed: `npm test`, `npm run check`, `npm run smoke`, and `npm run verify:package`.

## Accumulated Context

### Roadmap Evolution

- Phase 6 added: `copilot-metrics@0.1.1` patch release for setup-once behavior, automatic hook/source imports before reports, complete token reporting including cache/reasoning tokens, and clear hook-only attribution semantics.

## Quick Tasks Completed

| Date | Quick ID | Task |
|------|----------|------|
| 2026-05-31 | 260531-w8w | Improve report label usability, setup install behavior, hook event coverage, and repeated import caching for `v0.1.4`. |
| 2026-05-31 | 260531-vscode-response-attribution | Fix VS Code response ID label attribution, existing-store repair, and release `v0.1.5`. |

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
