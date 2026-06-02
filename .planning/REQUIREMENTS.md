# Requirements: v0.1.9 Better pricing estimates

**Created:** 2026-06-02
**Milestone:** v0.1.9 Better pricing estimates

## Overview

This milestone turns pricing from a single implied estimate into an evidence-ranked reporting model. Local logs show different levels of billing evidence: Copilot CLI shutdown events can include cache-read tokens and `totalNanoAiu`, while VS Code Insiders chat sessions can include prompt/output tokens and local model price metadata but may omit cache-read token counts. Reports must use the strongest available signal and say when a value is actual, estimated, or only an upper bound.

## Active Requirements

### Price Evidence Import

- [x] **PRICE-01**: User can import known local charge or AI Credit fields from Copilot CLI session-state logs, including `totalNanoAiu`, per-model request cost, and total premium request counters when present.
- [x] **PRICE-02**: User can import session-local model pricing metadata from VS Code and VS Code Insiders logs, including `inputCost`, `outputCost`, `cacheCost`, model picker pricing text, and `billing.token_prices` records.
- [x] **PRICE-03**: User can preserve charge fields, pricing table fields, and derived estimates as distinct store/report concepts so actual observed values are not overwritten by estimates.

### Estimate Classification

- [x] **PRICE-04**: User can see whether each usage record has cache-read counts known, explicitly zero, or unknown.
- [x] **PRICE-05**: User can get a high-confidence estimate when input, output, cache-read, cache-write, model, and price data are all known.
- [x] **PRICE-06**: User can get an upper-bound estimate when prompt/output tokens are known but cache-read token counts are missing, with the uncached-input assumption recorded.
- [x] **PRICE-07**: User can see warnings for unknown pricing, stale/static pricing fallback, included/free `0x` sessions, and conflicting charge versus estimate evidence.
- [x] **PRICE-11**: User can see cache metadata and context-utilization diagnostics separately from billable token buckets, so cache keys, cache types, and compaction utilization are never mistaken for numeric cache-read usage.

### Reports

- [x] **PRICE-08**: User can inspect label, model, repo, and detail reports with pricing basis fields in JSON output, including actual charge, estimated charge, upper-bound charge, AI Credits, and estimate confidence.
- [x] **PRICE-09**: User can read human report output that clearly distinguishes actual, estimated, and upper-bound values without making the table noisy.
- [x] **PRICE-10**: User can trace pricing evidence back to source type, session ID, request/exchange ID, and model so duplicate session exchange imports still collapse to one billed/estimated usage record.
- [x] **PRICE-12**: User can import diagnostics from VS Code logs without persisting or printing auth tokens or full prompt/assistant content found in agenthost, AHP, hook, or extension logs.

## Future Requirements

- Official GitHub billing/usage API reconciliation when accessible.
- Per-account plan awareness beyond fields exposed in local logs.
- Historical price-table sync or refresh automation.

## Out of Scope

- Making local estimates official billing authority; GitHub billing remains the source of truth.
- Network proxying, TLS interception, or private API scraping.
- Treating VS Code cache metadata (`cacheKey`, `cacheType`) as cache-read token counts when no numeric cache-read count is present.
- Storing full prompts or assistant responses by default.

## Traceability

| Requirement | Phase |
|-------------|-------|
| PRICE-01 | Phase 8 |
| PRICE-02 | Phase 8 |
| PRICE-03 | Phase 8 |
| PRICE-04 | Phase 8 |
| PRICE-05 | Phase 8 |
| PRICE-06 | Phase 8 |
| PRICE-07 | Phase 8 |
| PRICE-08 | Phase 8 |
| PRICE-09 | Phase 8 |
| PRICE-10 | Phase 8 |
| PRICE-11 | Phase 8 |
| PRICE-12 | Phase 8 |
