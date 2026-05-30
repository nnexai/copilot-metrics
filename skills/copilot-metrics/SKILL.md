---
name: copilot-metrics
description: Query local Copilot Metrics data through the CLI without reading sensitive raw prompt content by default.
---

# Copilot Metrics Skill

Use this skill when the user asks which Jira labels, repos, models, or Copilot surfaces are driving estimated local Copilot usage.

## Rules

- Use the `copilot-metrics` CLI instead of reading raw telemetry files directly.
- Start with `copilot-metrics paths --json` to find the local data directory.
- If the data directory is missing, suggest `copilot-metrics init`.
- Treat all costs as estimates, not official GitHub billing records.
- Do not read or display full prompts unless the user explicitly says content capture is enabled and asks for that content.
- Prefer machine-readable output when summarizing for another tool: use `--json` where available.

## Useful Commands

```bash
copilot-metrics paths --json
copilot-metrics setup vscode --json
copilot-metrics setup copilot-cli --json
copilot-metrics hooks preview --scope local --json
```

Future report commands should be preferred when present, for example:

```bash
copilot-metrics report labels --json
copilot-metrics report label HDASPF-12345 --json
copilot-metrics report unattributed --json
```

If a future report command is unavailable, explain that ingestion and reporting have not been implemented in this checkout yet.
