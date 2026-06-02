---
status: passed
phase: 8
verified: 2026-06-02
---

# Phase 8 Verification

## Result

Verification passed.

## Success Criteria

- Copilot CLI session shutdown records with cache-read tokens and `totalNanoAiu` produce actual local charge fields plus a comparable estimate: verified by `Copilot session-state trusts nonzero totalNanoAiu as observed local charge`.
- VS Code/Insiders records with model price metadata but no numeric cache-read counts produce upper-bound estimates and visible cache-unknown diagnostics: verified by `VS Code fallback without numeric cache reads uses upper-bound session-local pricing`.
- Records with complete token buckets produce high-confidence estimates using either session-local pricing or the static table: verified by existing pricing tests and `VS Code debug log cachedTokens upgrades fallback cache-read evidence`.
- Reports aggregate mixed pricing evidence without collapsing upper bounds into exact costs: verified by report JSON tests and human report basis output.
- Re-importing the same exchange from multiple sources keeps one usage row and preserves the strongest pricing evidence: verified by cross-source dedupe and `report --refresh re-reads configured sources and merges new debug pricing evidence`.
- VS Code cache keys/cache types and context-utilization lines are surfaced as diagnostics only, not priced token buckets: verified by upper-bound diagnostics tests and implementation review.

## Commands

```bash
npm test
npm run check
npm run smoke
npm run verify:package
npm run check:readme-version
```

All commands passed for `copilot-metrics@0.1.9`.

## Local Debug-Log Validation

Local machine inspection found VS Code Insiders debug-log paths under:

```text
~/.config/Code - Insiders/User/workspaceStorage/<workspace>/GitHub.copilot-chat/debug-logs/<session-id>/main.jsonl
```

The sampled current files contained `session_start` rows but no positive `llm_request.attrs.cachedTokens` rows, so the path/layout is locally validated and positive cache-token extraction is fixture validated.
