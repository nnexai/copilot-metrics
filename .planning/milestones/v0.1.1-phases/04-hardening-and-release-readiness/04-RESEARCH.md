# Phase 4: Hardening and Release Readiness - Research

## Research Summary

Phase 4 is release hardening for `0.1.0`. The existing package already has a CLI bin, tests, and a GitHub Actions publish workflow, but an initial `npm pack --dry-run --json` showed that npm would include `.codex/` and `.planning/` artifacts without a package `files` allowlist. That is a release blocker.

## Relevant Existing Patterns

- `package.json` already has `version: 0.1.0`, `license: MIT`, a `bin` entry, `npm test`, and `npm run check`.
- `.github/workflows/npm-publish.yml` exists and publishes on GitHub release creation, but currently only runs `npm test` before publishing.
- `README.md` documents setup/import/report commands but still needs release-candidate polish and current-state framing.
- No `LICENSE`, `CHANGELOG.md`, release checklist, or package allowlist exists yet.
- The CLI can already generate VS Code and Copilot CLI telemetry config and install local/global hook config.

## Planning Implications

- Add `files` to `package.json` rather than relying on `.npmignore`; this is the stricter npm publish contract.
- Add a package smoke script that can be run in CI and does not invoke real Copilot CLI.
- Keep real Copilot CLI validation manual/local and document the required example workspace flow.
- Update GitHub Actions so CI validates tests, syntax, package smoke, and pack contents without collecting real telemetry.

## Validation Architecture

- `npm test`
- `npm run check`
- npm smoke script using fixture imports and report assertions in a temp home
- `npm pack --dry-run --json` with an assertion that package contents exclude `.planning`, `.codex`, local telemetry, and test fixtures unless intentionally included
- Manual local Copilot CLI validation evidence recorded in verification
