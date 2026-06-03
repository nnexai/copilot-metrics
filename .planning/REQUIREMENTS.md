# Requirements: v0.4.0 label association confidence

**Defined:** 2026-06-03
**Core Value:** Give the user a trustworthy local CLI explanation of which Jira labels, repos, models, and Copilot surfaces are driving estimated AI Credit usage.

## Overview

This milestone makes label attribution reliable when extraction finds multiple labels in the same session. The store keeps all associations and their evidence, while reports use deterministic confidence ranking so default totals avoid overlap and label-specific reports can deliberately broaden inclusion with top-k semantics.

## v0.4.0 Requirements

### Setup

- [ ] **SETUP-07**: User can provide a `labelPattern` value during init/setup and have it persisted in the local config without hand-editing JSON.
- [ ] **SETUP-08**: Setup guidance explains that configured label patterns change extraction format while confidence ranking still uses source/evidence semantics.

### Association Storage

- [ ] **ASSOC-01**: User can import sessions where every discovered label association is stored with label, source type, source field, source value, session ID, usage linkage when available, and confidence inputs.
- [ ] **ASSOC-02**: User can re-import or refresh sources idempotently without duplicating association evidence or losing existing evidence needed for confidence ranking.
- [ ] **ASSOC-03**: User can inspect machine-readable label evidence that distinguishes folder, branch, metadata/context, prompt, response, and tool-call findings.

### Confidence Ranking

- [ ] **CONF-01**: User gets deterministic label confidence scores where cwd/folder and branch evidence rank very high, metadata/session context ranks high, and prompt/response/tool-call matches contribute smaller evidence.
- [ ] **CONF-02**: User gets higher confidence for repeated lower-weight mentions of the same label within a session while avoiding unbounded score inflation from duplicate identical evidence.
- [ ] **CONF-03**: User gets deterministic tie-breaking for labels with equal confidence so report totals are stable across runs.
- [ ] **CONF-04**: User can see confidence rank, score, and evidence summary in JSON output for label association reports.

### Reports

- [ ] **REPORT-20**: User can run label overview reports where each session contributes to exactly one label: the highest-confidence label for that session.
- [ ] **REPORT-21**: User can query a specific label with default semantics that include only sessions where that label is the top-ranked label.
- [ ] **REPORT-22**: User can query a specific label with a top-k option that includes sessions where that label is ranked within the requested top K.
- [ ] **REPORT-23**: User can request a middle-detail label report that shows one row per session with aggregate tokens, estimated USD, estimated AI Credits, selected pricing basis, top label, requested label rank, confidence score, and evidence summary.
- [ ] **REPORT-24**: Human-readable and JSON report output clearly indicate when totals are top-label-only versus top-k inclusion so broader reports are not mistaken for non-overlapping totals.

## Future Requirements

- User-configurable confidence weights after default scoring has real usage feedback.
- Cross-label manual override or pinning for sessions where automatic ranking is not enough.
- Dashboard views for association confidence once CLI semantics are stable.
- Official GitHub billing/usage API reconciliation when accessible.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Storing full prompts or assistant responses by default | Privacy boundary remains unchanged; confidence should use extracted evidence summaries unless content capture is explicitly enabled. |
| Making top-k overview totals additive by default | Top-k can intentionally overlap sessions, but overview defaults must remain non-overlapping. |
| Machine-learning attribution model | Weighted evidence is inspectable, testable, and sufficient for this milestone. |
| Replacing JavaScript extractor override semantics | v0.3.0 established replacement semantics; this milestone ranks whatever associations the active extractor path emits. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SETUP-07 | Phase 12 | Pending |
| SETUP-08 | Phase 12 | Pending |
| ASSOC-01 | Phase 13 | Pending |
| ASSOC-02 | Phase 13 | Pending |
| ASSOC-03 | Phase 13 | Pending |
| CONF-01 | Phase 13 | Pending |
| CONF-02 | Phase 13 | Pending |
| CONF-03 | Phase 13 | Pending |
| CONF-04 | Phase 13 | Pending |
| REPORT-20 | Phase 14 | Pending |
| REPORT-21 | Phase 14 | Pending |
| REPORT-22 | Phase 14 | Pending |
| REPORT-23 | Phase 14 | Pending |
| REPORT-24 | Phase 14 | Pending |

**Coverage:**
- v0.4.0 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-06-03*
*Last updated: 2026-06-03 after roadmap creation*
