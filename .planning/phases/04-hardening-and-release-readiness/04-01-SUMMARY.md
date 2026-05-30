# Phase 4 Summary: Hardening and Release Readiness

## Outcome

Prepared `copilot-metrics@0.1.0` as a first release candidate with safe npm packaging, current-state documentation, release checks, GitHub Actions npm publishing, and a local-only Copilot CLI validation helper.

## Implemented

- Added MIT `LICENSE`.
- Added aggregated `CHANGELOG.md` for `0.1.0`.
- Added `RELEASE.md` with local checks, GitHub Actions publish flow, required npm secret, and post-publish verification.
- Added package metadata, repository links, keywords, npm `files` allowlist, and release verification scripts.
- Added `scripts/smoke.js` for CI-safe fixture import/report validation.
- Added `scripts/verify-package.js` to fail if npm pack includes `.planning/`, `.codex/`, tests, telemetry JSONL, or SQLite stores.
- Added `scripts/manual-copilot-cli-flow.js` for local Copilot CLI validation with a cheap mini model.
- Updated README to describe the current install/setup/import/report/custom-extractor/release state.
- Updated GitHub Actions so npm publish is automated from a GitHub release with verification gates.
- Made custom label extractors configuration-driven via local `config.json`.

## Verification

- `npm test`: PASS, 23 tests.
- `npm run check`: PASS.
- `npm run smoke`: PASS.
- `npm run verify:package`: PASS.
- Manual Copilot CLI validation helper exists; final authenticated hook run is blocked by current local CLI auth state.

## Follow-Up

After local Copilot auth is restored, rerun:

```bash
node scripts/manual-copilot-cli-flow.js --run-prompt --model gpt-5-mini
```
