# Requirements: v0.1.8 Session log fallback ingestion

**Created:** 2026-06-02
**Milestone:** v0.1.8 Session log fallback ingestion

## Overview

This milestone assumes Copilot hooks and OpenTelemetry do not work reliably enough to be the only default path. `copilot-metrics` should fall back to local session-log parsing for VS Code, VS Code Insiders, and Copilot CLI, then feed the extracted records through the same local store, cost estimator, reports, and configured label extractor callback used by OTel and hooks.

## Active Requirements

### Fallback Discovery

- [ ] **FALLBACK-01**: User can run setup once and have default source discovery include VS Code stable, VS Code Insiders, and Copilot CLI session-log fallback locations without manual environment exports.
- [ ] **FALLBACK-02**: User can configure additional fallback session directories or files for VS Code, VS Code Insiders, and Copilot CLI while retaining the built-in default discovery paths.
- [ ] **FALLBACK-03**: User can see fallback source diagnostics that distinguish missing paths, unreadable files, unsupported formats, content-only sessions, and sessions without token metrics.

### Fallback Import

- [ ] **FALLBACK-04**: User can run any report command with missing hooks and missing OpenTelemetry files and still auto-import token-bearing records from discovered fallback session logs.
- [ ] **FALLBACK-05**: User can re-run report commands after fallback imports without double-counting previously imported session-log records.
- [ ] **FALLBACK-06**: User can import VS Code and VS Code Insiders chat session logs from both `.jsonl` and `.json` session files when the file shape is supported.
- [ ] **FALLBACK-07**: User can import Copilot CLI `session-state/*/events.jsonl` logs from `~/.copilot` or `COPILOT_HOME` and map shutdown model metrics into usage records.

### Label Attribution

- [ ] **FALLBACK-08**: User can rely on the same configured label extractor callback for fallback-derived labels from prompt text, directories, branches, repos, task hints, explicit labels, and session metadata.
- [ ] **FALLBACK-09**: User can inspect fallback-derived label evidence in reports with source type, source field, source value, confidence, session ID, and usage record linkage preserved.

### Privacy and Reporting

- [ ] **FALLBACK-10**: User can keep content capture disabled by default; fallback parsing stores only normalized usage fields and redacted label evidence values unless explicit content capture is enabled.
- [ ] **FALLBACK-11**: User can see human-readable and JSON report diagnostics explaining that fallback estimates are advisory and may be incomplete when session logs omit token fields.

## Future Requirements

- Official GitHub usage report reconciliation against fallback estimates.
- Rich opt-in content archive and redaction tooling for full prompt/session review.
- Dashboard views over fallback session coverage.

## Out of Scope

- Making local estimates official billing authority; GitHub billing remains the source of truth.
- Network proxying, TLS interception, or private API scraping.
- Storing full prompts or assistant responses by default.
- Requiring hooks or OTel to be installed before reports can show fallback-derived usage.

## Traceability

| Requirement | Phase |
|-------------|-------|
| FALLBACK-01 | Phase 7 |
| FALLBACK-02 | Phase 7 |
| FALLBACK-03 | Phase 7 |
| FALLBACK-04 | Phase 7 |
| FALLBACK-05 | Phase 7 |
| FALLBACK-06 | Phase 7 |
| FALLBACK-07 | Phase 7 |
| FALLBACK-08 | Phase 7 |
| FALLBACK-09 | Phase 7 |
| FALLBACK-10 | Phase 7 |
| FALLBACK-11 | Phase 7 |
