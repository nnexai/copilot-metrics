# Phase 3: Jira Label Attribution and CLI Querying - Research

## Research Summary

Phase 3 builds on the existing CommonJS CLI, `sql.js` store, OTel normalization, hook ingestion, and fixture tests. No external service or framework research is needed; the main planning concern is preserving attribution evidence without storing sensitive prompt content.

## Relevant Existing Patterns

- `src/cli.js` owns command dispatch, `--json` parsing, and compact human output.
- `src/sqlite-store.js` owns schema migration and query helpers.
- `src/otel.js` already normalizes usage records and hook events with session, repo, branch, cwd, and token/cost fields.
- `src/ingest.js` is the correct integration point for import-time label extraction and evidence persistence.
- Tests use Node's built-in test runner, temporary `COPILOT_METRICS_HOME` directories, fixture JSONL files, and SQL assertions.

## Planning Implications

- Add label extraction as reusable logic, not report-specific string matching.
- Store all attribution evidence separately from usage totals so reports can aggregate statistically and downstream analysis can classify primary vs sidetrack labels.
- Keep built-in extraction conservative: Jira-style labels only by default.
- Allow custom extractors to participate through a simple source-type plus source-data contract returning zero or more labels.
- Reports should query local SQLite only and expose both human and JSON output.

## Validation Architecture

- Fixture tests must cover built-in Jira extraction from branch, cwd, hook labels, and metadata-like task/prompt fields without storing full prompt content.
- Tests must prove multi-label evidence is preserved and reports expose source/session context.
- Tests must prove unattributed usage remains visible with safe context.
- Smoke verification should import fixtures into a temp store, then run report commands in both human and JSON modes.
