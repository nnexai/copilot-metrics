# Copilot Metrics

`copilot-metrics` is a local-first CLI for estimating GitHub Copilot usage from local OpenTelemetry and hook metadata. It helps answer which Jira-style labels, repos, models, and Copilot surfaces are driving estimated AI Credit usage.

Costs are estimates, not official billing records. GitHub billing remains the source of truth.

## Install

From npm:

```bash
npx copilot-metrics@0.1.4 --help
npx copilot-metrics@0.1.4 init
```

From this checkout:

```bash
npm ci
npm test
npm run cli -- --help
```

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
npx copilot-metrics@0.1.4 init
npx copilot-metrics@0.1.4 paths --json
```

`init` only creates the central data directory and local config. It does not modify editor or hook settings. `setup` performs integration setup for the current machine/workspace.

## Configure Telemetry

For Copilot CLI, `init` plus hooks are enough for local token reporting. Reports import Copilot's local session-state `events.jsonl` files and extract shutdown usage totals without requiring telemetry environment variables.

Install VS Code Copilot Chat OpenTelemetry settings:

```bash
npx copilot-metrics@0.1.4 setup vscode
```

Install Copilot CLI hooks for the current workspace:

```bash
npx copilot-metrics@0.1.4 setup copilot-cli
```

Or set up both VS Code settings and workspace hooks in one command:

```bash
npx copilot-metrics@0.1.4 setup
```

Use `setup vscode --print` or `setup copilot-cli --print` to print the settings/optional environment exports without writing files. Copilot CLI OTel exports are optional because CLI token usage is read from local session-state files.

Content capture is disabled by default. Do not enable richer prompt capture unless you explicitly accept the privacy tradeoff.

## Configure Hooks

Preview repo-local hook config. The default `--surface both` emits the Copilot CLI lower camel case hook format:

```bash
npx copilot-metrics@0.1.4 hooks preview --scope local --surface both
```

Install repo-local or user-global hook config:

```bash
npx copilot-metrics@0.1.4 hooks install --scope local --surface both
npx copilot-metrics@0.1.4 hooks install --scope global --surface both
```

Local install writes `.github/hooks/copilot-metrics.json`. Global install updates `~/.copilot/settings.json` idempotently, replacing prior `copilot-metrics` hook entries while preserving other settings and hooks. Use `--surface vscode` for VS Code-only PascalCase events or `--surface copilot-cli` for CLI-native lower camel case events. The hook logger writes redacted JSONL metadata to the central data directory. It extracts Jira-style labels such as `DEMO-12345` from safe metadata and does not store full prompt text by default.

## Import Telemetry

Initialize the local SQLite store and import JSONL files manually:

```bash
npx copilot-metrics@0.1.4 store init
npx copilot-metrics@0.1.4 import --source vscode --file ~/.local/share/copilot-metrics/telemetry/vscode-copilot-otel.jsonl
npx copilot-metrics@0.1.4 import --source copilot-cli --file ~/.local/share/copilot-metrics/telemetry/copilot-cli-otel.jsonl
npx copilot-metrics@0.1.4 import --source copilot-session --file ~/.copilot/session-state/<session-id>/events.jsonl
npx copilot-metrics@0.1.4 import --source hooks --file ~/.local/share/copilot-metrics/hooks/copilot-hooks.jsonl
```

Imports persist raw records, normalized LLM usage records, hook events, label evidence, and import warnings. Re-importing the same JSONL rows is idempotent. For Copilot session-state files, only shutdown usage rows are persisted; prompt-bearing session events are used in memory for label extraction and context and are not stored as raw records.

## Reports

Run local reports from the SQLite store:

```bash
npx copilot-metrics@0.1.4 report labels
npx copilot-metrics@0.1.4 report label DEMO-12345
npx copilot-metrics@0.1.4 report label DEMO-12345 --detail
npx copilot-metrics@0.1.4 report models
npx copilot-metrics@0.1.4 report repos
npx copilot-metrics@0.1.4 report unattributed
```

Every report supports `--json`:

```bash
npx copilot-metrics@0.1.4 report labels --json
```

Report commands automatically import newly appended configured VS Code OTel, optional Copilot CLI OTel, Copilot CLI session-state, and hook JSONL files before querying. Repeated reports skip already imported session-state files and already imported JSONL lines.

`report labels` shows accumulated totals per label. `report label <id>` shows the selected label summary plus a per-model breakdown by default. Label reports include input, output, cache read, cache creation, and reasoning token totals. Labels seen only in hooks remain visible as `evidence-only` with zero usage records, so attribution hints do not imply token-bearing usage.

`AI Credits est.` is a local estimate derived from the pricing table. The project treats 1 AI Credit as $0.01 for estimates; GitHub billing remains the source of truth.

## Attribution Model

The default extractor finds Jira-style labels such as `DEMO-12345` from safe metadata including hook labels, branch names, cwd/path values, repo metadata, and task hints.

Attribution is stored as evidence with source, field, session, repo, branch, cwd, confidence, and related usage or hook record IDs. This makes the data useful for later analysis, such as deciding whether a label was the main task or a sidetrack.

Full prompt content is not stored by default. Prompt-like fields are only used to extract labels and the stored source value is reduced to the matched label.

## Custom Label Extractors

Custom extractors are configured in the local `config.json`; you do not modify package source.

After `copilot-metrics init`, add a module path:

```json
{
  "labelExtractors": ["/absolute/path/to/my-extractor.cjs"]
}
```

Relative paths are resolved from the current working directory when the CLI runs.

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
- Official GitHub usage report reconciliation is not included in `0.1.4`.
- Local OTLP collector mode is not included in `0.1.4`.
- Richer prompt/content capture and redaction controls are not included in `0.1.4`.
- Dashboard views are deferred until the CLI/query model proves useful.
