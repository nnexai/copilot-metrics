# Phase 4: Hardening and Release Readiness - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Make `copilot-metrics` ready as the first `0.1.0` npm release candidate: harden the local CLI workflow, validate a fresh setup/reporting path, prepare npm package metadata and files, document the current product state, add release notes, and validate the real Copilot CLI data collection flow locally without adding that integration to CI.

</domain>

<decisions>
## Implementation Decisions

### Hardening Scope
- Treat the current local CLI workflows as the release candidate path: fresh setup, fixture imports, reports, privacy defaults, and docs.
- Add npm-driven smoke verification that uses a temporary `COPILOT_METRICS_HOME`, imports fixtures, runs report assertions, and cleans up after itself.
- Copilot CLI integration is not a CI task. It is a manual local release validation flow because it depends on a real user environment and may call external services.
- Release docs must cover setup, sample import, reports, privacy defaults, billing caveats, known gaps, and next-step candidates.

### Publishing and Package Readiness
- Keep `0.1.0` as the first release candidate version and make the package publishable to npm by the end of Phase 4.
- Add or verify MIT `LICENSE`, npm `files` allowlist, `bin`, package metadata, README, changelog, and dry-run pack validation.
- README should describe the current tool, commands, privacy model, reporting, and publishing/install path. It should not read like a phase history.
- Add `CHANGELOG.md` with a single aggregated `0.1.0` entry for the first local CLI release.

### CI and Release Verification
- GitHub Actions should run install, `npm test`, `npm run check`, and package dry-run/pack verification without real Copilot CLI calls.
- The manual Copilot CLI validation should set up an example workspace, install and configure `copilot-metrics`, install the hooks and Copilot config for that workspace, run a simple prompt in the workspace, then validate that telemetry and hook data were collected and can be imported/reported.
- Publishing should remain gated by explicit human action. Configure package readiness and documented `npm publish` steps, but do not automatically publish from CI in this phase.
- Phase 4 summary/verification should record pack contents, tests/check results, smoke report output, and manual Copilot CLI validation status.

### the agent's Discretion
The agent may choose exact script names, README section structure, changelog wording, npm files allowlist, and manual validation script shape. Keep everything Node.js/npm based and avoid adding services or dashboards.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/PROJECT.md` — local-first goal, privacy constraints, billing caveats, and release value.
- `.planning/REQUIREMENTS.md` — Phase 4 verification requirements.
- `.planning/ROADMAP.md` — Phase 4 success criteria and verification focus.
- `.planning/STATE.md` — current workflow state.

### Prior Phase Artifacts
- `.planning/phases/01-project-foundation-and-local-setup/01-01-SUMMARY.md` — CLI/setup foundation.
- `.planning/phases/02-otel-ingestion-normalization-and-cost-model/02-01-SUMMARY.md` — ingestion, store, and cost model.
- `.planning/phases/03-jira-label-attribution-and-cli-querying/03-01-SUMMARY.md` — attribution and reports.
- `.planning/phases/03-jira-label-attribution-and-cli-querying/03-VERIFICATION.md` — latest verification baseline.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `package.json`: package metadata, scripts, bin, dependencies, and version.
- `bin/copilot-metrics.js`: npm bin entrypoint.
- `src/cli.js`: command surface for setup, hooks, store/import, pricing, and reports.
- `src/setup.js`: generated VS Code/Copilot CLI setup and hook config.
- `src/hook-logger.js`: hook event capture path.
- `test/*.test.js` and `test/fixtures/*.jsonl`: current automated test and smoke fixtures.
- `skills/copilot-metrics/SKILL.md`: package skill asset to include in npm files.

### Established Patterns
- CommonJS modules, no build step.
- npm scripts `test` and `check` are the verification surface.
- Local store and smoke flows should use temporary `COPILOT_METRICS_HOME` directories.
- Full prompt content remains disabled by default.

### Integration Points
- Add release/smoke scripts under `scripts/` or equivalent npm commands.
- Update package metadata/files so npm pack contains CLI, source, README, license, changelog, and skill assets, not local telemetry or planning artifacts.
- Update README and release checklist to match current behavior.
- Add or verify GitHub Actions workflow without adding real Copilot CLI calls.

</code_context>

<specifics>
## Specific Ideas

- Manual Copilot CLI release validation should create an example workspace, configure hooks and telemetry using this package, run one simple Copilot prompt, then verify JSONL data exists and imports into reports.
- Use neutral sample labels such as `DEMO-12345`.
- The `0.1.0` changelog entry should aggregate the release, not list internal phase chronology.

</specifics>

<deferred>
## Deferred Ideas

- Automated npm publish workflow can be added later if desired, but actual publish remains a human-gated action for this first release.
- Official GitHub reconciliation, collector mode, richer content capture, and dashboard work remain out of scope for `0.1.0`.

</deferred>

---

*Phase: 4-Hardening and Release Readiness*
*Context gathered: 2026-05-30*
