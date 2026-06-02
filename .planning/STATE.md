---
gsd_state_version: 1.0
milestone: v0.1.9
milestone_name: Better pricing estimates
status: complete
last_updated: "2026-06-02T12:00:00.000Z"
last_activity: 2026-06-02
progress:
  total_phases: 1
  completed_phases: 1
  total_plans: 1
  completed_plans: 1
  percent: 100
---

# State: Copilot Metrics

**Initialized:** 2026-05-30
**Status:** v0.1.9 milestone complete

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-06-02)

**Core value:** Give the user a trustworthy local CLI explanation of which Jira labels, repos, models, and Copilot surfaces are driving estimated AI Credit usage.
**Current focus:** Milestone v0.1.9 better pricing estimates

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

Phase 8: 0.1.9 Better pricing estimates

## Current Position

Phase: 8 complete
Plan: 08-01 complete
Status: Verification passed
Last activity: 2026-06-02 — Phase 8 and v0.1.9 milestone audit completed with pricing evidence fields, VS Code debug-log cached-token support, report `--refresh`, and release docs

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
- Phase 8 completed `copilot-metrics@0.1.9`: trusted observed local charge evidence via `totalNanoAiu`, session-local pricing metadata, cache-read status, upper-bound estimates, VS Code debug-log cached-token extraction, report `--refresh`, pricing-basis JSON fields, compact human report basis markers, and release docs.
- Phase 8 automated verification passed: `npm test`, `npm run check`, `npm run smoke`, `npm run verify:package`, and `npm run check:readme-version`.
- Local VS Code Insiders debug-log validation found the expected `GitHub.copilot-chat/debug-logs/<session-id>/main.jsonl` layout; sampled current files contained only `session_start` rows, so positive `llm_request.attrs.cachedTokens` extraction is fixture validated.
- v0.1.9 milestone audit passed. Complete-milestone/archive/cleanup is deferred until after the human-gated publish step because it commits, tags, archives, and deletes current planning files.

## Accumulated Context

### Roadmap Evolution

- Phase 6 added: `copilot-metrics@0.1.1` patch release for setup-once behavior, automatic hook/source imports before reports, complete token reporting including cache/reasoning tokens, and clear hook-only attribution semantics.
- Phase 7 added: `copilot-metrics@0.1.8` fallback release for default VS Code, VS Code Insiders, and Copilot CLI session-log parsing when hooks and OTel are unavailable.
- Phase 7 completed: fallback session-log ingestion now includes setup defaults, additive custom sources, VS Code `.jsonl`/`.json` token-bearing parsing, Copilot CLI session-state checkpoints, cross-source usage dedupe, fallback diagnostics, privacy-preserving raw/checkpoint storage, and `0.1.8` release docs.
- Phase 8 added: `copilot-metrics@0.1.9` pricing evidence release for actual local charge signals, session-local price metadata, cache-read availability, upper-bound estimates, and clearer report semantics.
- Phase 8 completed: `copilot-metrics@0.1.9` now separates actual local charge evidence, high-confidence estimates, upper-bound estimates, cache diagnostics, and pricing provenance across import, store, and reports.

## Quick Tasks Completed

| Date | Quick ID | Task |
|------|----------|------|
| 2026-05-31 | 260531-w8w | Improve report label usability, setup install behavior, hook event coverage, and repeated import caching for `v0.1.4`. |
| 2026-05-31 | 260531-vscode-response-attribution | Fix VS Code response ID label attribution, existing-store repair, and release `v0.1.5`. |
| 2026-06-01 | 260601-b7v | Fix `v0.1.7` cost token splitting for USD/AI Credit estimates and make custom extractors override the built-in Jira extractor. |

## Operator Next Steps

- Publish `copilot-metrics@0.1.9` through the existing release workflow when ready.
- After publish, validate from outside the checkout with `npx -y copilot-metrics@0.1.9 --help` and representative report commands.
