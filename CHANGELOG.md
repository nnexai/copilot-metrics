# Changelog

## 0.1.1 - 2026-05-30

### Added

- Setup-once report flow: report commands automatically import configured VS Code, Copilot CLI, and hook JSONL sources before querying.
- Idempotent import fingerprints so repeated reports or imports do not double-count previously ingested JSONL rows.
- Complete label token reporting for input, output, cache read, cache creation, and reasoning tokens in human and JSON output.
- Hook-only label status so attribution evidence from hooks remains visible without implying token-bearing usage.

### Changed

- `setup all` now persists the central data directory config, matching `init` for setup-once usage.
- Hook commands support installed executable shims as well as checkout-local JavaScript entrypoints.

## 0.1.0 - 2026-05-30

First local release candidate for `copilot-metrics`.

### Added

- CLI setup helpers for central local data directories, VS Code Copilot OTel settings, Copilot CLI OTel environment exports, and local/global hook config.
- Redacted hook logger that captures safe attribution metadata with content capture disabled by default.
- Local SQLite-backed import for VS Code Copilot OTel JSONL, Copilot CLI OTel JSONL, and Copilot CLI hook JSONL.
- LLM span normalization, root-agent double-count prevention, token extraction, model pricing estimates, AI Credit estimates, malformed-row warnings, and unknown-model warnings.
- Jira-style label extraction with evidence-preserving attribution by source, field, session, repo, branch, cwd, and confidence.
- Configurable custom label extractors loaded from local config without modifying package source.
- CLI reports for label overview, single-label summary/detail, models, repos/directories, and unattributed usage, with human and JSON output.
- Release smoke checks, package verification, GitHub Actions npm publishing workflow, MIT license, and release checklist.

### Notes

- Cost and AI Credit values are estimates only. GitHub billing remains the source of truth.
- Prompt/content capture is disabled by default.
- Official usage reconciliation, collector mode, richer privacy controls, and dashboard views are deferred.
