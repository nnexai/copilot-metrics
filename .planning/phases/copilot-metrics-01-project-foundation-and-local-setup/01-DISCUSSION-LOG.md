# Phase 1: Project Foundation and Local Setup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 1-Project Foundation and Local Setup
**Areas discussed:** CLI command shape, Hook installation scope, LLM skill bonus

---

## CLI command shape

| Option | Description | Selected |
|--------|-------------|----------|
| Installed or `npx` CLI | User-facing package can run setup and query commands via install or `npx`. | ✓ |
| npm scripts only | Repo-local scripts expose setup and future query actions. | |
| Agent discretion | Agent chooses exact command structure. | ✓ |

**User's choice:** Wants a tool usable through `npx` for hook setup and data queries, while leaving most exact design choices to the agent.
**Notes:** npm scripts still matter for development and verification.

---

## Hook installation scope

| Option | Description | Selected |
|--------|-------------|----------|
| Project-local hooks | Hooks configured for a specific repo/workspace. | ✓ |
| User-global hooks | Hooks configured once for the user across repos. | ✓ |
| Agent discretion | Agent chooses exact config/write/preview flow. | ✓ |

**User's choice:** Hooks should be installable either locally or user-globally.
**Notes:** Preview/dry-run behavior is expected where practical.

---

## LLM skill bonus

| Option | Description | Selected |
|--------|-------------|----------|
| Include installable skill | Add a skill or skill template with instructions for LLMs to query metrics. | ✓ |
| Defer skill | Leave LLM skill packaging for a later phase. | |
| Agent discretion | Include if it fits the foundation phase. | ✓ |

**User's choice:** An installable skill for LLM querying would be a useful bonus.
**Notes:** This is not a blocker for the core CLI/setup foundation.

## the agent's Discretion

- Package layout, command names, test runner, data directory helper implementation, generated file shape, and exact hook logger format.

## Deferred Ideas

None.
