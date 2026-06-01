# Changelog

## 0.1.7 - 2026-06-01

### Fixed

- USD and AI Credit estimates now split cached read tokens out of input totals and cache write tokens out of output totals before applying separate token prices, avoiding double-counted cache charges.
- Reasoning/thinking tokens remain reported as token metadata but are not priced as a separate category.
- Configured custom label extractors now replace the built-in Jira extractor instead of extending it.

## 0.1.6 - 2026-06-01

### Changed

- Human reports now use shorter table headers, compact token counts, 2-decimal AI Credit estimates, and a `$ est.` column for the corresponding estimated dollar amount.
- JSON reports keep exact token and estimate values for downstream processing.

## 0.1.5 - 2026-05-31

### Fixed

- VS Code Copilot token usage is now attributed to Jira labels by matching OTel `gen_ai.response.id` values to VS Code chat session `responseId` values.
- Existing local stores with older VS Code usage rows are repaired by backfilling missing response IDs from already imported raw OTel records.
- VS Code chat session files are parsed only in memory for label extraction; full chat content is not persisted in the metrics store.
- Versioned model IDs such as dated Copilot telemetry model names now use the canonical per-token pricing row when one is available, so estimates show what the token usage would cost even during included or `0x` periods.

## 0.1.4 - 2026-05-31

### Changed

- `setup` now performs setup by default: VS Code settings are merged into user settings and Copilot hooks are installed for the selected scope. `--print` keeps the old print-only behavior.
- `report label <id>` now includes a per-model breakdown by default while `report labels` remains accumulated by label.
- Human reports rename `Credits`/`Status` to clearer `AI Credits est.` and `Usage status` wording.

### Fixed

- `hooks --surface both` now installs both Copilot CLI and VS Code hook event names.
- Report auto-import skips already imported Copilot session-state files and imported JSONL lines instead of reparsing all historical session files on each report.
- Existing config files are upgraded with the Copilot session-state source instead of being left stale.

## 0.1.3 - 2026-05-31

### Fixed

- Hook install now avoids embedding transient `npx` cache shims, which can break when their shebang points at a removed Node install. Generated hooks use a stable `npx -y copilot-metrics@<version>` package invocation for those cache paths.

## 0.1.2 - 2026-05-31

### Fixed

- Reports now import Copilot CLI session-state `events.jsonl` files by default, so token statistics are collected after `init` and hooks install without requiring users to export telemetry environment variables.
- Copilot session-state imports persist only shutdown usage records, while using prompt-bearing session events in memory for label extraction and context.
- Hook-only report diagnostics now stay quiet when token-bearing Copilot session-state usage is available.

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
