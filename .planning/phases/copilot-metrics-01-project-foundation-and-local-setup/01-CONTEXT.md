# Phase 1: Project Foundation and Local Setup - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Create the initial Node.js/npm project foundation for a local-first Copilot metrics toolkit: package scaffold, npm scripts, CLI entrypoint, central user-level data directory conventions, setup helpers for VS Code Insiders and Copilot CLI telemetry, and hook/logger installation or preview commands.

</domain>

<decisions>
## Implementation Decisions

### CLI and npm Surface
- **D-01:** Prefer a real CLI package that can be used after install and directly through `npx`, not only repo-local scripts.
- **D-02:** The same tool should cover setup tasks, hook installation/preview, and later data queries. Phase 1 should establish command shape that can grow into ingestion/query/report commands in later phases.
- **D-03:** npm scripts should remain available for development and verification, but the user-facing path should be the CLI.

### Hook Installation Scope
- **D-04:** Hook setup should support both project-local and user-global installation modes.
- **D-05:** Local hook mode should be suitable for repo-specific usage and safer previews. User-global hook mode should support broad attribution capture across repos.
- **D-06:** Commands should support preview/dry-run behavior before writing hook configuration or scripts.

### Data and Privacy Defaults
- **D-07:** Store app metadata and generated stores in a central user-level folder by default.
- **D-08:** Keep content capture disabled by default. Setup guidance must avoid storing full prompts unless the user explicitly opts in later.
- **D-09:** Hook attribution should capture safe metadata such as session ID, cwd, repo/branch hints, transcript path references, task hints, label candidates, and prompt preview only if explicitly allowed by future settings.

### LLM Skill Bonus
- **D-10:** If it fits cleanly into the foundation work, include an installable skill or skill template that tells LLM agents how to query the local Copilot metrics data.
- **D-11:** The skill should be treated as an optional bonus for this phase, not a blocker for the core CLI/setup foundation.

### the agent's Discretion
The user is leaving most implementation details to the agent. The agent may choose package layout, command names, argument shape, test runner, data directory helper design, and exact generated file formats, as long as the result is easy to run via npm scripts and plausible to publish/use through `npx`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/PROJECT.md` — project value, constraints, context, and key decisions.
- `.planning/REQUIREMENTS.md` — v1 requirements and traceability for Phase 1.
- `.planning/ROADMAP.md` — Phase 1 goal, deliverables, success criteria, and verification focus.
- `.planning/STATE.md` — current workflow state and user notes.

### Repo Guidance
- `AGENTS.md` — repo instructions, implementation direction, and verification expectations.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet. The repository currently contains planning artifacts and repo instructions, but no application scaffold.

### Established Patterns
- GSD planning artifacts are the source of truth for scope.
- Verification should be runnable through npm scripts once the scaffold exists.

### Integration Points
- New code will start at the repo root with `package.json`, CLI source files, setup helpers, hook logger assets, tests/fixtures as needed, and documentation.

</code_context>

<specifics>
## Specific Ideas

- The CLI should be usable through `npx` for setup and later for querying data.
- Hook setup should support local and user-global modes.
- Add a bonus installable skill, if practical, that lets LLMs know how to query the local metrics data.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. The skill is in scope as a bonus only; richer LLM workflows can be expanded later if needed.

</deferred>

---

*Phase: 1-Project Foundation and Local Setup*
*Context gathered: 2026-05-30*
