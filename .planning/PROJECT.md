# Copilot Metrics

## What This Is

Copilot Metrics is a local Node.js/npm-based toolkit for estimating GitHub Copilot usage costs from local OpenTelemetry and session metadata. Its focus is easy-to-install CLI tools, scripts, and hooks that attribute VS Code Insiders Copilot Chat/agent and Copilot CLI usage to Jira-style labels such as `HDASPF-12345`, then expose human-readable and machine-readable reports without depending on admin-only GitHub billing access.

## Core Value

Give the user a trustworthy local CLI explanation of which Jira labels, repos, models, and Copilot surfaces are driving estimated AI Credit usage.

## Requirements

### Validated

(None yet - ship to validate)

### Active

- [ ] Collect VS Code Insiders Copilot OpenTelemetry JSONL from user-configured file exports.
- [ ] Collect Copilot CLI OpenTelemetry JSONL from user-configured file exports.
- [ ] Capture Copilot CLI task attribution metadata through local hooks.
- [ ] Store all application metadata locally in a central user-level folder.
- [ ] Extract Jira-style labels such as `HDASPF-12345` from prompts, directories, branches, tool calls, and hook metadata.
- [ ] Normalize LLM chat/model-call spans into a local queryable store without double-counting root agent spans.
- [ ] Estimate GitHub AI Credits from model-specific token categories and pricing tables.
- [ ] Provide CLI-first reports for label overview, summarized usage per label, detailed usage per label, model, repo/directory, and unattributed usage.
- [ ] Provide both human-readable and machine-readable output for queries and reports.
- [ ] Keep sensitive content capture disabled by default and avoid storing full prompts unless explicitly enabled.

### Out of Scope

- Official billing authority - GitHub's billing system remains the source of truth.
- Admin-only enterprise/org usage report ingestion in v1 - useful for reconciliation, but not required for a non-admin local tracker.
- Network proxying or TLS interception - fragile and risky for work credentials.
- Inline code completion billing analysis - code completions and next edit suggestions are not billed through AI Credits.
- Cloud-only or GitHub.com-only interactions in v1 - local OTel and CLI hooks cannot reliably observe those surfaces.

## Context

GitHub is moving Copilot to usage-based billing on June 1, 2026. The relevant unit is GitHub AI Credits, with published pricing tables mapping model token categories to cost and 1 AI Credit equal to $0.01. Local estimates can differ from official billing because GitHub may apply rounding, hidden prompt behavior, product routing, server-side accounting, or observe interactions not emitted from the user's machine.

The strongest local signal is OpenTelemetry. VS Code Copilot Chat can emit OTel traces, metrics, and events with GenAI-style attributes for agent interactions, LLM calls, tool executions, token usage, model information, and Git context. Copilot CLI can also emit OTel and supports local hooks at lifecycle points such as session start, user prompt submission, tool usage, and stop.

The project should start with file-based exports because they are easy to inspect:

- VS Code Insiders writes to a user-level JSONL path such as `~/.local/share/copilot-usage/vscode-copilot-otel.jsonl`.
- Copilot CLI writes to a user-level JSONL path such as `~/.local/share/copilot-usage/copilot-cli-otel.jsonl`.
- Copilot CLI hooks write redacted task/session metadata such as session ID, cwd, transcript path, task hint, and prompt preview.

The most important attribution convention is Jira ticket IDs such as `HDASPF-12345`. Labels should be extracted from explicit prompt text, the current directory, branch names, hook payloads, transcript references, and tool-call metadata where available. Branch names and cwd/repo provide fallback attribution when prompt labels are missing.

## Constraints

- **Runtime**: Use Node.js with npm scripts - requested implementation environment.
- **Storage**: Store metadata locally in a central user-level folder - requested data location and privacy boundary.
- **Privacy**: Disable content capture by default - OTel content capture can include prompts, responses, system messages, tool arguments, and command results.
- **Billing**: Treat estimates as advisory - official GitHub billing/usage reports can lag and may require org or enterprise permissions.
- **Aggregation**: Sum only lower-level LLM chat/model-call spans for billing-like totals - root agent spans are session metadata and may double-count tokens.
- **Portability**: Keep setup inspectable and local-first - prefer JSONL ingestion before introducing an OTLP collector.
- **Interface**: CLI first - dashboard work is deferred until the command/query model proves useful.
- **Output**: Every report should support human-readable output and machine-readable output for later dashboard or automation use.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use Node.js and npm scripts | User requested this stack for implementation and automation. | - Pending |
| Use a central user-level data directory | Keeps metadata local, independent of individual repos, and suitable for cross-project Copilot usage. | - Pending |
| Start with file-based OTel ingestion | JSONL exports are simple, local, auditable, and lower-friction than a collector. | - Pending |
| Add CLI hooks for attribution | OTel provides tokens and models; hooks add task, cwd, transcript, and session context. | - Pending |
| Prioritize Jira labels | User's primary grouping is ticket IDs such as `HDASPF-12345`, extracted from prompt, directory, branch, and tool-call context. | - Pending |
| Build CLI reports before dashboards | The user wants scripts/hooks/query tools first; dashboard is not a current priority. | - Pending |
| Avoid full content capture by default | Work prompts, code, tool args, and outputs can be sensitive. | - Pending |
| Treat official GitHub metrics as reconciliation only | Non-admins may not have access, and official reports are not designed for local task-level attribution. | - Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-30 after initialization*
