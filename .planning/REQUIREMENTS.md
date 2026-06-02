# Requirements: v0.3.0 configurable label patterns

**Created:** 2026-06-02
**Milestone:** v0.3.0 configurable label patterns

## Overview

This release adds the middle-ground label customization path: users can keep the built-in extractor's safe metadata fields, source evidence, confidence rules, and de-duplication while replacing only the regex pattern used to identify labels. Full JavaScript extractors remain available for advanced replacement logic.

## Validated Requirements

- [x] **PAT-01**: User can configure one or more regex patterns through local config using `labelPatterns`.
- [x] **PAT-02**: Configured regex patterns use the built-in extractor's field coverage, source evidence shape, source-value handling, and confidence scoring.
- [x] **PAT-03**: Pattern matches use the first capture group as the label when present, otherwise the full regex match.
- [x] **PAT-04**: User can use `labelPattern` or `labelRegex` as a single-pattern alias for simple configs.
- [x] **PAT-05**: Existing `labelExtractors` JavaScript callbacks keep replacement semantics and override default/configured regex extraction when present.
- [x] **PAT-06**: Setup-created config includes the new pattern option without requiring users to configure it.
- [x] **PAT-07**: README and changelog document the default extractor, configured pattern extractor, and JavaScript replacement extractor behavior for `copilot-metrics@0.3.0`.
- [x] **PAT-08**: User can verify the release through the existing npm scripts and package dry-run.

## Future Requirements

- Official GitHub billing/usage API reconciliation when accessible.
- Historical price-table sync or refresh automation.
- Richer dashboard views after selected-price CLI semantics are stable.

## Out of Scope

- Making displayed VS Code credits official billing authority; GitHub billing remains the source of truth.
- Reading Chronicle `turns.user_message`, `turns.assistant_response`, or FTS content by default.
- Treating VS Code cache metadata (`cacheKey`, `cacheType`) as cache-read token counts when no numeric cache-read count is present.
- Storing full prompts or assistant responses by default.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PAT-01 | Phase 11 | Validated |
| PAT-02 | Phase 11 | Validated |
| PAT-03 | Phase 11 | Validated |
| PAT-04 | Phase 11 | Validated |
| PAT-05 | Phase 11 | Validated |
| PAT-06 | Phase 11 | Validated |
| PAT-07 | Phase 11 | Validated |
| PAT-08 | Phase 11 | Validated |
