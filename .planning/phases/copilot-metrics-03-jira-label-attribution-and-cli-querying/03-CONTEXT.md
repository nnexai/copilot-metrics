# Phase 3: Jira Label Attribution and CLI Querying - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Attribute usage to Jira-style labels, repos, branches, directories, tool-call context, sessions, and surfaces, then expose useful local CLI reports for labels, models, repos/directories, detailed label usage, and unattributed usage. Attribution must preserve evidence for statistical analysis rather than collapsing immediately to one primary label.

</domain>

<decisions>
## Implementation Decisions

### Attribution Model
- Use canonical uppercase Jira-style labels such as `HDASPF-12345`, deduping case-insensitively while storing the canonical uppercase form.
- Preserve label attribution as evidence by source and session, so later analysis can decide whether a label is the main task or a sidetrack.
- Store label matches and source field names by default, avoiding full prompt text or full content capture.
- Support multi-label records by preserving all label evidence and marking shared/multi-label usage in detail output instead of forcing a single exclusive label.

### Query Surface
- Add a `copilot-metrics report ...` command family for user-facing reports, while keeping `import`, `pricing`, and `store` as operational commands.
- Implement first reports for `labels`, `label <id>`, `label <id> --detail`, `models`, `repos`, and `unattributed`.
- Continue using the existing `--json` flag for machine-readable output with stable totals, estimate labels, source evidence, and warnings.
- Keep human-readable output compact and table-oriented, with short estimate caveats suitable for terminal scanning.

### Data Model and Evidence
- Add a separate label evidence model keyed to usage and hook records, preserving `label`, source type, source field/value context, session ID, confidence, and timestamps where available.
- Join hook events to usage primarily by `session_id`, then enrich by cwd, repo, branch, and time proximity when available.
- Use a simple numeric confidence model by evidence source while preserving all evidence for later analysis of primary vs sidetrack labels.
- Retain safe source context: source type, source field name, matched label, session/repo/cwd/branch, and optional redacted source value when it is already metadata. Do not store full prompts by default.

### Extensible Label Extraction
- Make label extraction easy to extend through a custom extractor model.
- A custom extractor should be called with the type of source and the source data, and return zero or more extracted labels.
- The agent may choose the exact API shape and configuration mechanism, but it should be simple enough for a user to plug in custom logic without changing report code.
- Built-in Jira extraction should be the default extractor and should remain conservative.

### Verification and Smoke Scope
- Prioritize fixture tests for Jira extraction, evidence precedence, session joins, report JSON shapes, and human table output smoke.
- Use `HDASPF-12345` plus at least one second label in fixtures to prove multi-label and statistical attribution behavior.
- Verify unattributed usage appears in `report unattributed` with enough session/source context to improve labeling, but without storing prompt content.
- Include a smoke path that imports fixtures into a temp store, runs reports with `--json` and human output, and confirms costs are marked as estimates.

### the agent's Discretion
The agent may choose table names, SQL schema details, confidence weights, exact report formatting, and custom extractor configuration shape. Keep the implementation local-first, privacy-preserving by default, and consistent with the existing CommonJS CLI and npm verification scripts.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/PROJECT.md` — local-first goal, privacy constraints, billing caveats, and Jira label priority.
- `.planning/REQUIREMENTS.md` — Phase 3 attribution and reporting requirements.
- `.planning/ROADMAP.md` — Phase 3 success criteria and verification focus.
- `.planning/STATE.md` — current workflow state.

### Prior Phase Artifacts
- `.planning/phases/01-project-foundation-and-local-setup/01-CONTEXT.md` — CLI, setup, hook, and privacy decisions.
- `.planning/phases/01-project-foundation-and-local-setup/01-01-SUMMARY.md` — implemented CLI and path helpers.
- `.planning/phases/02-otel-ingestion-normalization-and-cost-model/02-CONTEXT.md` — SQLite store and ingestion decisions.
- `.planning/phases/02-otel-ingestion-normalization-and-cost-model/02-01-SUMMARY.md` — implemented ingestion, normalization, and cost model.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/cli.js`: CommonJS command dispatcher with existing `--json` output handling and operational commands.
- `src/sqlite-store.js`: SQL.js-backed local SQLite store with `raw_records`, `usage_records`, `hook_events`, and `import_warnings`.
- `src/otel.js`: span normalization and hook event normalization, including session, repo, branch, cwd, model, token, and cost context.
- `src/ingest.js`: import orchestration and cost enrichment.
- `src/hook-logger.js`: local hook metadata capture with prompt preview disabled by default.
- `test/ingest.test.js`: Node test fixture pattern for temporary stores and SQL assertions.

### Established Patterns
- CommonJS modules, no build step.
- npm scripts `test` and `check` are the verification surface.
- CLI commands use compact human output by default and `--json` for machine-readable output.
- Privacy defaults avoid full prompt storage and content capture unless explicitly enabled.

### Integration Points
- Label extraction should run during import and report over existing local SQLite data.
- Hook metadata should enrich usage attribution by session and source context.
- Report commands should query the local store created by Phase 2.
- Custom label extractor support should integrate with attribution without requiring changes to report implementations.

</code_context>

<specifics>
## Specific Ideas

- Attribution should be statistical and evidence-preserving, including source and session, so downstream analysis can classify labels as primary work or sidetrack work.
- Users should be able to provide a custom label extractor called with source type and source data, returning zero or more labels.
- Jira IDs such as `HDASPF-12345` remain the default primary label format.

</specifics>

<deferred>
## Deferred Ideas

- Advanced primary-label classification, duration weighting, and sidetrack analysis can build on the evidence model later.
- Non-Jira arbitrary labels can be enabled through custom extractors, but built-in Phase 3 behavior should stay focused on Jira-style labels.
- Real Copilot CLI integration verification remains Phase 4.

</deferred>

---

*Phase: 3-Jira Label Attribution and CLI Querying*
*Context gathered: 2026-05-30*
