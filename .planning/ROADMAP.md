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
- [ ] **v0.4.0 label association confidence** - Store all label associations, rank labels by confidence, and make reports avoid overlapping session counts by default.

## Current Position

Milestone `v0.4.0` is active and in planning. Phase numbering continues from the shipped v0.3.0 milestone.

## Next

Start with Phase 12: `v0.4.0 setup labelPattern init`.

## Active Milestone: v0.4.0 label association confidence

### Phase 12: v0.4.0 setup labelPattern init

**Goal:** Let users set the internal extractor label pattern during setup/init without hand-editing config, while documenting how pattern configuration interacts with confidence ranking.

**Requirements:** SETUP-07, SETUP-08

**Expected deliverables:**

- Setup/init option or prompt for `labelPattern`.
- Persisted config update that remains compatible with existing `labelPatterns`, `labelPattern`, and `labelRegex` aliases.
- Documentation and tests showing the setup path and extractor semantics.

**Success Criteria** (what must be TRUE):

1. A user can run setup/init with a pattern such as `([A-Z]+-\d+)` and see it persisted in the central local config.
2. Existing configs without `labelPattern` continue to use built-in defaults.
3. JavaScript `labelExtractors` replacement semantics remain unchanged.
4. README or setup output explains that pattern matching and confidence ranking are separate concerns.

### Phase 13: v0.4.0 label association confidence model

**Goal:** Preserve all label associations and compute deterministic per-session label confidence rankings from source strength and accumulated evidence.

**Requirements:** ASSOC-01, ASSOC-02, ASSOC-03, CONF-01, CONF-02, CONF-03, CONF-04

**Expected deliverables:**

- Store/schema updates or repair path for association evidence needed by confidence ranking.
- Confidence scorer with source-weight defaults: cwd/folder and branch very high; metadata/session context high; prompt, response, and tool-call mentions lower but accumulating.
- Duplicate-evidence handling so repeated unique mentions help while identical replayed evidence does not inflate scores.
- Stable tie-breaking and JSON-visible confidence/rank details.
- Fixture coverage for branch/folder dominance, accumulated prompt evidence, duplicate evidence, and ties.

**Success Criteria** (what must be TRUE):

1. Import preserves multiple labels for one session with source/evidence detail.
2. Folder or branch evidence outranks incidental prompt/response matches unless the lower-weight evidence has enough distinct accumulation.
3. Re-importing the same source does not duplicate confidence evidence.
4. Equal-score labels rank deterministically across repeated report runs.
5. JSON output exposes enough score and evidence detail to explain why a label won.

### Phase 14: v0.4.0 confidence-aware label reports

**Goal:** Make label reports use top-confidence semantics by default and add a per-session middle-detail view that is more useful than summary but less noisy than raw detail.

**Requirements:** REPORT-20, REPORT-21, REPORT-22, REPORT-23, REPORT-24

**Expected deliverables:**

- Label overview aggregation that counts each session exactly once under its top-ranked label by default.
- Label-specific report default that includes only sessions where the requested label is top-ranked.
- Top-k option for label reports to include sessions where the requested label ranks within K.
- Middle-detail report mode with per-session aggregate tokens, costs, credits, selected pricing basis, top label, requested label rank, confidence score, and evidence summary.
- Human-readable and JSON output fields that identify top-only versus top-k inclusion behavior.

**Success Criteria** (what must be TRUE):

1. Overview totals do not double-count a session when several labels were discovered.
2. A specific-label report excludes sessions where that label was only incidental by default.
3. `top-k` inclusion can deliberately include incidental or secondary labels without hiding that totals may overlap.
4. The middle-detail view shows session-level aggregates without pretending each session used only one model.
5. Report tests cover human and JSON output for overview, label default, top-k, and middle-detail modes.

## Archive

Phase execution history for `v0.3.0` is archived under `.planning/milestones/v0.3.0-phases/`.
