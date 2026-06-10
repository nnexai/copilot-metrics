# Copilot Metrics

`copilot-metrics` is a local-first CLI for estimating GitHub Copilot usage from local OpenTelemetry, session logs, and hook metadata. It helps answer which Jira-style labels, repos, models, and Copilot surfaces are driving estimated AI Credit usage.

Costs are estimates, not official billing records. GitHub billing remains the source of truth.

## Install

From npm:

```bash
npx copilot-metrics@0.6.1 --help
npx copilot-metrics@0.6.1 init
```

From this checkout:

```bash
npm ci
npm test
npm run cli -- --help
```

Requires Node.js 20 or newer. The CLI uses `better-sqlite3` as its runtime SQLite backend; normal `npm`/`npx` installation installs the native dependency.

## Data Directory

By default, all metadata is stored in a user-level local folder:

- Linux: `$XDG_DATA_HOME/copilot-metrics` or `~/.local/share/copilot-metrics`
- macOS: `~/Library/Application Support/copilot-metrics`
- Windows: `%LOCALAPPDATA%\\copilot-metrics`

Override it with:

```bash
export COPILOT_METRICS_HOME=/path/to/copilot-metrics-data
```

Useful commands:

```bash
npx copilot-metrics@0.6.1 init
npx copilot-metrics@0.6.1 paths --json
```

`init` only creates the central data directory and local config. It does not modify editor or hook settings. `setup` performs integration setup for the current machine/workspace.

## Configure Telemetry

For Copilot CLI, `init` plus hooks are enough for local token reporting. Reports import Copilot's local session-state `events.jsonl` files and extract shutdown usage totals without requiring telemetry environment variables. VS Code stable and VS Code Insiders chat session logs are also configured as fallback sources by default.

Install VS Code Copilot Chat OpenTelemetry settings:

```bash
npx copilot-metrics@0.6.1 setup vscode
```

Install Copilot CLI hooks for the current workspace:

```bash
npx copilot-metrics@0.6.1 setup copilot-cli
```

Or set up both VS Code settings and workspace hooks in one command:

```bash
npx copilot-metrics@0.6.1 setup
```

Use `setup vscode --print` or `setup copilot-cli --print` to print the settings/optional environment exports without writing files. Copilot CLI OTel exports are optional because CLI token usage is read from local session-state files.

Content capture is disabled by default. Do not enable richer prompt capture unless you explicitly accept the privacy tradeoff.

## Configure Hooks

Preview repo-local hook config. The default `--surface both` emits the Copilot CLI lower camel case hook format:

```bash
npx copilot-metrics@0.6.1 hooks preview --scope local --surface both
```

Install repo-local or user-global hook config:

```bash
npx copilot-metrics@0.6.1 hooks install --scope local --surface both
npx copilot-metrics@0.6.1 hooks install --scope global --surface both
```

Local install writes `.github/hooks/copilot-metrics.json`. Global install updates `~/.copilot/settings.json` idempotently, replacing prior `copilot-metrics` hook entries while preserving other settings and hooks. Use `--surface vscode` for VS Code-only PascalCase events or `--surface copilot-cli` for CLI-native lower camel case events. The hook logger writes redacted JSONL metadata to the central data directory. It extracts Jira-style labels such as `DEMO-12345` from safe metadata and does not store full prompt text by default.

## Import Telemetry

Initialize the local SQLite store and import JSONL files manually:

```bash
npx copilot-metrics@0.6.1 store init
npx copilot-metrics@0.6.1 import --source vscode --file ~/.local/share/copilot-metrics/telemetry/vscode-copilot-otel.jsonl
npx copilot-metrics@0.6.1 import --source copilot-cli --file ~/.local/share/copilot-metrics/telemetry/copilot-cli-otel.jsonl
npx copilot-metrics@0.6.1 import --source copilot-session --file ~/.copilot/session-state/<session-id>/events.jsonl
npx copilot-metrics@0.6.1 import --source vscode-chat --file ~/.config/Code\ -\ Insiders/User/workspaceStorage/<workspace-id>/chatSessions/<session-id>.jsonl
npx copilot-metrics@0.6.1 import --source hooks --file ~/.local/share/copilot-metrics/hooks/copilot-hooks.jsonl
```

Imports persist raw records, normalized LLM usage records, hook events, label evidence, import checkpoints, and import warnings. Re-importing the same JSONL rows is idempotent. Session logs are checkpointed by source/file/line so appended logs only process new records on later reports. Usage rows also carry a cross-source exchange identity so the same response/session exchange is not added twice when OTel, VS Code fallback logs, debug-log cache evidence, or session-state data arrive at different times.

For Copilot session-state files, prompt-bearing session events are used in memory for label extraction and bounded checkpoint context; raw prompt content is not persisted. VS Code chat session files can import token-bearing fallback records from supported `.jsonl` and `.json` shapes, or reduce content-only records to label evidence linked to VS Code OTel usage by exact response ID. When `result.details` includes displayed pricing such as `0.8 credits`, `0.8 credit`, or `0x`, the displayed credit line is stored as local display evidence without storing chat content. When VS Code Copilot Chat writes a companion `GitHub.copilot-chat/debug-logs/<session-id>/main.jsonl` file, `llm_request.attrs.cachedTokens` is used as numeric cache-read evidence for that session.

## Reports

Run local reports from the SQLite store:

```bash
npx copilot-metrics@0.6.1 report labels
npx copilot-metrics@0.6.1 report label DEMO-12345
npx copilot-metrics@0.6.1 report label DEMO-12345 --detail
npx copilot-metrics@0.6.1 report models
npx copilot-metrics@0.6.1 report repos
npx copilot-metrics@0.6.1 report unattributed
```

Every report supports `--json`:

```bash
npx copilot-metrics@0.6.1 report labels --json
```

Report commands automatically import newly appended configured VS Code OTel, VS Code stable/Insiders chat session fallback logs, optional Copilot CLI OTel, Copilot CLI session-state, and hook JSONL files before querying. Repeated reports skip already imported lines and avoid adding duplicate usage for the same session exchange across sources. Add `--refresh` to any report command to re-read configured files from the beginning and merge newly available pricing evidence, such as displayed-credit details or debug-log cached-token counts, without duplicating usage rows.

`report labels` shows accumulated totals per label. `report label <id>` shows the selected label summary plus a per-model breakdown by default. Label reports include input, output, cache read, cache creation, and reasoning token totals. Labels seen only in hooks remain visible as `evidence-only` with zero usage records, so attribution hints do not imply token-bearing usage.

Manual session labels override automatic attribution in final label rankings. When several manual labels are assigned to one session, they rank alphabetically before automatic labels; default overview reports still count the session only under the final rank-1 label. Use `report label <id> --top-k <n>` or `--all-matches` to include lower-ranked manual or automatic matches. `--detail` and `--session-detail --json` expose manual provenance and timestamps while the overview output stays compact.

Report cost columns show the selected local price per Copilot session/request. Selection uses the strongest available evidence in this order: actual local charge, VS Code displayed credit, complete token estimate, upper-bound token estimate, included/zero evidence, then unknown. JSON reports expose `selected_ai_credits`, `selected_usd`, `selected_pricing_basis`, `selected_confidence`, and `selected_source` as the user-facing total fields.

Comparable estimates remain available as diagnostics. Reports still expose actual charge fields, displayed credit fields, token-price estimates, upper bounds, inferred cache reads, conflicts, and source/session evidence, but those non-selected values do not add to label, model, repo, or detail totals. Some included or request-based models can appear as `0x` in Copilot while still having published per-token prices; those rows contribute zero selected credits while retaining token estimates for audit. When displayed credits and token prices make the math bounded, reports can expose inferred effective cache-read tokens as diagnostics; observed `cache_read_tokens` is not overwritten by inferred values. The project treats 1 AI Credit as $0.01 for estimates; GitHub billing remains the source of truth.

## Attribution Model

The default extractor finds Jira-style labels such as `DEMO-12345` from safe metadata including hook labels, branch names, cwd/path values, repo metadata, and task hints.

Attribution is stored as evidence with source, field, session, repo, branch, cwd, confidence, and related usage or hook record IDs. This makes the data useful for later analysis, such as deciding whether a label was the main task or a sidetrack.

For VS Code Copilot Chat, token records from OTel are linked to chat labels by exact response ID. The OTel `gen_ai.response.id` value must match the VS Code chat session `responseId`; timestamp-only attribution is not used.

Full prompt content is not stored by default. Prompt-like fields from OTel, hooks, VS Code fallback logs, and Copilot CLI session logs are only used transiently to extract labels; stored source values are reduced to matched labels or bounded metadata.

## Custom Label Patterns and Extractors

The default extractor finds Jira-style labels. To keep the built-in metadata scanning and evidence behavior but change the regex, pass one or more repeatable `--label-patterns` options during setup or init:

```bash
copilot-metrics init --label-patterns "\\b(TEAM_[A-Z]+-\\d+)\\b"
copilot-metrics setup --label-patterns "\\b(TEAM_[A-Z]+-\\d+)\\b" --label-patterns "\\b(PROJ-\\d+)\\b"
```

The values are persisted under `labelPatterns` in the local `config.json`:

```json
{
  "labelPatterns": ["\\b(TEAM_[A-Z]+-\\d+)\\b"]
}
```

Each pattern is applied to the same safe fields as the default extractor. If the regex has a capture group, the first group is used as the label; otherwise the full match is used. Single-pattern aliases are still accepted on read as `labelPattern` or `labelRegex`, but setup writes the canonical `labelPatterns` array.

Configured patterns define what labels can be found. Confidence ranking and report inclusion semantics are separate from pattern matching.

For complete replacement logic, configure JavaScript extractors. When one or more `labelExtractors` are configured, they replace both the default Jira extractor and configured label patterns for that run.

```json
{
  "labelExtractors": ["/absolute/path/to/my-extractor.cjs"]
}
```

Relative extractor paths are resolved from the current working directory when the CLI runs.

The module should export a function, or an object with `extractLabels`. Each extractor receives:

- `sourceType`: for example `usage` or `hook`
- `sourceData`: safe metadata for that source

It returns zero or more labels, either as strings or evidence objects:

```js
const extractor = (sourceType, sourceData) => {
  if (sourceData.branch === 'main') return [];
  return [{ label: 'TEAM-123', source_field: 'branch', source_type: sourceType, confidence: 0.5 }];
};

module.exports = extractor;
```

## Release Verification

For a release candidate checkout:

```bash
npm test
npm run check
npm run smoke
npm run verify:package
```

Manual Copilot CLI validation is local-only and not run in CI:

```bash
node scripts/manual-copilot-cli-flow.js --setup-only
node scripts/manual-copilot-cli-flow.js --run-prompt --model gpt-5-mini
```

The manual prompt performs one harmless tool call so Copilot CLI hook execution can be validated; answer quality is not part of the check. During the prompt run, the helper temporarily adds generated hooks to `~/.copilot/settings.json` and restores the original settings afterward.

## Current Limits

- Costs are estimates, not official billing records.
- Official GitHub usage report reconciliation is not included in `0.6.1`.
- Local OTLP collector mode is not included in `0.6.1`.
- Richer prompt/content capture and redaction controls are not included in `0.6.1`.
- Dashboard views are deferred until the CLI/query model proves useful.
