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
- [x] **v0.7.0 Ingestion and Reporting Scalability** - Incremental JSONL and lightweight collection, scalable store/report paths, and verified `copilot-metrics@0.7.0` publication. See `.planning/milestones/v0.7.0-ROADMAP.md`.

## Archive

Phase execution history for completed milestones is stored under `.planning/milestones/v*-phases/`.

Start the next milestone with `$gsd-new-milestone`.
