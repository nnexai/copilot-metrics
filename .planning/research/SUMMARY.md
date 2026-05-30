# Research Summary: Copilot Metrics

**Date:** 2026-05-30
**Basis:** User-provided research brief plus current official GitHub and VS Code documentation checks.

## Key Findings

**Stack:** Build Node.js/npm CLI tools, scripts, and hooks around file-based OpenTelemetry JSONL ingestion first. Use a central user-level data directory, SQLite or DuckDB for normalized local storage, and optional OTLP collector support later.

**Table Stakes:** The tool must install easily, ingest VS Code Insiders Copilot OTel, ingest Copilot CLI OTel, capture CLI hook metadata, normalize token fields, estimate AI Credits, extract Jira labels such as `HDASPF-12345`, and expose label/model/repo/unattributed CLI views.

**Watch Out For:** Do not double-count root agent spans and lower-level chat spans. Do not treat local estimates as official billing. Do not enable full content capture by default. Do not depend on admin-only GitHub metrics APIs for v1.

## Source Notes

- GitHub Copilot usage-based billing starts June 1, 2026, with model/token pricing published by GitHub and AI Credits valued at $0.01.
- Code completions and next edit suggestions are not billed through AI Credits, so v1 focuses on chat, agents, CLI, and similar model interactions.
- VS Code Copilot Chat can emit OpenTelemetry for agent interactions, LLM calls, tool executions, token usage, and related context.
- Copilot CLI supports OpenTelemetry and hooks; hooks can add task/session/cwd/transcript context.
- Official Copilot metrics and reports are useful for reconciliation but can require organization or enterprise permissions and are not task-level.

## Recommended Local Architecture

```text
VS Code Insiders Copilot OTel  \
Copilot CLI OTel                -> JSONL ingester -> normalized local store -> CLI queries
Copilot CLI hooks              /
```

## Implementation Implications

- Provide setup helpers that print or write recommended VS Code settings and shell exports.
- Default paths should live under a central user folder such as `~/.local/share/copilot-usage`.
- Normalize records around timestamp, surface, conversation/session ID, repo, branch, cwd, Jira label, model, token categories, and estimated cost.
- Keep the pricing table versioned locally and updatable because model pricing can change.
- Add label overview, label summary, label detail, and unattributed usage commands so the user can improve labeling habits over time.
- Support human-readable and machine-readable output from the start.
