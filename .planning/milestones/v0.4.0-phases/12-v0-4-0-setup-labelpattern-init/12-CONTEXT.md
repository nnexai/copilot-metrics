# Phase 12: v0.4.0 setup labelPattern init - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase lets users configure internal extractor label patterns during setup/init without hand-editing the central local config. It covers CLI setup/init inputs, config persistence, validation, documentation, and focused tests. Confidence ranking implementation remains in later phases.

</domain>

<decisions>
## Implementation Decisions

### Setup Interface
- Expose repeatable `--label-patterns` setup/init parameters. One use sets one configured pattern; multiple uses set multiple configured patterns.
- Validate each regex by compiling it before saving, and fail with a clear setup error if any pattern is invalid.
- Persist the canonical config key as `labelPatterns`, while read compatibility remains for `labelPatterns`, `labelPattern`, and `labelRegex`.
- README/setup output should explain that pattern extraction changes which labels can be found, while confidence ranking is a separate scoring/reporting concern.

### Compatibility and Semantics
- Existing configs without configured label patterns continue using built-in defaults unchanged.
- JavaScript `labelExtractors` remain replacement-only and continue to replace the internal regex path.
- Setup writes `labelPatterns` going forward; alias compatibility remains read-side for older configs.
- Setup should state that configured patterns only define label matching, and confidence scoring is applied by import/report logic when available.

### Test and Documentation Scope
- Add setup tests for one `--label-patterns` value, multiple `--label-patterns` values, invalid regex rejection, and unchanged defaults.
- Keep extractor/report behavior narrow: verify persisted `labelPatterns` is consumed enough to prevent config drift; full confidence/report semantics belong to Phases 13-14.
- Update README setup/config sections and setup output/help text.
- No migration command is needed; maintain read compatibility for `labelPatterns`, `labelPattern`, and `labelRegex`, and write `labelPatterns` going forward.

### the agent's Discretion
Use existing CLI parsing, setup snapshot, and config helper patterns where possible. Keep the implementation focused on setup-time configuration rather than report semantics.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/cli.js` has the shared `parseFlags` helper and setup/init command routing.
- `src/setup.js` owns central config creation/upgrade through `ensureDataDirs()` and `setupSnapshot()`.
- `src/label-extractors.js` already reads `labelPatterns`, `labelPattern`, and `labelRegex` aliases.
- `test/setup.test.js` covers setup snapshot behavior and is the natural home for persistence tests.

### Established Patterns
- CLI commands accept flags and return either human-readable text or JSON.
- Setup writes private files into the central user-level data directory.
- Existing tests use temporary `COPILOT_METRICS_HOME` directories and inspect persisted config JSON.

### Integration Points
- `copilot-metrics init` and `copilot-metrics setup` should accept the repeatable `--label-patterns` flag.
- `setupSnapshot()` should receive parsed setup options and pass label pattern values into config persistence.
- README and CLI help should describe repeatable pattern usage and the separation from confidence ranking.

</code_context>

<specifics>
## Specific Ideas

Use `--label-patterns` as the user-facing flag and `labelPatterns` as the default target in config.

</specifics>

<deferred>
## Deferred Ideas

Confidence scoring, ranking, top-k label inclusion, and middle-detail reports are deferred to Phases 13 and 14.

</deferred>
