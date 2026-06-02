---
status: clean
phase: 8
reviewed: 2026-06-02
---

# Phase 8 Code Review

## Findings

No blocking findings.

## Review Notes

- Pricing evidence is additive in the SQLite schema, so existing stores migrate without destructive rebuilds.
- Duplicate usage merge now preserves stronger pricing evidence and lets cache-known refreshes replace older upper-bound classifications.
- `--refresh` re-reads configured files but still relies on raw fingerprints and usage identities to avoid duplicate usage rows.
- VS Code debug-log cache extraction reads only numeric `attrs.cachedTokens` evidence from `llm_request` rows and records diagnostics rather than persisting prompt/assistant content.

## Residual Risk

- `totalNanoAiu` is treated as trusted observed local charge evidence as requested, but it remains labeled as local evidence rather than official GitHub billing authority.
- Local validation found VS Code Insiders debug-log directories on this machine, but the sampled current files only contained `session_start` rows and no positive `llm_request.attrs.cachedTokens` rows; positive extraction is covered by fixtures.
