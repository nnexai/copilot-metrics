# Phase 4 Verification: Hardening and Release Readiness

## Automated Verification

Command:

```bash
npm test && npm run check && npm run smoke && npm run verify:package
```

Result: PASS

Evidence:

- `node --test`: 24 passing tests.
- `npm run check`: syntax check passed for `bin/copilot-metrics.js` and `src/*.js`.
- `npm run smoke`: fixture end-to-end import/report smoke passed in a temporary home.
- `npm run verify:package`: package verification passed for `copilot-metrics@0.1.0`.
- Package dry-run reported 20 files and unpacked size around 72 KB.

## Manual Copilot CLI Validation

Manual helper:

```bash
node scripts/manual-copilot-cli-flow.js --setup-only
node scripts/manual-copilot-cli-flow.js --run-prompt --model gpt-5-mini
```

Result: PASS

- Setup/helper path exists and creates an isolated example Git workspace.
- The helper initializes `copilot-metrics`, installs repo-local hooks, writes Copilot CLI OTel environment exports, temporarily applies user-level Copilot CLI hook settings, and restores the original settings afterward.
- Authenticated run with `gpt-5-mini` completed a harmless `pwd` prompt.
- Telemetry validation: `telemetryExists: true`, Copilot CLI import succeeded with `raw_records: 51` and `usage_records: 11` in the reused example workspace.
- Hook validation: `hooksExist: true`, hook import succeeded with `raw_records: 16` and `hook_events: 16`.

## Release Verification

- README rewritten as current-state product docs.
- `CHANGELOG.md` contains one aggregated `0.1.0` entry.
- `LICENSE` is MIT.
- `RELEASE.md` documents GitHub Actions npm publish flow and post-publish checks.
- GitHub Actions publish workflow runs `npm ci`, `npm test`, `npm run check`, `npm run smoke`, and `npm run verify:package` before publishing through release-created gate.

## Residual Risk

VS Code hook execution remains a documented/manual path for `0.1.0`; the release gate validated Copilot CLI telemetry and hook collection locally.
