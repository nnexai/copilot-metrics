---
phase: 10
status: ready
created: 2026-06-02
---

# Phase 10 Validation Strategy

## Validation Architecture

Phase 10 must be verified with fixture-backed behavior checks across pricing, storage, repair, refresh, and reports.

## Must Prove

- Selected price precedence is actual > displayed credit > complete estimate > upper bound > included/zero > unknown.
- Report primary totals sum selected prices only.
- Non-selected evidence stays available in JSON diagnostics.
- VS Code OTel/chat/display aliases collapse to one usage record.
- Existing duplicate rows can be repaired without losing label evidence.
- Repeated refreshes are idempotent for unchanged VS Code session files.

## Test Matrix

| Area | Required Proof |
|------|----------------|
| Pricing | `classifyPricing()` or selected helper returns selected fields for actual, displayed, estimated, upper-bound, included/zero, and unknown cases. |
| Reports | Label overview, label summary, model, repo, detail, and unattributed JSON expose selected fields and use them for primary totals. |
| Human output | Human tables show selected credit/USD columns and keep compact basis markers. |
| Dedupe | OTel row plus chat-session row with alias differences results in one `usage_records` row and one linked label-evidence set. |
| Repair | Manually seeded old duplicate identities collapse to one row after repair; second repair returns zero changes. |
| Refresh | `report --refresh` against unchanged session files does not increase usage count or selected totals. |

## Verification Commands

```bash
npm test
npm run check
npm run smoke
npm run verify:package
npm run check:readme-version
```

