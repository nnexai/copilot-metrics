# Copilot Metrics

Local-first tools for estimating Copilot usage from local telemetry and hook metadata. The project is CLI-first and keeps official billing separate: reported costs are estimates, not GitHub billing records.

## Install And Run

From this checkout:

```bash
npm test
npm run cli -- --help
```

After publishing or linking the package, the same command surface is intended to work through `npx`:

```bash
npx copilot-metrics init
npx copilot-metrics setup vscode
npx copilot-metrics setup copilot-cli
npx copilot-metrics hooks preview --scope local
npx copilot-metrics hooks install --scope global
```

## Data Directory

By default, metadata is stored in a user-level folder:

- Linux: `$XDG_DATA_HOME/copilot-metrics` or `~/.local/share/copilot-metrics`
- macOS: `~/Library/Application Support/copilot-metrics`
- Windows: `%LOCALAPPDATA%\\copilot-metrics`

Override with:

```bash
export COPILOT_METRICS_HOME=/path/to/copilot-metrics-data
```

Run:

```bash
npx copilot-metrics init
npx copilot-metrics paths
```

## Telemetry Setup

`setup vscode` prints VS Code Insiders Copilot Chat OpenTelemetry settings that write JSONL to the central data directory:

```bash
npx copilot-metrics setup vscode
```

`setup copilot-cli` prints Copilot CLI OpenTelemetry environment exports:

```bash
npx copilot-metrics setup copilot-cli
```

Content capture is disabled by default in generated setup output. Do not enable richer prompt capture unless you explicitly accept the privacy tradeoff.

## Hook Setup

Preview hook configuration without writing files:

```bash
npx copilot-metrics hooks preview --scope local
npx copilot-metrics hooks preview --scope global
```

Install hook configuration:

```bash
npx copilot-metrics hooks install --scope local
npx copilot-metrics hooks install --scope global
```

Local scope writes `.github/hooks/copilot-metrics.json` in the current repo. Global scope writes `~/.copilot/hooks/copilot-metrics.json`.

The hook logger appends redacted JSONL metadata to the central data directory. It extracts Jira-style labels such as `DEMO-12345` from safe metadata and does not store full prompt text by default.

## LLM Skill

An installable skill template is available at `skills/copilot-metrics/SKILL.md`. It tells LLM agents to query local paths and reports through the CLI, and to avoid reading raw prompt content unless content capture has been explicitly enabled.

## Import Telemetry

Phase 2 adds a local SQLite store through the portable npm dependency `sql.js`; npm/npx/node are the only runtime prerequisites.

```bash
npx copilot-metrics store init
npx copilot-metrics import --source vscode --file ~/.local/share/copilot-metrics/telemetry/vscode-copilot-otel.jsonl
npx copilot-metrics import --source copilot-cli --file ~/.local/share/copilot-metrics/telemetry/copilot-cli-otel.jsonl
npx copilot-metrics import --source hooks --file ~/.local/share/copilot-metrics/hooks/copilot-cli-hooks.jsonl
npx copilot-metrics pricing list --json
```

Imports persist raw records, normalized LLM usage records, hook events, and import warnings. Costs are labeled estimates and use the local pricing table version shown by `pricing list`.

## Reports

Phase 3 adds local reports over the SQLite store:

```bash
npx copilot-metrics report labels
npx copilot-metrics report label DEMO-12345
npx copilot-metrics report label DEMO-12345 --detail
npx copilot-metrics report models
npx copilot-metrics report repos
npx copilot-metrics report unattributed
```

Every report supports `--json` for machine-readable output:

```bash
npx copilot-metrics report labels --json
```

The default extractor finds Jira-style labels such as `DEMO-12345` from safe metadata including hook labels, branch names, cwd/path values, repo metadata, and task hints. Attribution is stored as evidence with source, field, session, repo, branch, cwd, confidence, and related usage or hook record IDs. This keeps the data useful for later analysis, such as deciding whether a label was the main task or a sidetrack.

Full prompt content is not stored by default. Prompt-like fields are only used to extract labels and the stored source value is reduced to the matched label.

## Custom Label Extractors

Custom extractors can be plugged into the label extraction pipeline by calling `runLabelExtractors(sourceType, sourceData, customExtractors)` from `src/label-extractors.js`. Each extractor receives:

- `sourceType`: for example `usage` or `hook`
- `sourceData`: safe metadata for that source

It returns zero or more labels, either as strings or evidence objects:

```js
const extractor = (sourceType, sourceData) => {
  if (sourceData.branch === 'main') return [];
  return [{ label: 'TEAM-123', source_field: 'branch', source_type: sourceType, confidence: 0.5 }];
};
```

## Current Limits

Costs are estimates, not official billing records. Primary-label and sidetrack classification are intentionally left to downstream analysis built on top of the stored label evidence.
