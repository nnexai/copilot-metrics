---
quick_id: 260601-b7v
slug: fix-0-1-7-cost-token-splitting-and-custo
status: complete
completed: "2026-06-01T06:15:00.000Z"
---

# Summary

Fixed the `0.1.7` cost estimator so cached read tokens are split out of input totals and cache creation/write tokens are split out of output totals before pricing. This corrects both USD estimates and derived AI Credit estimates. Reasoning/thinking tokens remain reported, but are not priced as a separate category because the current GitHub Copilot pricing table does not expose a separate reasoning rate.

Changed custom label extractor behavior so configured extractors replace the built-in Jira extractor for that run.

## Files Changed

- `src/pricing.js`
- `src/label-extractors.js`
- `test/ingest.test.js`
- `README.md`
- `CHANGELOG.md`
- `package.json`
- `package-lock.json`

## Verification

- `npm test`
- `npm run check`
- `npm run smoke`
- `npm run verify:package`
