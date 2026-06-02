---
status: passed
phase: 9
verified: 2026-06-02
---

# Phase 9 Verification

## Result

Verification passed.

## Success Criteria

- VS Code chat session rows with `result.details` containing `0.8 credits` import displayed credit evidence and select it when no actual charge exists: verified by `VS Code displayed credits select displayed-credit basis before upper-bound estimates`.
- `0x` details import included/zero display evidence without suppressing token and diagnostic fields: verified by `VS Code displayed 0x imports included display evidence`.
- Records with actual charge evidence still prefer actual over displayed credits: verified by `actual charge evidence remains stronger than displayed credits`.
- Displayed credits with missing cache-read counts win over upper-bound token estimates: verified by displayed-credit ingest and refresh tests.
- Displayed credits plus pricing/token buckets can show bounded inferred cache-read tokens without populating observed cache-read fields: verified by displayed-credit ingest assertions.
- Reports expose displayed-credit fields, inferred-cache fields, and compact basis markers in JSON and human output: verified by report refresh JSON assertions and `human reports mark displayed-credit basis compactly`.
- Re-running reports with `--refresh` upgrades existing matching usage rows idempotently: verified by `report --refresh merges displayed-credit evidence without duplicate usage`.

## Commands

```bash
npm test
npm run check
npm run smoke
npm run verify:package
npm run check:readme-version
```

All commands passed for `copilot-metrics@0.2.0`.
