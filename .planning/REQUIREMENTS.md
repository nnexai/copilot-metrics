# Requirements: Copilot Metrics v0.7.0

**Defined:** 2026-07-20
**Core Value:** Give the user a trustworthy local CLI explanation of which Jira labels, repos, models, and Copilot surfaces are driving estimated AI Credit usage.

## v0.7.0 Requirements

### Incremental ingestion

- [x] **ING-01**: Append-only JSONL imports process newly appended bytes without rereading and splitting the complete historical file.
- [x] **ING-02**: Incremental JSONL checkpoints recover safely when a source is truncated, replaced, rotated, malformed, or ends with a partial line.
- [x] **ING-03**: Incremental ingestion preserves line numbers, malformed-record warnings, deduplication, redaction, attribution, and explicit refresh behavior.

### Collection

- [x] **COL-01**: Copilot hook events use a lightweight collection entrypoint that avoids loading SQLite, ingestion, pricing, and report modules.
- [x] **COL-02**: A VS Code session debug log is parsed at most once per import while preserving cached-token evidence for every matching usage record.

### Store maintenance

- [x] **STR-01**: Store schema initialization and legacy duplicate cleanup run only when required by a schema/data migration, not on every query.
- [x] **STR-02**: Historical cost and duplicate repair passes run only when imported data or a versioned repair marker makes them necessary.
- [ ] **STR-03**: Large imports avoid avoidable per-record fingerprint, identity, and last-insert-id queries while retaining existing merge and uniqueness semantics.

### Reports

- [x] **REP-01**: Report queries use appropriate persistent indexes instead of automatic or full scans for label, session, and VS Code backfill lookups.
- [ ] **REP-02**: Label report context avoids redundant evidence and manual-assignment reads while producing equivalent human and JSON results.

### Verification and release

- [x] **VER-01**: Fixture tests cover append, unchanged, truncation, rotation, malformed and partial JSONL inputs plus hook/debug-log behavior.
- [ ] **VER-02**: Benchmarks demonstrate improved incremental refresh, hook startup, store initialization, and report performance without output drift.
- [ ] **VER-03**: The npm package passes the full release checklist and the published version is verified from an isolated environment.

## Future Requirements

### Continuous collection

- **COL-03**: A long-lived optional collector can amortize all Node.js process startup cost across hook events.
- **ING-04**: Multiple changed source files can be parsed concurrently with bounded memory before serialized SQLite writes.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Background service requirement | The CLI and hooks must remain easy to install and work without a daemon. |
| Report semantic or pricing-model changes | This milestone is performance-only and must preserve user-visible meaning. |
| Full prompt or response capture | Privacy defaults remain unchanged; content capture stays disabled. |
| New telemetry providers or dashboard work | They do not contribute to the measured ingestion/report bottlenecks. |

## Definition of Done

- Every v0.7.0 requirement maps to exactly one roadmap phase and is covered by automated verification.
- Existing fixture outputs, label attribution, selected pricing, manual-label precedence, diagnostics, and privacy behavior remain unchanged.
- Measured incremental and repeated-report paths improve materially on representative synthetic and copied-store workloads.
- Release verification, GitHub Actions publication, npm registry checks, and isolated `npx` smoke commands pass.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ING-01 | Phase 20 | Complete |
| ING-02 | Phase 20 | Complete |
| ING-03 | Phase 20 | Complete |
| COL-01 | Phase 20 | Complete |
| COL-02 | Phase 20 | Complete |
| STR-01 | Phase 21 | Complete |
| STR-02 | Phase 21 | Complete |
| STR-03 | Phase 21 | Pending |
| REP-01 | Phase 21 | Complete |
| REP-02 | Phase 21 | Pending |
| VER-01 | Phase 20 | Complete |
| VER-02 | Phase 21 | Pending |
| VER-03 | Phase 21 | Pending |

**Coverage:**

- v0.7.0 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---
*Requirements defined: 2026-07-20*
*Last updated: 2026-07-20 after roadmap creation*
