# Requirements: v0.2.1 selected session pricing

**Created:** 2026-06-02
**Milestone:** v0.2.1 selected session pricing

## Overview

This milestone fixes the practical reporting gap found after the v0.2.0 release. A Copilot session/request can have multiple local evidence sources: VS Code OTel rows, VS Code chat-session fallback rows, displayed credit strings, token-price estimates, upper-bound estimates, and `0x` included evidence. The user-facing total must count exactly one selected price per session/request: the price with the highest confidence according to the pricing precedence. Other prices remain useful, but only as comparable diagnostics. The release also repairs duplicate VS Code rows created by old identity formats and by response ID aliases such as top-level `response_*` IDs versus metadata response IDs.

## Active Requirements

### Selected Pricing

- [ ] **SEL-01**: User gets one selected price per Copilot session/request, chosen by confidence order: actual charge evidence, displayed credit evidence, complete token estimate, upper-bound estimate, included/zero evidence, then unknown.
- [ ] **SEL-02**: User can inspect non-selected pricing evidence as diagnostics without those values contributing to label, model, repo, or session totals.
- [ ] **SEL-03**: User can see selected price fields in JSON reports, including selected AI Credits, selected USD, selected pricing basis, selected confidence, and the evidence source that won.
- [ ] **SEL-04**: User-facing human reports aggregate and display selected prices by default, while preserving compact markers for displayed, actual, estimate, upper-bound, included/zero, and conflict cases.

### VS Code Session Deduplication

- [ ] **SEL-05**: User can merge VS Code OTel, VS Code chat-session fallback, and displayed-credit evidence into one usage record when they refer to the same session/request.
- [ ] **SEL-06**: User can preserve response ID aliases such as top-level `response_*`, `result.metadata.responseId`, `modelMessageId`, request ID, session ID, model, and timestamp proximity as evidence for canonical matching.
- [ ] **SEL-07**: User does not get duplicate usage totals when old stored identities differ only by token bucket inclusion or by fallback versus OTel source identity.
- [ ] **SEL-08**: User can repair an existing local store so already-ingested duplicate VS Code rows collapse to one selected-price record without deleting source evidence needed for audit.

### Refresh and Verification

- [ ] **SEL-09**: User can refresh changed VS Code session evidence without a long silent full scan; refresh should be targeted by source file change state or expose progress when broad scanning is unavoidable.
- [ ] **SEL-10**: User can verify the behavior with fixtures covering selected-price aggregation, displayed-over-estimate precedence in reports, `0x` included rows contributing zero selected price, OTel/chat alias merging, old identity repair, and repeated refresh idempotence.
- [ ] **SEL-11**: User can run release verification for `copilot-metrics@0.2.1` through npm scripts and isolated `npx` validation after publish.

## Future Requirements

- Official GitHub billing/usage API reconciliation when accessible.
- Historical price-table sync or refresh automation.
- Richer dashboard views after selected-price CLI semantics are stable.

## Out of Scope

- Making displayed VS Code credits official billing authority; GitHub billing remains the source of truth.
- Reading Chronicle `turns.user_message`, `turns.assistant_response`, or FTS content by default.
- Treating VS Code cache metadata (`cacheKey`, `cacheType`) as cache-read token counts when no numeric cache-read count is present.
- Storing full prompts or assistant responses by default.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEL-01 | Phase 10 | Planned |
| SEL-02 | Phase 10 | Planned |
| SEL-03 | Phase 10 | Planned |
| SEL-04 | Phase 10 | Planned |
| SEL-05 | Phase 10 | Planned |
| SEL-06 | Phase 10 | Planned |
| SEL-07 | Phase 10 | Planned |
| SEL-08 | Phase 10 | Planned |
| SEL-09 | Phase 10 | Planned |
| SEL-10 | Phase 10 | Planned |
| SEL-11 | Phase 10 | Planned |
