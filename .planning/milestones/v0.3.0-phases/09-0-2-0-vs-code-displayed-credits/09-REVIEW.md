---
status: clean
phase: 9
reviewed: 2026-06-02
---

# Phase 9 Code Review

## Findings

No blocking findings.

## Review Notes

- Displayed-credit parsing is scoped to VS Code `details` fields, so model metadata such as `multiplierNumeric: 0` remains diagnostic-only unless an explicit displayed `0x` line exists.
- The pricing classifier preserves comparable token estimates while selecting `displayed_credit`, allowing conflict diagnostics and inferred-cache diagnostics to remain visible.
- SQLite migrations are additive, and duplicate usage merge preserves actual charge evidence above displayed evidence while letting displayed evidence upgrade older upper-bound rows.
- Raw VS Code chat content remains redacted in persisted raw records; prompt-like fields are still used transiently for label extraction only.

## Residual Risk

- Displayed VS Code credits are local display evidence and may still differ from official GitHub billing due to server-side accounting, routing, rounding, or plan inclusion behavior.
