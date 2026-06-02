# Copilot Metrics

## What This Is

Copilot Metrics is a local Node.js/npm-based toolkit for estimating GitHub Copilot usage costs from local OpenTelemetry and session metadata. Its focus is easy-to-install CLI tools, scripts, and hooks that attribute VS Code Insiders Copilot Chat/agent and Copilot CLI usage to Jira-style labels such as `DEMO-12345`, then expose human-readable and machine-readable reports without depending on admin-only GitHub billing access.

## Core Value

Give the user a trustworthy local CLI explanation of which Jira labels, repos, models, and Copilot surfaces are driving estimated AI Credit usage.

## Current State

`copilot-metrics@0.3.0` has shipped and the milestone is archived. The CLI supports local Copilot usage import, attribution, selected pricing evidence, and configurable regex patterns for the built-in label extractor.

## Next Milestone Goals

No active milestone is defined. Run `$gsd-new-milestone` to choose the next requirements and roadmap.

## Requirements

### Validated

- Validated: Collect VS Code Insiders Copilot OpenTelemetry JSONL from user-configured file exports - v0.1.1
- Validated: Collect Copilot CLI OpenTelemetry JSONL from user-configured file exports - v0.1.1
- Validated: Capture Copilot CLI task attribution metadata through local hooks - v0.1.1
- Validated: Store all application metadata locally in a central user-level folder - v0.1.1
- Validated: Extract Jira-style labels such as `DEMO-12345` from prompts, directories, branches, tool calls, and hook metadata - v0.1.1
- Validated: Normalize LLM chat/model-call spans into a local queryable store without double-counting root agent spans - v0.1.1
- Validated: Estimate GitHub AI Credits from model-specific token categories and pricing tables - v0.1.1
- Validated: Provide CLI-first reports for label overview, summarized usage per label, detailed usage per label, model, repo/directory, and unattributed usage - v0.1.1
- Validated: Provide both human-readable and machine-readable output for queries and reports - v0.1.1
- Validated: Keep sensitive content capture disabled by default and avoid storing full prompts unless explicitly enabled - v0.1.1
- Validated: Discover VS Code stable, VS Code Insiders, and Copilot CLI session-log fallback locations by default after setup - v0.1.8
- Validated: Configure additive fallback session directories or files while retaining built-in default discovery paths - v0.1.8
- Validated: Surface fallback diagnostics for missing paths, unsupported formats, content-only sessions, tokenless sessions, and import errors - v0.1.8
- Validated: Auto-import token-bearing fallback session logs before reports when hooks and OpenTelemetry are missing - v0.1.8
- Validated: Use checkpoints and cross-source usage identities so repeated reports do not reprocess old session-log rows or double-count the same exchange - v0.1.8
- Validated: Import supported VS Code `.jsonl` and `.json` chat session fallback files - v0.1.8
- Validated: Import Copilot CLI `session-state/*/events.jsonl` fallback logs from `~/.copilot` or `COPILOT_HOME` - v0.1.8
- Validated: Run fallback-derived labels through the same configured extractor callback path as OTel and hooks - v0.1.8
- Validated: Preserve fallback label evidence with source type, source field, source value, confidence, session ID, and usage record linkage - v0.1.8
- Validated: Keep full prompt capture disabled by default for fallback parsing - v0.1.8
- Validated: Show human-readable and JSON fallback diagnostics that local estimates are advisory and may be incomplete - v0.1.8
- Validated: Import observed local charge evidence such as `totalNanoAiu`, per-model request cost, and premium request counters - v0.1.9
- Validated: Import session-local model pricing metadata from VS Code/Insiders and Copilot logs - v0.1.9
- Validated: Preserve actual charge fields, pricing metadata, and derived estimates as distinct report/store concepts - v0.1.9
- Validated: Track cache-read availability as known, explicitly zero, or unknown - v0.1.9
- Validated: Report complete-token estimates as high confidence and cache-unknown prompt-token estimates as upper bounds - v0.1.9
- Validated: Surface pricing basis, estimate confidence, and source/session evidence in human and JSON reports - v0.1.9
- Validated: Treat VS Code cache keys/cache types and context-utilization logs as diagnostics, not numeric billing inputs - v0.1.9
- Validated: Redact auth-like values from VS Code extension, AHP, agenthost, and hook log diagnostics - v0.1.9
- Validated: Configure the internal label extractor with user-provided regex patterns while preserving built-in metadata evidence behavior - v0.3.0

### Active

No active requirements. `v0.3.0` is released and archived.

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

The most important attribution convention is Jira ticket IDs such as `DEMO-12345`. Labels should be extracted from explicit prompt text, the current directory, branch names, hook payloads, transcript references, and tool-call metadata where available. Branch names and cwd/repo provide fallback attribution when prompt labels are missing.

## Constraints

- **Runtime**: Use Node.js with npm scripts - requested implementation environment.
- **Storage**: Store metadata locally in a central user-level folder - requested data location and privacy boundary.
- **Privacy**: Disable content capture by default - OTel content capture can include prompts, responses, system messages, tool arguments, and command results.
- **Billing**: Treat estimates as advisory - official GitHub billing/usage reports can lag and may require org or enterprise permissions.
- **Aggregation**: Sum only lower-level LLM chat/model-call spans for billing-like totals - root agent spans are session metadata and may double-count tokens.
- **Portability**: Keep setup inspectable and local-first - prefer JSONL ingestion before introducing an OTLP collector.
- **Interface**: CLI first - dashboard work is deferred until the command/query model proves useful.
- **Output**: Every report should support human-readable output and machine-readable output for later dashboard or automation use.
- **Testing**: Copilot CLI integration tests may call the real CLI or set up isolated test environments, but must use cheap models because they verify output shape and telemetry behavior, not model quality.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use Node.js and npm scripts | User requested this stack for implementation and automation. | Validated in v0.1.1 |
| Use a central user-level data directory | Keeps metadata local, independent of individual repos, and suitable for cross-project Copilot usage. | Validated in v0.1.1 |
| Start with file-based OTel ingestion | JSONL exports are simple, local, auditable, and lower-friction than a collector. | Validated in v0.1.1 |
| Add CLI hooks for attribution | OTel provides tokens and models; hooks add task, cwd, transcript, and session context. | Validated in v0.1.1 |
| Treat session logs as the default fallback | Hooks and OTel can fail or be unavailable; local session logs are the next best source and already exist for VS Code and Copilot CLI. | Validated in v0.1.8 |
| Prioritize Jira labels | User's primary grouping is ticket IDs such as `DEMO-12345`, extracted from prompt, directory, branch, and tool-call context. | Validated in v0.1.1 |
| Build CLI reports before dashboards | The user wants scripts/hooks/query tools first; dashboard is not a current priority. | Validated in v0.1.1 |
| Use cheap models for Copilot CLI verification | Integration tests can call Copilot CLI, but the goal is validating output/telemetry, not paying for high-quality answers. | Validated in v0.1.1 |
| Avoid full content capture by default | Work prompts, code, tool args, and outputs can be sensitive. | Validated in v0.1.1 |
| Treat official GitHub metrics as reconciliation only | Non-admins may not have access, and official reports are not designed for local task-level attribution. | Validated in v0.1.1 |
| Keep JavaScript label extractors as replacement-only | Advanced users need full control when callbacks are configured, while regex patterns provide the lighter-weight internal-extractor customization path. | Validated in v0.3.0 |

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
*Last updated: 2026-06-02 after v0.3.0 configurable label patterns*
