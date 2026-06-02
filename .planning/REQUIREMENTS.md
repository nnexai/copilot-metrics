# Requirements: v0.2.0 VS Code displayed credits

**Created:** 2026-06-02
**Milestone:** v0.2.0 VS Code displayed credits

## Overview

This milestone adds a new evidence tier for VS Code and VS Code Insiders chat sessions. Some local `chatSessions/*.jsonl` records expose a human display line in `result.details`, such as `GPT-5 mini - 0.8 credits` or `GPT-5 mini - 0x`. When no stronger actual charge evidence is available, that displayed credit value is more trustworthy than reconstructing cost from incomplete token buckets, especially when cache-read tokens are missing. If displayed credits, token counts, and model pricing are all available, the tool can also infer effective cache-read tokens from the delta between full-input pricing and displayed cost, but those inferred tokens must stay separate from observed cache-read fields. Reports must preserve displayed credits and inferred cache reads as local evidence, not official billing.

## Active Requirements

### Display Credit Import

- [ ] **DISP-01**: User can import VS Code and VS Code Insiders chat-session `result.details` display strings that contain numeric credits, including singular and plural forms such as `0.8 credit` and `0.8 credits`.
- [ ] **DISP-02**: User can import `0x` / zero-display details as plan-included or zero-display evidence without treating the record as an unknown-price failure.
- [ ] **DISP-03**: User can preserve displayed credits, displayed-credit text, source type, source file, session ID, request ID, response ID, model, and import timestamp as distinct store/report fields.

### Pricing Precedence

- [ ] **DISP-04**: User gets actual local charge evidence first when fields such as `totalNanoAiu`, observed request cost, or future explicit AI Credit debit fields are present.
- [ ] **DISP-05**: User gets displayed VS Code credits as the selected pricing basis when no stronger actual charge evidence exists, before complete token estimates or upper-bound token estimates are used.
- [ ] **DISP-06**: User still gets high-confidence token estimates when complete token buckets and price data exist but no actual or displayed-credit evidence exists.
- [ ] **DISP-07**: User still gets upper-bound token estimates when prompt/output tokens exist but cache-read token counts are unknown and no actual or displayed-credit evidence exists.
- [ ] **DISP-08**: User can see a diagnostic when displayed credits conflict materially with a token estimate, while keeping displayed credits as observed evidence rather than silently overwriting either value.
- [ ] **DISP-09**: User can see inferred effective cache-read tokens when displayed credits, token buckets, and model input/output/cache prices allow a bounded back-solve; inferred values stay separate from observed `cache_read_tokens`.

### Reports and Verification

- [ ] **DISP-10**: User can inspect label, model, repo, and detail report JSON with displayed-credit fields, inferred-cache fields, selected pricing basis, estimate confidence, and source/session evidence.
- [ ] **DISP-11**: User can read human reports that compactly distinguish actual, displayed-credit, estimated, upper-bound, included/zero, and unknown pricing bases, and mark inferred credit/cache values with an asterisk or equivalent marker.
- [ ] **DISP-12**: User can refresh reports and re-import existing VS Code session files so newly supported displayed-credit evidence upgrades prior upper-bound rows without double-counting usage.
- [ ] **DISP-13**: User can verify the behavior with fixture tests for numeric credits, `0x`, absent details, conflicting estimate/display values, inferred cache-read math, duplicate-source merges, and privacy-preserving parsing.

## Future Requirements

- Chronicle/session-store metadata discovery as an optional attribution source.
- Official GitHub billing/usage API reconciliation when accessible.
- Historical price-table sync or refresh automation.

## Out of Scope

- Making displayed VS Code credits official billing authority; GitHub billing remains the source of truth.
- Reading Chronicle `turns.user_message`, `turns.assistant_response`, or FTS content by default.
- Treating VS Code cache metadata (`cacheKey`, `cacheType`) as cache-read token counts when no numeric cache-read count is present.
- Storing full prompts or assistant responses by default.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DISP-01 | Phase 9 | Pending |
| DISP-02 | Phase 9 | Pending |
| DISP-03 | Phase 9 | Pending |
| DISP-04 | Phase 9 | Pending |
| DISP-05 | Phase 9 | Pending |
| DISP-06 | Phase 9 | Pending |
| DISP-07 | Phase 9 | Pending |
| DISP-08 | Phase 9 | Pending |
| DISP-09 | Phase 9 | Pending |
| DISP-10 | Phase 9 | Pending |
| DISP-11 | Phase 9 | Pending |
| DISP-12 | Phase 9 | Pending |
| DISP-13 | Phase 9 | Pending |
