# Spike Manifest

## Idea

Evaluate whether Copilot Metrics refresh and report-detail performance can improve without changing product functionality, with particular focus on replacing the current `sql.js` SQLite backend with `better-sqlite3` and identifying any non-database bottlenecks in the current flow.

## Requirements

- Do not change user-facing report semantics or attribution behavior during the spike.
- Benchmark against a copied metrics home so local user-level store data is not rewritten by experiments.
- Keep results grounded in the current Node.js/npm CLI architecture.

## Spikes

| # | Name | Type | Validates | Verdict | Tags |
|---|------|------|-----------|---------|------|
| 001 | sqlite-performance | comparison | Given the current copied Copilot Metrics store and configured source set, when report and refresh-like paths are timed with `sql.js` and `better-sqlite3`, then we can estimate whether a backend swap materially improves latency without changing functionality. | VALIDATED | performance, sqlite, refresh, reports |
