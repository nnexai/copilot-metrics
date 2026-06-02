---
plan_id: 09-01
phase: 9
status: complete
completed: 2026-06-02
---

# Plan 09-01 Summary: Displayed-credit evidence, pricing precedence, and reports

## Delivered

- Added VS Code chat-session displayed-credit parsing for `result.details` shapes such as `0.8 credits`, `0.8 credit`, and `0x`.
- Added pricing classification for `displayed_credit` evidence between actual charge evidence and token-price estimates.
- Preserved displayed credits, displayed USD, display text, display basis, inferred cache-read tokens, and inferred-cache reason in SQLite usage rows.
- Added bounded inferred cache-read diagnostics when displayed credits are lower than uncached token estimates and cache-read pricing is known, without overwriting observed `cache_read_tokens`.
- Extended duplicate usage merge and `--refresh` behavior so displayed-credit evidence upgrades prior upper-bound rows without duplicating usage records.
- Extended label, model, repo, detail, and unattributed JSON reports with displayed-credit and inferred-cache fields.
- Updated compact human reports with a `display*` pricing basis marker.
- Updated README, CHANGELOG, package metadata, and package-lock for `0.2.0`.

## Tests Added

- VS Code displayed credits select displayed-credit basis before upper-bound token estimates.
- VS Code `0x` details import as included/zero displayed evidence.
- Actual charge evidence remains stronger than displayed credits.
- Report `--refresh` merges displayed-credit evidence without duplicate usage.
- Human reports mark displayed-credit basis compactly.

## Verification

All verification passed:

```bash
npm test
npm run check
npm run smoke
npm run verify:package
npm run check:readme-version
```

## Notes

- Displayed credits remain local observed display evidence, not official billing authority.
- `multiplierNumeric: 0` and similar model metadata stay diagnostics unless an explicit displayed `0x` detail line is present.
