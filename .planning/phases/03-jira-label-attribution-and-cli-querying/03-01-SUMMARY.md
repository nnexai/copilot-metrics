---
phase: 03-jira-label-attribution-and-cli-querying
plan: 01
status: complete
completed: 2026-05-30
key_files:
  - src/label-extractors.js
  - src/labels.js
  - src/reports.js
  - src/sqlite-store.js
  - src/ingest.js
  - src/cli.js
  - test/ingest.test.js
  - test/report.test.js
  - README.md
---

# Phase 3 Plan 01 Summary

## Accomplishments

- Added built-in Jira-style label extraction with canonical uppercase labels such as `DEMO-12345`.
- Added a custom extractor runner that receives `sourceType` and `sourceData` and returns zero or more labels.
- Added evidence-preserving attribution through a `label_evidence` table with source, field, value context, confidence, session, repo, branch, cwd, and usage/hook record links.
- Wired import-time attribution for usage records and hook events.
- Added report commands for labels, single-label summary/detail, models, repos, and unattributed usage.
- Added compact human report output and stable `--json` output.
- Kept prompt content out of default storage; prompt-like fields are reduced to matched labels.
- Updated fixtures, tests, README examples, skill examples, and planning examples to use neutral `DEMO-*` labels.

## Verification

- `npm test` passed.
- `npm run check` passed.
- `node bin/copilot-metrics.js import --source vscode --file test/fixtures/vscode-otel.jsonl --home /tmp/copilot-metrics-phase3 --json` passed.
- `node bin/copilot-metrics.js import --source hooks --file test/fixtures/hook-events.jsonl --home /tmp/copilot-metrics-phase3 --json` passed.
- `node bin/copilot-metrics.js report labels --home /tmp/copilot-metrics-phase3 --json` passed.
- `node bin/copilot-metrics.js report label DEMO-12345 --home /tmp/copilot-metrics-phase3 --json` passed.
- `node bin/copilot-metrics.js report unattributed --home /tmp/copilot-metrics-phase3` passed.

## Deviations from Plan

- Added an aggregation fix during verification so label totals sum distinct usage records per label rather than double-counting when one usage record has multiple evidence rows.
- Replaced the original sample Jira project key with `DEMO` across code, fixtures, tests, docs, and planning artifacts at user request.

**Total deviations:** 2 auto-fixed. **Impact:** Positive; reporting totals are more accurate and examples no longer resemble the existing project namespace.

## Self-Check: PASSED
