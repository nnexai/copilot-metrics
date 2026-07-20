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
- [x] **v0.6.0 performance improvements** - File-backed SQLite storage, refresh batching, label report query reuse, and `copilot-metrics@0.6.0` release. See `.planning/milestones/v0.6.0-ROADMAP.md`.
- [ ] **v0.7.0 Ingestion and Reporting Scalability** - Incremental JSONL and lightweight collection followed by scalable store/report paths and release verification.

## Phases

- [ ] **Phase 20: Incremental JSONL and Lightweight Collection** - Make append-only refresh and hook/debug collection scale with new work while preserving ingestion behavior.
- [ ] **Phase 21: Store and Report Scalability and Release Verification** - Scale store maintenance and reports, benchmark the milestone, and verify the published package.

## Phase Details

### Phase 20: Incremental JSONL and Lightweight Collection
**Goal**: Users can refresh growing append-only telemetry and session logs, and collect hook/debug evidence, without repeatedly paying for historical input or heavyweight startup.
**Depends on**: Phase 19
**Requirements**: ING-01, ING-02, ING-03, COL-01, COL-02, VER-01
**Success Criteria** (what must be TRUE):
  1. Repeated refreshes of append-only telemetry and session JSONL process only newly appended bytes, while an unchanged source requires no historical reread.
  2. Truncated, replaced, rotated, malformed, and partial-line sources recover safely without losing line-aware warnings, deduplication, redaction, attribution, or explicit refresh behavior.
  3. Copilot hook events are collected through a lightweight entrypoint without loading the store, ingestion, pricing, or reporting stack.
  4. Each VS Code session debug log is parsed at most once per import while all matching usage records retain their cached-token evidence.
  5. Fixture-backed verification demonstrates the incremental JSONL, hook, and debug-log behaviors across normal and recovery cases.
**Plans**: TBD

### Phase 21: Store and Report Scalability and Release Verification
**Goal**: Users can import large histories and run repeated reports with bounded maintenance/query overhead while receiving the same estimates, attribution, diagnostics, and output contracts from a verified release.
**Depends on**: Phase 20
**Requirements**: STR-01, STR-02, STR-03, REP-01, REP-02, VER-02, VER-03
**Success Criteria** (what must be TRUE):
  1. Opening or querying an up-to-date store does not rerun legacy cleanup or historical repair work unless a schema, data, import, or versioned repair marker requires it.
  2. Large imports retain existing merge and uniqueness behavior without avoidable per-record fingerprint, identity, or last-insert-id queries.
  3. Label, session, and VS Code backfill lookups use persistent indexes, and label reports reuse evidence/manual-assignment context while preserving equivalent human and JSON results.
  4. Repeatable benchmarks show improved incremental refresh, hook startup, store initialization, and report performance with no selected-price, confidence, manual-label, diagnostics, privacy, or report-output drift.
  5. The full release checklist passes and the published npm package succeeds in registry checks and isolated-environment smoke verification.
**Plans**: TBD

## Progress

**Execution Order:** Phase 20 → Phase 21

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 20. Incremental JSONL and Lightweight Collection | v0.7.0 | 0/TBD | Not started | - |
| 21. Store and Report Scalability and Release Verification | v0.7.0 | 0/TBD | Not started | - |

## Archive

Phase execution history for `v0.4.0` is archived under `.planning/milestones/v0.4.0-phases/`.
Phase execution history for `v0.5.0` is archived under `.planning/milestones/v0.5.0-phases/`.
Phase execution history for `v0.6.0` is archived under `.planning/milestones/v0.6.0-phases/`.
