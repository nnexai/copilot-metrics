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

## v0.1.9 Better pricing estimates (Shipped: 2026-06-02)

**Phases completed:** 1 phase, 1 plan

**Key accomplishments:**

- Observed local charge evidence import for Copilot CLI `totalNanoAiu`, per-model request cost, and premium request counters.
- Session-local pricing metadata import from VS Code/Insiders and Copilot logs.
- Pricing basis model that distinguishes actual, estimated, upper-bound, included/zero, unknown-price, and conflict cases.
- Explicit cache-read status so missing cache-read token counts become upper-bound estimates instead of false exact values.
- VS Code debug-log cached-token extraction from `GitHub.copilot-chat/debug-logs/<session-id>/main.jsonl` when `llm_request.attrs.cachedTokens` exists.
- `--refresh` report behavior to force re-reading configured source files.
- Human and JSON report fields for actual charge, token estimates, upper bounds, confidence, cache status, and pricing diagnostics.
- GitHub release and npm publication as `copilot-metrics@0.1.9`.

---
