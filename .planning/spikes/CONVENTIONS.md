# Spike Conventions

Patterns and stack choices established across spike sessions. New spikes follow these unless the question requires otherwise.

## Stack

- Use Node.js scripts and npm package metadata for Copilot Metrics spikes.
- Keep prototype dependencies inside the spike directory unless the real implementation is being changed.

## Structure

- Store spike artifacts under `.planning/spikes/NNN-descriptive-name/`.
- Write machine-readable benchmark outputs next to the scripts that generated them.

## Patterns

- Use copied `COPILOT_METRICS_HOME` directories for performance experiments that run import or refresh paths.
- Keep user-facing product behavior unchanged during evaluation spikes; compare outputs and timings rather than editing runtime code.

## Tools & Libraries

- `better-sqlite3@12.10.0` worked in this Node 26 environment for local benchmarking.
- `sql.js@1.14.1` remains the current shipped backend and is the baseline for comparisons.
