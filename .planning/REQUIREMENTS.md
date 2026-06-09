# Requirements: Copilot Metrics v0.6.0

**Defined:** 2026-06-09
**Core Value:** Give the user a trustworthy local CLI explanation of which Jira labels, repos, models, and Copilot surfaces are driving estimated AI Credit usage.

## v0.6.0 Requirements

### Storage Backend

- [ ] **PERF-01**: User can run existing setup, import, label, and report commands against a file-backed SQLite store without changing command syntax or output semantics.
- [ ] **PERF-02**: The storage layer preserves the existing schema, migrations, dedupe constraints, import checkpoints, manual label assignments, selected pricing fields, diagnostics, and warning rows.
- [ ] **PERF-03**: The implementation uses shared database connections and explicit transactions for multi-step import/refresh work instead of repeatedly loading and exporting the full SQLite database file.
- [ ] **PERF-04**: If `better-sqlite3` is adopted as the default backend, package installation and release validation prove the native dependency works through local CLI and external `npx` usage on supported Node versions.

### Refresh Performance

- [ ] **PERF-05**: Normal report commands avoid reprocessing unchanged configured sources while still auto-importing newly appended local telemetry/session data.
- [ ] **PERF-06**: `--refresh` remains an explicit correctness tool that can re-read changed source files, but avoids unnecessary writes for unchanged checkpoints and unchanged diagnostics.
- [ ] **PERF-07**: Copilot session-state refresh work is batched so large configured source sets do not pay one full-store rewrite per source file.
- [ ] **PERF-08**: VS Code chat-session refresh behavior continues to account for debug sidecar fingerprints so cached-token evidence is not missed.

### Report Performance

- [ ] **PERF-09**: Label overview, label detail, and label session-detail reports reuse per-command evidence and confidence-ranking work instead of recomputing the same broad rowsets repeatedly.
- [ ] **PERF-10**: Model, repo, unattributed, label, and manual-label reports keep the existing selected-price, top-label, top-k, all-match, and provenance JSON contracts.
- [ ] **PERF-11**: Human-readable output remains compact and unchanged in meaning while performance instrumentation stays outside normal report output unless explicitly requested.

### Verification and Release

- [ ] **PERF-12**: Fixture-based tests cover storage backend equivalence for imports, checkpoints, duplicate repair, manual labels, label evidence, selected pricing, and reports.
- [ ] **PERF-13**: Performance verification runs against copied stores and reports baseline versus improved timings for normal reports, detail reports, refresh, and representative checkpoint/write workloads.
- [ ] **PERF-14**: Release checks validate local package tests, packaging, README version sync, and external `npx -y copilot-metrics@<version>` behavior outside the checkout.

## Deferred Requirements

### Future Performance UX

- **PERF-F01**: User can request a dedicated performance diagnostics command that prints source-count, checkpoint, and slow-source timing summaries.
- **PERF-F02**: User can configure retention/pruning policies for old raw records, import warnings, or historical checkpoints.
- **PERF-F03**: User can opt into persistent precomputed report aggregates for very large stores.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Changing selected-price aggregation semantics | v0.6.0 is performance work; selected-price behavior must remain stable. |
| Changing default top-label report semantics | Performance improvements must not reintroduce overlapping default label totals. |
| Removing local JSONL/session fallback ingestion | The current local-first data model remains the product foundation. |
| Requiring services, dashboards, daemons, or admin billing access | The milestone keeps the CLI-first, setup-once workflow. |
| Storing full prompts to improve performance or selection | Content capture remains disabled by default for privacy. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PERF-01 | Phase 17 | Planned |
| PERF-02 | Phase 17 | Planned |
| PERF-03 | Phase 17 | Planned |
| PERF-04 | Phase 17 | Planned |
| PERF-05 | Phase 18 | Planned |
| PERF-06 | Phase 18 | Planned |
| PERF-07 | Phase 18 | Planned |
| PERF-08 | Phase 18 | Planned |
| PERF-09 | Phase 19 | Planned |
| PERF-10 | Phase 19 | Planned |
| PERF-11 | Phase 19 | Planned |
| PERF-12 | Phase 19 | Planned |
| PERF-13 | Phase 19 | Planned |
| PERF-14 | Phase 19 | Planned |

**Coverage:**

- v0.6.0 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-06-09*
