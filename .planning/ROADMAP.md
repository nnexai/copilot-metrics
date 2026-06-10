# Roadmap: Copilot Metrics

**Created:** 2026-05-30
**Granularity:** Coarse
**Mode:** Autonomous / YOLO

## Milestones

- [x] **v0.1.1 Local Copilot Usage Tracker** - Initial CLI, setup, ingestion, attribution, reports, hardening, and release readiness. See `.planning/milestones/v0.1.1-ROADMAP.md`.
- [x] **v0.1.8 Session log fallback ingestion** - Default VS Code, VS Code Insiders, and Copilot CLI fallback session parsing.
- [x] **v0.1.9 Better pricing estimates** - Observed local charge evidence, cache-read status, upper-bound estimates, and pricing diagnostics.
- [x] **v0.2.0 VS Code displayed credits** - Displayed-credit evidence and marked inferred cache/credit values.
- [x] **v0.2.1 selected session pricing and VS Code dedupe** - One selected price per session/request and duplicate identity repair.
- [x] **v0.3.0 configurable label patterns** - Regex-configurable internal label extraction while preserving JavaScript extractor replacement semantics. See `.planning/milestones/v0.3.0-ROADMAP.md`.
- [x] **v0.4.0 label association confidence** - Setup-time `labelPatterns`, granular association confidence ranking, top-label default reports, top-k/all-match inclusion, and per-session label detail. See `.planning/milestones/v0.4.0-ROADMAP.md`.
- [x] **v0.5.0 manual session labels** - Manual session label assignment with higher precedence than auto-detected label evidence. See `.planning/milestones/v0.5.0-ROADMAP.md`.
- [ ] **v0.6.0 performance improvements** - Faster refresh and report commands without changing storage semantics, selected pricing, label ranking, or CLI output contracts.

## Current Position

v0.6.0 is ready for planning. Continue phase numbering from Phase 17.

## v0.6.0 Phases

### Phase 17: File-Backed SQLite Storage

**Goal:** Replace the repeated full-file `sql.js` store load/export pattern with a file-backed SQLite storage path while preserving the existing store API and behavior.

**Requirements:** PERF-01, PERF-02, PERF-03, PERF-04

**Success criteria:**

1. Existing setup, import, label, and report tests pass against the new storage path.
2. Schema initialization, migrations, constraints, checkpoints, manual labels, selected pricing, and diagnostics persist equivalently.
3. Multi-step store mutations use shared connections and transactions rather than one full DB export per helper call.
4. Package validation proves the native dependency can be installed and used through local CLI/package workflows.

**Plans:** 3 plans

Plans:
- [ ] 17-01-PLAN.md — Create storage equivalence tests, native package smoke, benchmark contract, and package artifact guardrails.
- [ ] 17-02-PLAN.md — Replace `sql.js` internals with file-backed `better-sqlite3` while preserving the async store facade and transaction behavior.
- [ ] 17-03-PLAN.md — Validate native package workflows, run storage benchmark, and prove Phase 17 package gates.

### Phase 18: Refresh Import Batching

**Goal:** Make normal reports and explicit `--refresh` avoid unnecessary source processing and database writes, especially for large Copilot session-state source sets.

**Requirements:** PERF-05, PERF-06, PERF-07, PERF-08

**Success criteria:**

1. Normal report commands still auto-import appended telemetry/session data while skipping unchanged configured sources.
2. Explicit `--refresh` still re-reads changed source files and preserves VS Code debug-sidecar cache evidence behavior.
3. Copilot session-state refresh work batches inserts, checkpoints, duplicate repair, and cost repair across shared database work.
4. Copied-store refresh benchmarks show materially lower wall time than the spike baseline.

### Phase 19: Report Query Optimization and Release

**Goal:** Reduce normal report/detail latency, prove output equivalence, and ship the performance milestone through the established release path.

**Requirements:** PERF-09, PERF-10, PERF-11, PERF-12, PERF-13, PERF-14

**Success criteria:**

1. Label overview/detail/session-detail reports reuse per-command evidence and ranking work where possible.
2. JSON and human report output remains equivalent for selected pricing, top-label, top-k, all-match, manual provenance, diagnostics, and estimates.
3. Fixture tests cover backend equivalence and report contract stability.
4. Performance benchmarks report baseline versus improved timings for normal reports, detail reports, refresh, and representative write workloads.
5. Release checks pass locally and external `npx` validation confirms the published package runs outside the checkout.

## Archive

Phase execution history for `v0.4.0` is archived under `.planning/milestones/v0.4.0-phases/`.
Phase execution history for `v0.5.0` is archived under `.planning/milestones/v0.5.0-phases/`.
