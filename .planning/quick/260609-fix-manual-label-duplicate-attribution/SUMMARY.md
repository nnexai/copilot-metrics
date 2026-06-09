---
status: complete
completed: "2026-06-09T20:52:57Z"
---

# Summary

Fixed duplicate manual-label attribution caused by historical Copilot session usage identity drift.

The high-confidence dedupe key is `span_id + normalized model`; older stores could contain both `span:<id>|model:<model>|tokens:<...>` and `span:<id>|model:<model>` rows for the same call. Reports now collapse those rows at read time, and `--refresh` repairs Copilot session duplicates in the SQLite store.

Verification:

- `npm run check`
- `node --test test/report.test.js`
- `npm test`
- `node bin/copilot-metrics.js report label TEST --detail --refresh`

The live `TEST` report now shows one `gpt-5.4` row and one `claude-haiku-4.5` row. The backing store for session `7bd28dad-9434-4411-ac15-0af2343ea22e` now contains exactly two usage records, one per model.
