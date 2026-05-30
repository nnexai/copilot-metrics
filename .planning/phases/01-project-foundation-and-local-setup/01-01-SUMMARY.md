---
phase: 01-project-foundation-and-local-setup
plan: 01
status: complete
completed: 2026-05-30
key_files:
  - package.json
  - bin/copilot-metrics.js
  - src/cli.js
  - src/paths.js
  - src/setup.js
  - src/hook-logger.js
  - test/setup.test.js
  - README.md
  - skills/copilot-metrics/SKILL.md
---

# Phase 1 Plan 01 Summary

## Accomplishments

- Created a Node.js package scaffold with npm scripts for `test`, `check`, and local CLI execution.
- Added the `copilot-metrics` bin entrypoint for install and `npx`-style usage.
- Implemented central user-level data directory resolution with `COPILOT_METRICS_HOME` override.
- Added setup commands for VS Code Copilot OTel settings and Copilot CLI OTel environment exports with content capture disabled by default.
- Added hook preview/install commands supporting `--scope local` and `--scope global`.
- Added a redacted hook logger that appends JSONL metadata and extracts Jira-style labels without storing full prompt text by default.
- Fixed setup output after code review so generated VS Code OTel keys, Copilot CLI OTel variables, and hook config shape match current official documentation.
- Added private permission modes for generated data directories, config files, hook config files, and hook JSONL logs.
- Added an installable LLM skill document at `skills/copilot-metrics/SKILL.md`.
- Added fixture-style tests covering paths, setup snippets, hook config, hook install, and hook logger redaction.

## Verification

- `npm test` passed.
- `npm run check` passed.
- `node bin/copilot-metrics.js --help` passed.
- `node bin/copilot-metrics.js hooks preview --scope local --json` passed.
- `node bin/copilot-metrics.js setup vscode --json` passed.
- `node bin/copilot-metrics.js setup copilot-cli --json` passed.

## Notes

- Phase 1 intentionally stops at setup and capture scaffolding. Ingestion, normalization, pricing, and reporting remain for later phases.
- The generated OTel setting and environment variable names are isolated in `src/setup.js` so they can be corrected in one place if upstream tooling changes again.
