# Changelog

## 0.5.1 - 2026-06-09

### Fixed

- Manual label reports now deduplicate historical Copilot session usage rows that used different `usage_identity` formats for the same `span_id` and model.
- `--refresh` now repairs duplicate Copilot session usage rows in the local store, not only VS Code fallback duplicates.
- Hyphenated Claude model IDs such as `claude-haiku-4.5` now resolve to the existing static pricing row.
- Human `report labels` output now renders `Last` consistently as local system date-time values, including numeric epoch timestamps.

## 0.5.0 - 2026-06-09

### Added

- Manual session labels now participate in `label-confidence:v1` rankings as the highest-precedence attribution source.
- Detail and session-detail label reports expose manual assignment provenance, including manual assignment timestamps in JSON output.
- Fixture tests now cover manual assignment, replacement, removal, report inclusion, unattributed exclusion, and stale-provenance behavior.

### Changed

- Default label reports remain compact and non-overlapping: manually labeled sessions contribute to only their final rank-1 label unless `--top-k` or `--all-matches` is requested.
- Automatic label evidence remains stored and visible in detail/audit output after manual labels override the default report attribution.

## 0.4.0 - 2026-06-03

### Added

- `init` and `setup` now accept repeatable `--label-patterns` flags and persist them as canonical `labelPatterns`.
- Label confidence ranking now derives deterministic per-session rankings from granular evidence rows using `label-confidence:v1`.
- JSON label reports now expose confidence metadata, inclusion mode, overlap status, and evidence summaries.
- `report label <id>` supports `--top-k <n>`, `--top-k all`, `--all-matches`, and `--session-detail`.

### Changed

- Label overview reports now assign each ranked session to exactly one top-confidence label by default.
- Specific-label reports now default to sessions where the requested label is rank 1.
- Broad label inclusion is now explicit and marked as overlapping in JSON output.

## 0.3.0 - 2026-06-02

### Added

- Local config can now provide `labelPatterns` to customize the built-in label extractor's regex while keeping the internal metadata scanning, evidence fields, and confidence rules.
- `labelPattern` and `labelRegex` are accepted as single-pattern aliases for simple configs.

### Changed

- JavaScript `labelExtractors` remain full replacement extractors. When configured, they override both the default Jira pattern and any configured `labelPatterns`.

## 0.2.1 - 2026-06-02

### Added

- Reports now expose selected pricing fields for each usage row and aggregate: selected AI Credits, selected USD, selected pricing basis, selected confidence, and selected source.
- VS Code usage repair now collapses duplicate OTel/chat-session rows that refer to the same response or session/model/timestamp identity, including dated model aliases.
- Import/report refresh results include duplicate-repair counts when existing VS Code rows are collapsed.

### Changed

- Human report cost columns now show selected totals (`Cr sel.` / `$ sel.`) instead of comparable token estimates.
- Label, model, repo, detail, and unattributed report totals now sum one selected price per Copilot session/request.
- Displayed `0x` rows contribute zero selected credits while retaining token estimates as diagnostics.
- VS Code request identities no longer include token buckets, so cache-read upgrades and fallback/OTel merges do not create duplicate usage rows.

## 0.2.0 - 2026-06-02

### Added

- VS Code and VS Code Insiders chat-session fallback imports now parse displayed credit details such as `0.8 credits`, `0.8 credit`, and `0x`.
- Displayed VS Code credits are stored as local observed display evidence with display text, source/session/request evidence, selected pricing basis, confidence, and diagnostics.
- Pricing precedence now selects actual local charge evidence first, displayed credits second, high-confidence token estimates third, and upper-bound token estimates last.
- Reports expose displayed-credit fields and inferred effective cache-read diagnostics in label, detail, model, repo, and unattributed JSON output.

### Changed

- Human reports now include a compact `display*` pricing marker for VS Code displayed-credit evidence.
- `--refresh` can upgrade existing matching VS Code fallback rows with newly parsed displayed-credit evidence without duplicating usage records.
- Displayed credits can produce bounded inferred cache-read diagnostics when model pricing and token buckets make the delta explainable, while observed `cache_read_tokens` remains untouched.

## 0.1.9 - 2026-06-02

### Added

- Pricing evidence fields now distinguish trusted observed local charge evidence, high-confidence token-price estimates, upper-bound estimates, cache-read status, pricing source, confidence, and diagnostics in JSON reports.
- Copilot CLI session-state imports now preserve `totalNanoAiu`, request cost/count, premium request counters, and comparable estimates without treating included/zero request cost as proof of zero token value.
- VS Code chat fallback imports now use session-local model pricing metadata and companion debug logs at `GitHub.copilot-chat/debug-logs/<session-id>/main.jsonl` when `llm_request.attrs.cachedTokens` is present.
- Report commands support `--refresh` to re-read configured sources and merge newly available pricing evidence into existing usage rows without duplicating the exchange.

### Changed

- Rows with prompt/output tokens but unknown numeric cache-read counts are reported as upper-bound estimates instead of exact estimates.
- Human reports keep compact tables while adding pricing-basis markers for actual, upper-bound, and estimated values.
- Duplicate usage merge now preserves the strongest pricing evidence when OTel, VS Code fallback, debug logs, and Copilot session-state data arrive at different times.

## 0.1.8 - 2026-06-02

### Added

- VS Code stable and VS Code Insiders chat session logs are now default fallback sources, with support for token-bearing `.jsonl` and `.json` session shapes.
- Fallback imports now use source/file/line checkpoints so appended session logs process only new records on subsequent report runs.
- Usage imports now deduplicate the same session exchange across sources, so OTel and fallback session logs do not add duplicate usage rows when they report the same response at different times.
- Report diagnostics now include fallback notes for missing paths, unsupported formats, content-only sessions, and tokenless session logs.
- Human report commands now show a compact TTY progress indicator while configured sources are imported.

### Changed

- Setup persists explicit fallback session source configuration while preserving custom additional fallback paths.
- Prompt-like session fields remain transient for label extraction; raw prompt content is not persisted in fallback checkpoints.
- Import, report, and store commands now serialize access to the local SQLite store with a lock to avoid concurrent writes corrupting the database.
- Unreadable SQLite stores now produce an actionable error message instead of a raw `ErrnoError`.

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
