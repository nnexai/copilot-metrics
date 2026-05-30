# Changelog

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
