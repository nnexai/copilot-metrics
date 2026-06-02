# Milestones

## v0.1.1 Local Copilot Usage Tracker (Shipped: 2026-05-30)

**Phases completed:** 7 phases, 6 plans, 0 tasks

**Key accomplishments:**

- Node.js/npm CLI for local Copilot telemetry setup, hooks, ingestion, and reports.
- Local SQLite-backed import and normalization for VS Code Copilot OTel, Copilot CLI OTel, and hook JSONL.
- Jira-style label attribution with evidence-preserving report output.
- Release-ready package metadata, CI/publishing workflow, smoke checks, and manual Copilot CLI validation helper.
- `0.1.1` setup-once report flow with idempotent auto-import, complete cache/reasoning token reporting, and hook-only label semantics.

---

## v0.1.8 Session log fallback ingestion (Shipped: 2026-06-02)

**Phases completed:** 1 phase, 1 plan

**Key accomplishments:**

- Default VS Code stable, VS Code Insiders, and Copilot CLI session-log fallback discovery.
- Idempotent fallback imports with checkpoints and cross-source usage identity dedupe.
- VS Code `.jsonl` / `.json` chat session parsing and Copilot CLI `session-state/*/events.jsonl` shutdown usage parsing.
- Fallback diagnostics for missing paths, unsupported formats, content-only sessions, tokenless sessions, import errors, and unreadable stores.
- Privacy-preserving fallback extraction that keeps prompt-like fields transient for label extraction.
- Compact TTY progress during report imports and faster repeat report imports from checkpointed sources.

---
