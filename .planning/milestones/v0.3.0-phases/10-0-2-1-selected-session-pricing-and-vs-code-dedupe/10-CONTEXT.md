# Phase 10 Context: 0.2.1 selected session pricing and VS Code dedupe

## Background

`copilot-metrics@0.2.0` added VS Code displayed-credit parsing and row-level pricing precedence. Current-day VS Code session analysis showed that row-level precedence is not enough: reports still aggregate comparable estimates, and some VS Code OTel/chat fallback aliases are stored as separate usage rows.

The critical product rule for this phase is:

> Each Copilot session/request should have only one user-facing price: the price with the highest confidence. Other pricing signals are diagnostics.

## Observed Problems

- Report totals currently sum `estimated_ai_credits`, so displayed-credit rows can still contribute token estimates instead of the displayed selected value.
- `0x` displayed rows preserve nonzero token estimates, which is useful diagnostically, but those estimates must not contribute to selected user-facing totals.
- VS Code OTel rows and chat-session fallback rows can represent the same request through different aliases:
  - top-level `response_*` IDs
  - `result.metadata.responseId`
  - `modelMessageId`
  - request ID
  - session ID plus timestamp/model proximity
- Existing stores can contain duplicates from older identity formats where `usage_identity` included token buckets and newer identity formats where span IDs are used.
- `report --refresh` can take long enough to feel hung when it broad-scans VS Code session paths without progress.

## Desired Semantics

- Selected price precedence: actual charge evidence > displayed credit evidence > complete token estimate > upper-bound token estimate > included/zero > unknown.
- Reports aggregate selected price only.
- Comparable estimates, displayed values, upper bounds, inferred cache reads, conflicts, source files, and aliases remain inspectable.
- Store repair should merge duplicate usage rows idempotently and preserve the strongest pricing evidence.
- Refresh should focus on changed files or show progress when a full scan is unavoidable.

## Verification Seeds

- A request with displayed `0.8 credits` and token estimate `0.98285` should contribute `0.8` selected credits once.
- A request with displayed `0x` and token estimate around `0.8` should contribute `0` selected credits while retaining the token estimate as diagnostics.
- A request with actual charge evidence should still select actual evidence over displayed and estimated evidence.
- Repeated refreshes against unchanged VS Code session files should not increase totals.
