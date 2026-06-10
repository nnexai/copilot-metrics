# Phase 19 Research

## Local Code Findings

- `src/reports.js` computes label confidence rankings through `labelConfidenceRankings(dbPath)`.
- `labelSummary`, `labelModelBreakdown`, `labelDetails`, and `labelSessionDetails` each trigger their own evidence/ranking path.
- `src/cli.js` calls those report functions sequentially for `report label`, so shared command-level context can remove repeated work without changing command output.
- `labelDetails` has a richer SQL projection than aggregate report rows, so it should keep the detail query and reuse only shared manual/ranking inputs.

## Release Findings

- `RELEASE.md` is the release checklist source of truth.
- `npm version <version> --no-git-tag-version` runs the README version sync hook.
- Published-package validation must be performed outside the checkout using `npx`.

