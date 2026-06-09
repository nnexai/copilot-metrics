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
- [ ] **v0.5.0 manual session labels** - Manual session label assignment with higher precedence than auto-detected label evidence.

## Current Position

Phase 15 is complete. Phase 16 is ready for planning.

## v0.5.0 manual session labels

**Goal:** Add manual session label assignment while preserving automatic evidence and making manual labels the highest-precedence source in default reports.

- [x] Phase 15: Manual label assignment CLI and storage (completed 2026-06-09)
- [ ] Phase 16: Manual precedence reports and release readiness

### Phase 15: Manual label assignment CLI and storage

**Goal:** Provide a CLI correction surface and durable storage for manual session label assignments.

**Requirements:** MLAB-01, MLAB-02, MLAB-03, MLAB-04, MLAB-09

**Key work:**

- Define the storage shape for manual label assignment provenance.
- Add CLI commands to assign, list, replace, and remove manual labels for a session.
- Validate assigned labels against configured label patterns where practical.
- Preserve auto-detected evidence rows while keeping manual assignments separate and explicit.

**Status:** Complete

### Phase 16: Manual precedence reports and release readiness

**Goal:** Make manual labels outrank automatic evidence in confidence ranking and expose manual provenance in reports.

**Requirements:** MLAB-05, MLAB-06, MLAB-07, MLAB-08, MLAB-10

**Key work:**

- Update `label-confidence:v1` ranking so manual assignments always outrank auto-detected evidence.
- Keep auto evidence visible in detail and audit output after manual overrides.
- Add human-readable and JSON report indicators for manual assignment provenance.
- Add fixture coverage for assignment, replacement, removal, ranking precedence, and report output.
- Prepare package metadata, README, changelog, and release verification for `copilot-metrics@0.5.0`.

**Status:** Planned

## Archive

Phase execution history for `v0.4.0` is archived under `.planning/milestones/v0.4.0-phases/`.
