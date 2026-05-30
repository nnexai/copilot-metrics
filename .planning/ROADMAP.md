# Roadmap: Copilot Metrics

**Created:** 2026-05-30
**Granularity:** Coarse
**Mode:** Autonomous / YOLO

## Overview

Build a local-first Copilot usage tracker in four slices: easy-install CLI/scripts/hooks foundation, telemetry ingestion and cost estimation, Jira-label attribution and CLI querying, then hardening for regular use.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions, if needed later

- [ ] **Phase 1: Project Foundation and Local Setup** - Create Node.js/npm CLI/script/hook skeleton and local telemetry setup helpers.
- [ ] **Phase 2: OTel Ingestion, Normalization, and Cost Model** - Parse local telemetry, normalize LLM calls, and estimate AI Credits.
- [ ] **Phase 3: Jira Label Attribution and CLI Querying** - Attribute usage to Jira labels/repos and expose local query commands.
- [ ] **Phase 4: Hardening and Release Readiness** - Add durable verification and first-release docs.

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
  1. User can list discovered Jira labels such as `HDASPF-12345` with sessions, tokens, credits, first seen, and last seen.
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

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Project Foundation and Local Setup | 0/0 | Not started | - |
| 2. OTel Ingestion, Normalization, and Cost Model | 0/0 | Not started | - |
| 3. Jira Label Attribution and CLI Querying | 0/0 | Not started | - |
| 4. Hardening and Release Readiness | 0/0 | Not started | - |

## Deferred

- Official GitHub usage report import and reconciliation.
- Local OTLP collector mode.
- Richer opt-in content capture and redaction tools.
- Dashboard or UI work after CLI queries prove the data model.
