# Requirements: Copilot Metrics

**Defined:** 2026-05-30
**Core Value:** Give the user a trustworthy local CLI explanation of which Jira labels, repos, models, and Copilot surfaces are driving estimated AI Credit usage.

## v1 Requirements

### Project Foundation

- [x] **FOUND-01**: Project uses Node.js with npm scripts for development, verification, and runnable commands.
- [x] **FOUND-02**: Project defines a central user-level data directory for all local metadata and generated stores.
- [x] **FOUND-03**: Project documents supported local inputs: VS Code Insiders Copilot OTel JSONL, Copilot CLI OTel JSONL, and Copilot CLI hook JSONL.
- [x] **FOUND-04**: Project keeps content capture disabled by default in generated setup guidance.
- [x] **FOUND-05**: Project is structured as easy-to-install local CLI tools, scripts, and hooks rather than a dashboard-first app.

### Setup

- [x] **SETUP-01**: User can initialize the central data directory from an npm script or CLI command.
- [x] **SETUP-02**: User can generate or view VS Code Insiders OTel settings that export to the central data directory.
- [x] **SETUP-03**: User can generate or view Copilot CLI OTel environment exports that write to the central data directory.
- [x] **SETUP-04**: User can install or preview Copilot CLI hook configuration for local attribution logging.
- [x] **SETUP-05**: User can complete setup from npm scripts or CLI commands without manually editing generated hook/script files.

### Ingestion

- [ ] **INGEST-01**: Tool can read VS Code Copilot OTel JSONL files from configured local paths.
- [ ] **INGEST-02**: Tool can read Copilot CLI OTel JSONL files from configured local paths.
- [ ] **INGEST-03**: Tool can read Copilot CLI hook JSONL files from configured local paths.
- [ ] **INGEST-04**: Tool tolerates malformed or partial JSONL records and reports skipped rows.
- [ ] **INGEST-05**: Tool stores imported records in a local queryable store without requiring a remote service.

### Normalization

- [ ] **NORM-01**: Tool identifies billing-like LLM chat/model-call spans separately from root agent and tool spans.
- [ ] **NORM-02**: Tool extracts timestamp, surface, conversation ID or session ID, requested model, resolved model, repo, branch, cwd, and commit when available.
- [ ] **NORM-03**: Tool extracts input, output, cache read, cache creation, and reasoning token fields when present.
- [ ] **NORM-04**: Tool extracts Jira-style labels such as `HDASPF-12345` from prompts, directories, branch names, hook metadata, and tool-call context.
- [ ] **NORM-05**: Tool prevents double-counting when both root agent spans and lower-level LLM spans contain token totals.
- [ ] **NORM-06**: Tool preserves enough source context to explain where a label came from without storing full prompt content by default.

### Cost Estimation

- [ ] **COST-01**: Tool includes a versioned model pricing table for GitHub Copilot model token categories.
- [ ] **COST-02**: Tool estimates USD cost from model-specific input, output, cache read, and cache creation rates.
- [ ] **COST-03**: Tool converts estimated USD to GitHub AI Credits.
- [ ] **COST-04**: Tool flags unknown models or missing pricing instead of silently producing false precision.
- [ ] **COST-05**: Tool labels all costs as estimates, not official billing records.

### Reporting

- [ ] **REPORT-01**: User can view a label overview listing discovered Jira labels, sessions, token totals, estimated credits, first seen, and last seen.
- [ ] **REPORT-02**: User can view usage grouped by model.
- [ ] **REPORT-03**: User can view summarized usage for a single Jira label.
- [ ] **REPORT-04**: User can view usage grouped by repo and directory.
- [ ] **REPORT-05**: User can view unattributed usage with enough context to fix labeling.
- [ ] **REPORT-06**: User can view detailed records for a single Jira label.
- [ ] **REPORT-07**: Reports can run entirely from local files and the local store.
- [ ] **REPORT-08**: Reports support both human-readable output and machine-readable output.

### Verification

- [ ] **VERIFY-01**: Tests cover sample VS Code OTel records.
- [ ] **VERIFY-02**: Tests cover sample Copilot CLI OTel records.
- [ ] **VERIFY-03**: Tests cover sample Copilot CLI hook records.
- [ ] **VERIFY-04**: Tests prove root agent spans are not double-counted with LLM chat spans.
- [ ] **VERIFY-05**: Tests prove unknown pricing is surfaced clearly.
- [ ] **VERIFY-06**: Copilot CLI integration verification can run against the real CLI or an isolated test environment using cheap models only.

### Publishing Preparation

- [ ] **PUBLISH-01**: Project includes GitHub Actions CI that runs install and npm verification commands.
- [ ] **PUBLISH-02**: Project includes an npm publish workflow or documented release workflow with explicit human-controlled release gates.
- [ ] **PUBLISH-03**: Package metadata is ready for npm publication, including repository, license, files allowlist, and bin validation.
- [ ] **PUBLISH-04**: Release checklist documents GitHub repository setup, npm authentication, dry-run packing, versioning, tagging, and publish verification.
- [ ] **PUBLISH-05**: Publishing docs warn not to include local telemetry data, generated stores, or sensitive hook logs in the package or repository.

## v2 Requirements

### Reconciliation

- **RECON-01**: User can import official GitHub Copilot usage reports when they have the required permissions.
- **RECON-02**: Tool can compare local estimates to official reports by date, user, model, and surface where data overlaps.

### Collector Mode

- **COLL-01**: Tool can run or configure a local OTLP collector instead of file-only export.
- **COLL-02**: Tool can ingest from collector output without changing the normalized reporting model.

### Privacy Controls

- **PRIV-01**: User can opt into richer local content capture with explicit warnings and redaction settings.
- **PRIV-02**: User can purge prompt previews, hook previews, or all local metadata for a date range.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Official billing replacement | GitHub remains the legal source of billing truth. |
| Network interception | Fragile and risky with work credentials and TLS. |
| Admin-only API dependency | User may not have organization or enterprise Copilot metrics permissions. |
| Inline completion cost tracking | Code completions and next edit suggestions are not billed through AI Credits. |
| Full prompt archive by default | Too risky for work data and not required for task attribution. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Complete |
| FOUND-02 | Phase 1 | Complete |
| FOUND-03 | Phase 1 | Complete |
| FOUND-04 | Phase 1 | Complete |
| FOUND-05 | Phase 1 | Complete |
| SETUP-01 | Phase 1 | Complete |
| SETUP-02 | Phase 1 | Complete |
| SETUP-03 | Phase 1 | Complete |
| SETUP-04 | Phase 1 | Complete |
| SETUP-05 | Phase 1 | Complete |
| INGEST-01 | Phase 2 | Pending |
| INGEST-02 | Phase 2 | Pending |
| INGEST-03 | Phase 2 | Pending |
| INGEST-04 | Phase 2 | Pending |
| INGEST-05 | Phase 2 | Pending |
| NORM-01 | Phase 2 | Pending |
| NORM-02 | Phase 2 | Pending |
| NORM-03 | Phase 2 | Pending |
| NORM-04 | Phase 3 | Pending |
| NORM-05 | Phase 2 | Pending |
| NORM-06 | Phase 3 | Pending |
| COST-01 | Phase 2 | Pending |
| COST-02 | Phase 2 | Pending |
| COST-03 | Phase 2 | Pending |
| COST-04 | Phase 2 | Pending |
| COST-05 | Phase 2 | Pending |
| REPORT-01 | Phase 3 | Pending |
| REPORT-02 | Phase 3 | Pending |
| REPORT-03 | Phase 3 | Pending |
| REPORT-04 | Phase 3 | Pending |
| REPORT-05 | Phase 3 | Pending |
| REPORT-06 | Phase 3 | Pending |
| REPORT-07 | Phase 3 | Pending |
| REPORT-08 | Phase 3 | Pending |
| VERIFY-01 | Phase 4 | Pending |
| VERIFY-02 | Phase 4 | Pending |
| VERIFY-03 | Phase 4 | Pending |
| VERIFY-04 | Phase 4 | Pending |
| VERIFY-05 | Phase 4 | Pending |
| VERIFY-06 | Phase 4 | Pending |
| PUBLISH-01 | Phase 5 | Pending |
| PUBLISH-02 | Phase 5 | Pending |
| PUBLISH-03 | Phase 5 | Pending |
| PUBLISH-04 | Phase 5 | Pending |
| PUBLISH-05 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 45 total
- Mapped to phases: 45
- Unmapped: 0

---
*Requirements defined: 2026-05-30*
*Last updated: 2026-05-30 after adding Phase 5*
