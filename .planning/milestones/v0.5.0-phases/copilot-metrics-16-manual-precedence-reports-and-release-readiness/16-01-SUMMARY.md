---
phase: 16
status: complete
completed: 2026-06-09
release: v0.5.0
commit: adea241
---

# Phase 16 Summary: Manual Precedence Reports and Release Readiness

## Delivered

- Manual session labels now participate in `label-confidence:v1` as the highest-precedence source.
- Multiple manual labels rank alphabetically before automatic labels; automatic ranks continue after manual labels.
- Matching manual and automatic labels merge into one ranking entry while preserving automatic evidence.
- Label reports apply manual attribution at output time without rewriting usage rows or deleting `label_evidence`.
- Default label reports remain compact and non-overlapping; `--top-k` and `--all-matches` include lower-ranked manual/automatic matches.
- Detail and session-detail JSON expose manual provenance and assignment timestamps.
- `report unattributed` excludes sessions with active manual labels.
- `copilot-metrics@0.5.0` was released and published through the GitHub release workflow.

## Changed Files

- `src/label-confidence.js`
- `src/reports.js`
- `src/sqlite-store.js`
- `test/label-confidence.test.js`
- `test/report.test.js`
- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`

## Release Evidence

- GitHub release: https://github.com/nnexai/copilot-metrics/releases/tag/v0.5.0
- GitHub Actions run: https://github.com/nnexai/copilot-metrics/actions/runs/27234152962
- Published package: `npm view copilot-metrics@0.5.0 version` returned `0.5.0`.
- Neutral `npx` validation succeeded with isolated `HOME`, `USERPROFILE`, `COPILOT_HOME`, and `COPILOT_METRICS_HOME`.

