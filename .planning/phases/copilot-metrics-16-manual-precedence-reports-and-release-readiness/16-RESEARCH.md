# Phase 16: Manual precedence reports and release readiness - Research

## RESEARCH COMPLETE

## Scope Summary

Phase 16 is a focused continuation of Phase 15. The existing code already has active manual assignment storage and CLI mutation commands in `src/sqlite-store.js` and `src/cli.js`. The remaining implementation work is to combine active manual assignments with automatic `label_evidence` at query/report time, without rewriting the stored automatic evidence rows.

## Relevant Existing Architecture

- `src/label-confidence.js` owns `label-confidence:v1`, session grouping, source weights, ranking sort order, source summaries, and rank metadata.
- `src/reports.js` owns label overview, specific-label aggregation, detail rows, session-detail rows, inclusion modes, and unattributed output.
- `src/sqlite-store.js` owns `manual_label_assignments` and helper functions for active manual state. It can be extended with read helpers for report/ranking integration.
- `src/cli.js` already routes report payloads and should mostly consume richer report objects rather than implementing ranking logic.
- `test/report.test.js` and `test/label-confidence.test.js` already cover report semantics and confidence ranking; Phase 16 should extend these fixture tests.

## Implementation Guidance

Use an output-time merge:

- Fetch automatic evidence rows as today.
- Fetch active manual assignments by session.
- Convert manual assignments into synthetic ranking/evidence inputs with `source_field: "manual"` and timestamps from `manual_label_assignments`.
- Sort manual labels before automatic labels while preserving `label-confidence:v1`.
- For labels that are both manual and automatic for the same session, emit one ranking entry marked manual and keep the automatic evidence inside its evidence list.
- Keep default inclusion based on final rank so top-label remains non-overlapping and `--top-k` / `--all-matches` behave consistently.

Do not persist computed ranks. Do not copy manual labels into `label_evidence`. Do not mutate `usage_records`.

## Validation Architecture

Automated validation should focus on report-visible behavior:

- `node --test test/label-confidence.test.js` for pure ranking precedence and source summary behavior.
- `node --test test/report.test.js` for report inclusion, synthetic detail rows, session-detail confidence metadata, unattributed filtering, and stale provenance after `set` / `clear`.
- `npm run check` for syntax.
- `npm test` for the full suite.
- `npm run check:readme-version`, `npm pack --silent --dry-run --json`, and `npm run verify:package` before publishing.
- After publish: watch the GitHub release workflow, verify npm version, and run `npx -y copilot-metrics@0.5.0 ...` from a neutral directory. Empty local telemetry is acceptable if diagnostics are valid.

## Risks

- Accidentally treating manual labels as stored automatic evidence would break auditability.
- Adding provenance to overview rows would violate the compact overview decision.
- Leaving unattributed report based only on automatic evidence would make manually corrected sessions appear unattributed.
- Introducing `label-confidence:v2` or `automatic_rank` would conflict with the locked compatibility decisions.
