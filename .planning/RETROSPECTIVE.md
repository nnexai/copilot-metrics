# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v0.3.0 — configurable label patterns

**Shipped:** 2026-06-02
**Phases:** 1 quick release | **Plans:** 1

### What Was Built

- Configurable regex patterns for the internal label extractor through `labelPatterns`.
- Single-pattern aliases through `labelPattern` and `labelRegex`.
- Preservation of built-in metadata scanning, evidence shape, confidence scoring, and de-duplication for configured regex matches.
- Replacement-only JavaScript extractor semantics retained for advanced users.
- Release documentation and verification for `copilot-metrics@0.3.0`.

### What Worked

- Keeping regex configuration inside the existing internal extractor avoided a second attribution path.
- Treating JavaScript callbacks as replacement-only kept the advanced extension contract simple.
- Version and package verification guardrails kept release documentation tied to `package.json`.

### What Was Inefficient

- Phase 11 was completed as a quick task, so the SDK archive could not discover a normal Phase 11 directory.
- Milestone close required manual summary cleanup to preserve the quick-release accomplishments.

### Patterns Established

- Use configured regex patterns for common label customization and JavaScript callbacks only when the user needs full replacement logic.
- Keep release validation grounded in local package checks plus isolated `npx` validation after publication.

### Key Lessons

1. Quick release tasks should still leave enough structured milestone evidence for archive tooling.
2. The label extraction contract is easier to reason about when each customization mode has clear override semantics.

### Cost Observations

- No milestone-level model cost summary was captured.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Key Change |
|-----------|--------|------------|
| v0.3.0 | 1 quick release | Added lightweight label customization without expanding the extractor contract. |

### Top Lessons

1. Preserve extension contracts when adding lower-friction configuration paths.
2. Archive tooling works best when quick tasks are represented in structured milestone artifacts.
