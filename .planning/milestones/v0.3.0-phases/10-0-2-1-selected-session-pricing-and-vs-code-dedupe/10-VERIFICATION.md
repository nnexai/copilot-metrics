---
phase: 10
status: passed
must_haves_checked: 7
must_haves_passed: 7
verified: 2026-06-02
---

# Phase 10 Verification

## Must-Haves

1. Displayed-credit sessions contribute the displayed selected price once, with estimates retained as diagnostics only: passed by ingest/report tests.
2. `0x` displayed sessions contribute zero selected credits while retaining token diagnostics: passed by ingest tests.
3. Actual charge evidence outranks displayed and estimated evidence: passed by ingest tests.
4. VS Code OTel and chat-session fallback aliases merge into one priced usage record: passed by ingest repair tests.
5. Existing duplicate VS Code rows can be repaired idempotently: passed by ingest repair tests.
6. Report refresh does not inflate unchanged VS Code totals: passed by refresh/report tests.
7. Package release verification is runnable for `0.2.1`: passed by local package checks.

## Commands

| Command | Result |
|---------|--------|
| `npm test` | passed, 60 tests |
| `npm run check` | passed |
| `npm run smoke` | passed |
| `npm run verify:package` | passed, `copilot-metrics@0.2.1`, 21 files |
| `npm run check:readme-version` | passed |
| `npm pack --silent --dry-run --json` | passed, clean package manifest |

## Remaining Gate

Isolated published-package validation is intentionally deferred until `copilot-metrics@0.2.1` is published. After publish, run from outside the checkout:

```sh
npx -y copilot-metrics@0.2.1 --help
npx -y copilot-metrics@0.2.1 report labels --json
```
