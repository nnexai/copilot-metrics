# Phase 7: 0.1.8 Session log fallback ingestion - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship `copilot-metrics@0.1.8` with default local session-log fallback ingestion for VS Code stable, VS Code Insiders, and Copilot CLI. Reports should still produce useful token-bearing estimates when hooks and OpenTelemetry are unavailable, while keeping full prompt/content capture disabled unless explicitly configured.

</domain>

<decisions>
## Implementation Decisions

### Source Discovery and Setup
- Default setup must persist explicit fallback source configuration for VS Code stable, VS Code Insiders, and Copilot CLI session logs; env vars remain override-only.
- Built-in fallback paths should be retained when users add custom fallback directories or files.
- Source discovery should accept directories and files, recurse only through known session-log layouts, and deduplicate by source/file.
- Platform default paths should be testable without mutating the real user environment.

### Import and Idempotence
- Fallback imports are first-class auto-import sources before report queries, alongside OTel and hooks.
- Repeated report runs must not double-count fallback usage or fallback label evidence.
- VS Code fallback should parse supported `.jsonl` and `.json` chat/session files and import token-bearing records when token metrics are present.
- Copilot CLI fallback should continue reading `session-state/*/events.jsonl` and map shutdown model metrics into normalized usage records.

### Attribution and Privacy
- Fallback usage must run through the same `runLabelExtractors` callback path as OTel and hooks, preserving configured custom extractor override semantics.
- Fallback-derived evidence must preserve source type, source field, source value, confidence, session ID, and usage record linkage.
- Content capture stays disabled by default: prompt-like fields may be used transiently for label extraction, but raw prompts/responses are not persisted unless explicit content capture support is added later.
- Prompt-derived evidence values should remain redacted to the label or other bounded metadata, not full prompt text.

### Diagnostics and Reports
- Diagnostics should distinguish missing paths, unreadable paths, unsupported formats, content-only sessions, and sessions without token metrics.
- Human and JSON report output should include fallback diagnostics and remind users that fallback estimates are advisory and may be incomplete.
- Diagnostics should apply to all report commands, not only labels and single-label reports.
- OTel remains higher fidelity when available; fallback sources should not imply official billing precision.

### Release
- Documentation and release notes should describe default fallback paths, custom session source configuration, privacy limits, and advisory estimate behavior.
- Package version examples must derive from `package.json` guardrails already present in the repo.
- Published-package validation should happen outside the checkout after publish; repo-local verification should use `node bin/copilot-metrics.js` or npm scripts.

### the agent's Discretion
Planner and implementer may choose exact helper/module boundaries, warning codes, and parser heuristics as long as tests prove the phase requirements.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/paths.js` resolves central data, OTel paths, hooks, `COPILOT_HOME`, and Copilot session-state paths.
- `src/setup.js` writes persisted config and already includes OTel, hook, and Copilot CLI session source fields.
- `src/ingest.js` has `configuredSourceFiles`, `autoImportConfiguredSources`, `ingestFile`, VS Code chat label linking, and Copilot CLI session-state import.
- `src/otel.js` has normalization for OTel spans and Copilot CLI session shutdown model metrics.
- `src/labels.js` and `src/label-extractors.js` centralize label extraction and custom extractor override behavior.
- `src/sqlite-store.js` stores raw records, usage records, hook events, label evidence, and import warnings.
- Tests already cover setup persistence, idempotent report auto-import, VS Code chat label linking, Copilot session shutdown import, custom extractors, and report formatting.

### Established Patterns
- CLI commands are CommonJS modules with fixture-based `node:test` coverage.
- Reports auto-import configured sources before querying.
- Store writes keep raw fingerprints and import high-water state for idempotence.
- Cost estimates are advisory and use the current local pricing table.
- Content capture is disabled by default; label evidence stores bounded source values.

### Integration Points
- `resolvePaths()` should expose default fallback session locations.
- `ensureDataDirs()` should persist default fallback config while preserving user customizations.
- `configuredSourceFiles()` should expand default and custom fallback session paths and emit diagnostics for skipped/problematic paths.
- `ingestFile()` and `normalizePayload()`/new parser helpers should normalize token-bearing fallback records into existing usage records.
- `telemetryDiagnostics()` and report command branches in `src/cli.js` should include fallback diagnostics across report outputs.
- README, CHANGELOG, RELEASE, package metadata, and verification scripts are release-facing integration points.

</code_context>

<specifics>
## Specific Ideas

Prefer a setup-once path: after `setup`, normal `report ...` commands discover local fallback logs automatically without remembered manual imports or env exports. Keep the output useful for humans and machines.

</specifics>

<deferred>
## Deferred Ideas

- Official GitHub usage report reconciliation.
- Rich opt-in content archive and redaction tooling.
- Dashboard views.
- Network proxying, private API scraping, or any behavior that makes local estimates authoritative billing.

</deferred>
