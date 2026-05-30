# AGENTS.md

## Project Context

This repo uses GSD planning artifacts under `.planning/`. Read these first:

1. `.planning/PROJECT.md`
2. `.planning/REQUIREMENTS.md`
3. `.planning/ROADMAP.md`
4. `.planning/STATE.md`

## Implementation Direction

- Use Node.js and npm scripts.
- Store app metadata locally in a central user-level folder by default.
- Prioritize easy-to-install CLI tools, scripts, and hooks over dashboard work.
- Treat Jira ticket IDs such as `HDASPF-12345` as the primary label format.
- Extract labels from prompts, directories, branches, hooks, and tool-call context when available.
- Provide human-readable and machine-readable output for query/report commands.
- Prefer local JSONL ingestion and local storage before adding services.
- Treat Copilot cost numbers as estimates, not official billing.
- Keep content capture disabled by default and avoid storing full prompts unless explicitly requested.

## Verification

When code exists, keep verification runnable through npm scripts. Add fixture-based tests for telemetry parsing, span classification, cost estimation, attribution, and reports.
