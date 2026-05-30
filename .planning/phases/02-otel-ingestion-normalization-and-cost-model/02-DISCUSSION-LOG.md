# Phase 2: OTel Ingestion, Normalization, and Cost Model - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 2-OTel Ingestion, Normalization, and Cost Model
**Areas discussed:** Local queryable store

---

## Local queryable store

| Option | Description | Selected |
|--------|-------------|----------|
| SQLite | Store imported raw and normalized telemetry in a local SQLite database. | ✓ |
| JSONL-derived normalized files first | Keep SQLite deferred and write normalized JSONL files. | |
| Agent discretion | Agent chooses based on repo fit. | |

**User's choice:** SQLite.
**Notes:** User left other implementation details to the agent.

## the agent's Discretion

- Schema, parser heuristics, pricing table shape, and command shape.

## Deferred Ideas

- Full label attribution and reporting are deferred to Phase 3.
