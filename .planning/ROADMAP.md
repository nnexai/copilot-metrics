# Roadmap: Copilot Metrics

**Created:** 2026-05-30
**Granularity:** Coarse
**Mode:** Autonomous / YOLO

## Overview

Build a local-first Copilot usage tracker in incremental CLI-first slices. The initial milestone delivered setup, ingestion, attribution, reports, hardening, publishing, and setup-once behavior. The current v0.1.9 milestone improves pricing by separating actual local charge evidence, high-confidence estimates, and upper-bound fallback estimates.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions, if needed later

- [x] **Phase 1: Project Foundation and Local Setup** - Create Node.js/npm CLI/script/hook skeleton and local telemetry setup helpers.
- [x] **Phase 2: OTel Ingestion, Normalization, and Cost Model** - Parse local telemetry, normalize LLM calls, and estimate AI Credits.
- [x] **Phase 3: Jira Label Attribution and CLI Querying** - Attribute usage to Jira labels/repos and expose local query commands.
- [x] **Phase 4: Hardening and Release Readiness** - Add durable verification and first-release docs.
- [x] **Phase 4.1: VS Code and Copilot CLI Hook Support Research** - Research, model, and validate hook setup for both VS Code Copilot and Copilot CLI.
- [x] **Phase 5: GitHub and npm Publishing Preparation** - Add repository automation and package publishing readiness for GitHub and npm.
- [x] **Phase 6: 0.1.1 Zero-friction setup, automatic hook ingestion, and complete token reporting** - Add setup-once reports, idempotent auto-import, complete token categories, and hook-only label semantics.
- [x] **Phase 7: 0.1.8 Session log fallback ingestion** - Make local VS Code, VS Code Insiders, and Copilot CLI session logs the default fallback path when hooks and OTel are unavailable.
- [ ] **Phase 8: 0.1.9 Better pricing estimates** - Use the strongest available local pricing evidence and report actual, estimated, and upper-bound values distinctly.

## Phase Details

### Phase 1: Project Foundation and Local Setup

**Goal:** Create the Node.js/npm CLI/script/hook skeleton, central user data directory conventions, and setup helpers for VS Code and Copilot CLI telemetry.

**Covers:** FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, SETUP-01, SETUP-02, SETUP-03, SETUP-04, SETUP-05

**Expected deliverables:**
- `package.json` with npm scripts for build/test/lint or equivalent verification.
- CLI entrypoint or scripts for initialization and setup guidance.
- Central data directory resolver using a user-level folder by default.
- Generated or documented VS Code Insiders OTel settings.
- Generated or documented Copilot CLI OTel exports.
- Generated or documented Copilot CLI hook config and hook logger.
- Install/preview commands that keep setup simple and avoid manual file editing.

**Success Criteria** (what must be TRUE):
  1. User can run npm scripts for project verification once the scaffold exists.
  2. User can initialize or inspect the central user-level data directory.
  3. User can configure VS Code Insiders and Copilot CLI to emit local OTel files with content capture disabled.
  4. User can install or preview a Copilot CLI hook logger for local task attribution.

**Verification focus:**
- Setup commands are runnable locally.
- Generated paths point to the central user data folder.
- Content capture remains disabled by default.

### Phase 2: OTel Ingestion, Normalization, and Cost Model

**Goal:** Parse local JSONL telemetry, normalize LLM-call records, store them locally, and estimate AI Credits without double-counting.

**Covers:** INGEST-01, INGEST-02, INGEST-03, INGEST-04, INGEST-05, NORM-01, NORM-02, NORM-03, NORM-05, COST-01, COST-02, COST-03, COST-04, COST-05

**Expected deliverables:**
- JSONL ingestion pipeline for VS Code OTel, Copilot CLI OTel, and hook logs.
- Local queryable store, likely SQLite or DuckDB.
- Span classifier that separates LLM chat/model-call spans from root agent/tool spans.
- Token extractor for input, output, cache read, cache creation, and reasoning tokens.
- Versioned local pricing table and cost estimator.
- Warnings for unknown models, missing token fields, and malformed records.

**Success Criteria** (what must be TRUE):
  1. User can import sample VS Code, Copilot CLI, and hook JSONL records into a local store.
  2. LLM chat/model-call spans produce token totals while root agent spans do not double-count them.
  3. Known model records produce estimated USD and AI Credits.
  4. Unknown model or malformed records produce visible warnings instead of false precision.

**Verification focus:**
- Fixture-based tests for each input type.
- Double-counting prevention test.
- Unknown pricing test.

### Phase 3: Jira Label Attribution and CLI Querying

**Goal:** Attribute usage to Jira labels, repos, branches, directories, tool-call context, and surfaces, then expose useful local CLI queries.

**Covers:** NORM-04, NORM-06, REPORT-01, REPORT-02, REPORT-03, REPORT-04, REPORT-05, REPORT-06, REPORT-07, REPORT-08

**Expected deliverables:**
- Jira label extraction from prompts, directories, branch names, hook metadata, and tool-call context.
- CLI queries for label overview, label summary, label detail, per model, per repo/directory, and unattributed usage.
- Human-readable and machine-readable output modes for query commands.
- Clear labels that reported costs are estimates.

**Success Criteria** (what must be TRUE):
  1. User can list discovered Jira labels such as `DEMO-12345` with sessions, tokens, credits, first seen, and last seen.
  2. User can query summarized and detailed usage for a single label.
  3. User can inspect unattributed usage and see enough context to improve labels.
  4. Query commands run from local telemetry and the local store without remote services.
  5. Query commands support human-readable and machine-readable output.
  6. Cost output is clearly marked as an estimate.

**Verification focus:**
- Attribution precedence tests.
- Report snapshot or structured-output tests.
- Manual smoke with sample telemetry and hook fixtures.

### Phase 4: Hardening and Release Readiness

**Goal:** Make the tracker reliable enough for ongoing local use and prepare the first usable release.

**Covers:** VERIFY-01, VERIFY-02, VERIFY-03, VERIFY-04, VERIFY-05, VERIFY-06

**Expected deliverables:**
- Focused test suite across ingestion, normalization, cost, and reporting.
- Copilot CLI integration check that may invoke the real CLI or isolated test environments with cheap models.
- README with setup, privacy warnings, and expected limitations.
- Release checklist covering local setup, sample data import, and report verification.
- Known gaps documented for official reconciliation, collector mode, and richer privacy controls.

**Success Criteria** (what must be TRUE):
  1. Verification scripts pass from a clean checkout.
  2. Fresh setup can import sample telemetry and produce expected report totals.
  3. Copilot CLI integration verification uses cheap models and validates output/telemetry shape rather than answer quality.
  4. Documentation explains setup, privacy defaults, limitations, and official billing caveats.
  5. First release has documented gaps and next-step candidates.

**Verification focus:**
- `npm test` and any lint/typecheck scripts pass.
- Fresh-clone setup works from npm scripts.
- Real or isolated Copilot CLI integration verification uses cheap models.
- Sample end-to-end import produces expected local report totals.

### Phase 4.1: VS Code and Copilot CLI Hook Support Research

**Goal:** Correct the hook setup model so VS Code Copilot and Copilot CLI are both first-class sources, with research-backed configuration and import behavior.

**Covers:** SETUP-03, SETUP-04, INGEST-01, NORM-04, NORM-06, VERIFY-03

**Expected deliverables:**
- Primary-source research on VS Code Copilot hook support and Copilot CLI hook compatibility.
- Explicit setup/configuration model for VS Code telemetry, Copilot CLI telemetry, and shared hook event ingestion.
- Hook preview/install support that can target both surfaces or a specific surface.
- Hook logger normalization for VS Code-compatible and Copilot CLI-native payload field names.
- Documentation and tests that show the project tracks both sources rather than assuming a single Copilot surface.

**Success Criteria** (what must be TRUE):
  1. `setup` output and README separate VS Code telemetry, Copilot CLI telemetry, and hook metadata.
  2. Hook setup can emit a VS Code-compatible config, a Copilot CLI-native config, or a default config suitable for both.
  3. Hook ingestion preserves source/session/label evidence without requiring prompt content storage.
  4. Manual Copilot CLI validation uses the configured hook path and validates hook JSONL collection.
  5. Research artifacts cite primary docs for the hook behavior being implemented.

**Verification focus:**
- Fixture tests for hook config shape and hook payload normalization.
- `npm test`, `npm run check`, `npm run smoke`, and package verification.
- Manual Copilot CLI flow with hooks enabled.

### Phase 5: GitHub and npm Publishing Preparation

**Goal:** Prepare the project to be pushed to GitHub and published to npm with repeatable CI, release checks, and package metadata.

**Covers:** PUBLISH-01, PUBLISH-02, PUBLISH-03, PUBLISH-04, PUBLISH-05

**Expected deliverables:**
- GitHub Actions workflow for install, test, and package verification on pull requests and main branch pushes.
- npm publishing workflow or documented release workflow using provenance and explicit release gates.
- Package metadata suitable for npm publication, including files allowlist, repository metadata, license, and bin validation.
- Release checklist covering GitHub repository setup, npm authentication, dry-run packing, versioning, tagging, and publish verification.
- Documentation for required GitHub/NPM secrets and any manual first-publish steps.

**Success Criteria** (what must be TRUE):
  1. GitHub Actions can run the project verification commands from a clean checkout.
  2. npm package contents can be verified with a dry-run/pack command before publishing.
  3. Release documentation explains how to push to GitHub and publish to npm without leaking local telemetry data.
  4. Package metadata is ready for public npm consumption.
  5. Publishing remains gated by explicit human action or GitHub release/tag controls.

**Verification focus:**
- Workflow YAML syntax and referenced npm scripts are valid.
- `npm pack --dry-run` or equivalent package check passes.
- Release checklist is complete enough for first GitHub push and npm publish.

**Completion Note:** Completed as part of Phase 4 after the user clarified that npm publishing is automated through GitHub Actions and should be ready by the end of the release-candidate hardening phase.

### Phase 6: 0.1.1 Zero-friction setup, automatic hook ingestion, and complete token reporting

**Goal:** Ship `copilot-metrics@0.1.1` as a patch release that makes the published CLI work like a setup-once local tool: setup persists the data home and source configuration, hooks and report commands automatically import newly collected local JSONL, and reports show complete token categories including cached and reasoning tokens.

**Requirements**: SETUP-01, SETUP-04, SETUP-05, SETUP-06, INGEST-01, INGEST-02, INGEST-03, INGEST-06, NORM-03, REPORT-01, REPORT-03, REPORT-08, REPORT-09, REPORT-10
**Depends on:** Phase 5
**Plans:** 1 plan

Plans:
- [x] Setup persistence, automatic import, and complete token reports

**Expected deliverables:**
- Setup/init persists usable configuration in the central user-level data directory so normal Copilot and CLI/report commands do not require users to remember `COPILOT_METRICS_HOME` or per-run environment exports.
- Environment variables remain supported as explicit overrides for custom or automated runs, but the default setup-once flow does not depend on them.
- Hook setup writes commands that target the installed `copilot-metrics` executable in a stable way for npx/global/package usage.
- Report commands automatically import pending hook, VS Code, and Copilot CLI JSONL from configured source paths before querying, with idempotent behavior so repeated reports do not double-count records.
- Label overview and label detail reports include input, output, cache read, cache creation, and reasoning token columns in both human-readable and JSON output.
- Hook-only label evidence is clearly distinguished from token-bearing usage, so labels collected from prompt/session hooks do not imply token totals unless matching OTel usage has been imported and attributed.
- Documentation explains the setup-once flow and the difference between hook attribution events and token-bearing telemetry.

**Success Criteria** (what must be TRUE):
  1. A user can run setup once from a workspace, then run Copilot and `copilot-metrics report labels` without manually running `import` or exporting remembered environment variables.
  2. Reports automatically ingest newly appended configured JSONL files and remain idempotent across repeated runs.
  3. A label seen in hooks and matching token-bearing telemetry shows non-zero input/output/cache/reasoning totals when those token fields exist.
  4. Report JSON exposes all token categories required for downstream analysis.
  5. Human report tables include cached token columns without becoming unreadable.
  6. Empty or hook-only data produces clear output instead of SQLite errors or misleading token totals.

**Verification focus:**
- Fixture tests for idempotent auto-import before report commands.
- Report tests for cache read, cache creation, and reasoning token columns in human and JSON output.
- Setup tests proving persisted config is used without requiring `COPILOT_METRICS_HOME` in normal commands.
- Manual npx validation from an isolated workspace using cheap Copilot models where real Copilot CLI is involved.
- Version, changelog, package verification, GitHub release, and npm trusted-publishing validation for `0.1.1`.

### Phase 7: 0.1.8 Session log fallback ingestion

**Goal:** Ship `copilot-metrics@0.1.8` with session-log parsing as the default fallback for VS Code stable, VS Code Insiders, and Copilot CLI when hooks and OpenTelemetry are missing or broken.

**Requirements**: FALLBACK-01, FALLBACK-02, FALLBACK-03, FALLBACK-04, FALLBACK-05, FALLBACK-06, FALLBACK-07, FALLBACK-08, FALLBACK-09, FALLBACK-10, FALLBACK-11
**Depends on:** Phase 6
**Plans:** 1 plan

Plans:
- [x] Session fallback discovery, import, attribution, diagnostics, and release

**Expected deliverables:**
- Setup/default config includes explicit fallback session sources for VS Code stable, VS Code Insiders, and Copilot CLI, with user-level persisted config and env vars remaining override-only.
- Auto-import treats fallback session logs as first-class configured sources before reports, while keeping OTel and hooks as higher-fidelity optional sources when present.
- VS Code fallback parser handles supported `.jsonl` and `.json` chat session files and extracts session/request identifiers, prompt candidates for label extraction, model/token fields when present, and diagnostics when token fields are absent.
- Copilot CLI fallback parser imports `session-state/*/events.jsonl` from `COPILOT_HOME` or `~/.copilot` and maps shutdown model metrics into normalized usage records.
- Fallback-derived usage and evidence run through the existing `runLabelExtractors` callback path, including configured custom extractors that override the built-in Jira extractor.
- Reports preserve source/session attribution and clearly mark fallback diagnostics without implying official billing precision.
- Documentation and release notes explain fallback behavior, privacy limits, default paths, and how to add custom session directories.

**Success Criteria** (what must be TRUE):
  1. A user can run setup once, have no working hooks or OTel files, and still get report output from local VS Code/Insiders or Copilot CLI session logs when those logs include token metrics.
  2. Repeated report runs are idempotent for fallback logs and do not double-count usage or label evidence.
  3. Custom label extractors are invoked for fallback-derived source data through the same callback contract as OTel and hooks.
  4. Missing, unreadable, unsupported, and tokenless fallback logs produce actionable diagnostics in human-readable and JSON output.
  5. Content capture remains disabled by default; fallback parsing does not persist full prompts or responses unless explicitly enabled.

**Verification focus:**
- Fixture tests for VS Code stable and Insiders default path discovery on Linux, macOS, and Windows path conventions.
- Fixture tests for VS Code `.jsonl` and `.json` chat session fallback parsing.
- Fixture tests for Copilot CLI `session-state/*/events.jsonl` fallback import, including `COPILOT_HOME`.
- Custom extractor tests proving fallback data uses the existing configured extractor callback.
- Report auto-import tests proving fallback idempotence and diagnostics.
- `npm test`, `npm run check`, `npm run smoke`, `npm run verify:package`, and isolated `npx -y copilot-metrics@0.1.8` validation after publish.

### Phase 8: 0.1.9 Better pricing estimates

**Goal:** Ship `copilot-metrics@0.1.9` with pricing reports that use observed charge fields when present, compute high-confidence estimates when cache buckets are known, and explicitly label upper-bound estimates when cache-read counts are missing.

**Requirements**: PRICE-01, PRICE-02, PRICE-03, PRICE-04, PRICE-05, PRICE-06, PRICE-07, PRICE-08, PRICE-09, PRICE-10, PRICE-11, PRICE-12
**Depends on:** Phase 7
**Plans:** 1 plan

Plans:
- [ ] Pricing evidence, estimate confidence, and report semantics

**Expected deliverables:**
- Store/import support for actual local charge evidence such as Copilot CLI `totalNanoAiu`, per-model request cost, total premium requests, and any future observed AI Credit/cents fields.
- Store/import support for session-local model pricing metadata from VS Code/Insiders and Copilot logs, while keeping the existing static pricing table as a fallback.
- A pricing basis model that distinguishes `actual`, `estimated`, `upper_bound`, `included_or_zero`, `unknown_price`, and `conflict` cases in structured output.
- Cache-read availability tracking so missing cache-read token counts do not silently become zero-cost or full-price exact estimates.
- Separate diagnostics for VS Code cache keys/cache types, context utilization, quota SKU, and `multiplierNumeric: 0` evidence when no measured session charge exists.
- Human reports that stay compact while showing whether costs are actual, estimated, or upper bounds.
- JSON reports with enough pricing evidence fields for downstream tooling to audit how every label/model/repo total was calculated.
- Tests and fixtures based on observed Copilot CLI and VS Code Insiders session-log shapes, without storing full prompt content or auth tokens.

**Success Criteria** (what must be TRUE):
  1. Copilot CLI session shutdown records with cache-read tokens and `totalNanoAiu` produce actual local charge fields plus a comparable estimate.
  2. VS Code/Insiders records with model price metadata but no numeric cache-read counts produce upper-bound estimates and visible cache-unknown diagnostics.
  3. Records with complete token buckets produce high-confidence estimates using either session-local pricing or the static table.
  4. Reports aggregate mixed pricing evidence without collapsing upper bounds into exact costs.
  5. Re-importing the same exchange from multiple sources keeps one usage row and preserves the strongest pricing evidence.
  6. VS Code cache keys/cache types and context-utilization lines are surfaced as diagnostics only, not priced token buckets.

**Verification focus:**
- Fixture tests for Copilot CLI `session.shutdown` with `totalNanoAiu`, `modelMetrics`, cache-read tokens, and zero/included request cost.
- Fixture tests for VS Code/Insiders chat sessions with prompt/output tokens, `cacheKey`/`cacheType`, model `inputCost`/`outputCost`/`cacheCost`, `multiplierNumeric: 0`, and missing numeric cache-read counts.
- Fixture tests for VS Code extension/AHP/agenthost logs that redact auth-like values and classify context utilization separately from billing usage.
- Unit tests for estimate classification, cache-known/cache-unknown behavior, and actual-versus-estimate precedence.
- Report tests for human and JSON pricing basis fields on label, model, repo, and detail reports.
- `npm test`, `npm run check`, `npm run smoke`, `npm run verify:package`, and isolated `npx -y copilot-metrics@0.1.9` validation after publish.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Project Foundation and Local Setup | 1/1 | Complete | 2026-05-30 |
| 2. OTel Ingestion, Normalization, and Cost Model | 1/1 | Complete | 2026-05-30 |
| 3. Jira Label Attribution and CLI Querying | 1/1 | Complete    | 2026-05-30 |
| 4. Hardening and Release Readiness | 1/1 | Complete | 2026-05-30 |
| 4.1. VS Code and Copilot CLI Hook Support Research | 1/1 | Complete | 2026-05-30 |
| 5. GitHub and npm Publishing Preparation | 0/0 | Complete via Phase 4 | 2026-05-30 |
| 6. 0.1.1 Zero-friction setup, automatic hook ingestion, and complete token reporting | 1/1 | Complete | 2026-05-30 |
| 7. 0.1.8 Session log fallback ingestion | 1/1 | Complete | 2026-06-02 |
| 8. 0.1.9 Better pricing estimates | 0/1 | Planned | — |

## Deferred

- Official GitHub usage report import and reconciliation.
- Local OTLP collector mode.
- Richer opt-in content capture and redaction tools.
- Dashboard or UI work after CLI queries prove the data model.
