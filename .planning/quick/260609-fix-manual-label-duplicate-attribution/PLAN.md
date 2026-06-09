---
status: complete
created: "2026-06-09T20:52:57Z"
completed: "2026-06-09T20:52:57Z"
---

# Fix manual label duplicate attribution

Fix duplicate model attribution in `report label TEST --detail` when one manually labeled session has historical Copilot session usage rows stored under multiple identity formats.

## Plan

- Reproduce the duplicate report for label `TEST`.
- Identify the stable high-confidence dedupe key.
- Deduplicate report aggregation and detail rows by semantic usage identity.
- Extend refresh repair to collapse Copilot session duplicates in the store.
- Add regression coverage for manual-label reports and refresh repair.
- Verify with focused tests, full tests, and the real `TEST` report.
