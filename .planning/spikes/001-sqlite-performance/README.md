---
spike: 001
name: sqlite-performance
type: comparison
validates: "Given the current copied Copilot Metrics store and configured source set, when report and refresh-like paths are timed with sql.js and better-sqlite3, then we can estimate whether a backend swap materially improves latency without changing functionality."
verdict: VALIDATED
related: []
tags: [performance, sqlite, refresh, reports]
---

# Spike 001: SQLite Performance

## What This Validates

Given the current project shape, a copied user-level metrics store, and the configured fallback source set, when the real report commands and equivalent report SQL are benchmarked, then we can estimate how much of the latency comes from the current `sql.js` backend versus higher-level refresh/report work.

## Research

| Approach | Tool/Library | Pros | Cons | Status |
|---|---|---|---|---|
| Current backend | `sql.js@1.14.1` | Pure npm/WASM dependency, portable, already shipped. | Opens by reading the entire DB file into memory; write paths export and rewrite the entire DB file. Repeated helper calls reopen the database. | Baseline |
| Native SQLite backend | `better-sqlite3@12.10.0` | Synchronous Node API, real file-backed SQLite, supports prepared statements and transactions without whole-file export. Current package metadata supports Node 26. | Native addon install path, package install scripts, more platform/build risk than WASM. | Prototype |
| Query refactor only | Keep `sql.js` but avoid repeated opens and reduce all-evidence JS ranking work. | Preserves current dependency portability. | Still pays full DB load/export on writes; may not solve refresh mutation cost. | Follow-up candidate |

Chosen approach: benchmark the current CLI unchanged against a copied metrics home, then run report-query microbenchmarks against the copied SQLite file with `sql.js` and `better-sqlite3`.

## How to Run

```bash
cd .planning/spikes/001-sqlite-performance
npm install
npm run benchmark
npm run profile:refresh
npm run benchmark:writes
```

The scripts write `benchmark-results.json`, `refresh-profile.json`, and `write-benchmark-results.json` in this directory.

## What to Expect

- The script creates a temporary `COPILOT_METRICS_HOME` and copies the current config/store into it.
- CLI timings cover `report labels --json`, a warm repeat, `report label <top-label> --detail --session-detail --json`, and `report labels --refresh --json`.
- SQL microbenchmarks compare equivalent report queries using current `sql.js` open/query behavior and `better-sqlite3`.

## Observability

`benchmark-results.json` captures:

- source and copied benchmark homes
- store table counts before and after CLI runs
- command timing, status, stdout/stderr sizes
- per-query `sql.js` and `better-sqlite3` timings

## Investigation Trail

- Started from current store implementation in `src/sqlite-store.js`. The critical baseline behavior is that `openDatabase` reads the entire DB file for each open and mutating functions call `persistDatabase`, which exports and rewrites the full DB.
- Checked current `src/cli.js`: every `report` command calls `autoImportConfiguredSources`; `--refresh` makes checkpointed source files eligible for re-read when file stats changed.
- Checked label report path in `src/reports.js`: label overview/details read broad label evidence rowsets and recompute confidence rankings in JS at query time.
- Installed `better-sqlite3@12.10.0` inside this spike directory only, leaving project runtime dependencies unchanged.
- Ran `node benchmark.js` against a copied metrics home. The copied store was 59,060,224 bytes with 60,373 `raw_records`, 253 `usage_records`, 1,295 `label_evidence` rows, and 347 import checkpoints.
- Ran `node profile-refresh.js` against a fresh copied metrics home. The configured source set had 350 entries: 230 `vscode-chat`, 117 `copilot-session`, one `vscode`, one `hooks`, and one `copilot-cli`.
- Ran `node write-benchmark.js 350` to isolate the cost of many tiny checkpoint writes on a copied 57 MB store.

## Results

VALIDATED: performance can improve materially, but the biggest win is not just faster SELECT queries. The current `sql.js` helper pattern is expensive because it repeatedly loads and rewrites the full SQLite database file.

### End-to-End CLI Baseline

| Command | Time |
|---|---:|
| `report labels --json` | 3,410.73 ms |
| warm `report labels --json` | 3,313.93 ms |
| `report label ADR-019 --detail --session-detail --json` | 4,193.21 ms |
| `report labels --refresh --json` | 60,390.18 ms |

Normal reports are already seconds-level before rendering much output. Refresh is an order of magnitude slower.

### SQL Read Microbench

| Query | `sql.js` current pattern | `better-sqlite3` | Improvement |
|---|---:|---:|---:|
| label evidence + usage rows | 63.17 ms | 7.91 ms | 8.0x |
| manual label usage rows | 29.62 ms | 0.55 ms | 53.9x |
| label evidence rows | 38.44 ms | 1.40 ms | 27.5x |
| active manual labels | 25.30 ms | 0.03 ms | 843.3x |
| model report subset | 23.62 ms | 0.15 ms | 157.5x |

The absolute report-query savings here are tens of milliseconds per query, not multiple seconds by themselves. `better-sqlite3` still helps because report code opens the DB repeatedly, but report-level JS ranking and always-running auto-import also matter.

### Refresh Profile

`report labels --refresh --json` on a copied store took 59,259.86 ms in the profiler. Source breakdown:

| Source | Files | Duration | Raw records | Bytes scanned |
|---|---:|---:|---:|---:|
| `copilot-session` | 117 | 55,860.71 ms | 56,482 | 194,292,381 |
| `vscode-chat` | 230 | 1,972.31 ms | 0 | 437,748,027 |
| `vscode` | 1 | 903.49 ms | 2,798 | 16,230,020 |
| `hooks` | 1 | 215.38 ms | 137 | 50,690 |
| `copilot-cli` | 1 | 0.03 ms | 0 | 0 |

Refresh rereads all Copilot session-state records when forced. Those 117 files dominate wall time.

### Write Microbench

350 checkpoint upserts on a copied 57 MB store:

| Backend pattern | Time |
|---|---:|
| current exported `sql.js` helper | 46,341.27 ms |
| one `better-sqlite3` transaction | 1.38 ms |

This is the clearest signal. Refresh performs many small mutations: inserts, checkpoint upserts, duplicate repair, and final repair passes. With `sql.js`, each mutating helper can reload and export the whole database file. A file-backed SQLite backend with transactions should remove the repeated full-file rewrite cost.

### Recommended Build Direction

- Introduce a storage adapter boundary and port existing `sqlite-store.js` semantics to `better-sqlite3` behind the same public functions.
- Batch refresh work into one DB connection and transaction where possible, especially checkpoint updates.
- Keep report output and selected-pricing/label-ranking semantics unchanged; use current tests as contract tests.
- Preserve a portability decision explicitly: either make `better-sqlite3` the default with a documented native dependency, or keep `sql.js` as fallback if native install fails.
- After backend work, separately optimize report-level behavior: avoid auto-import work for unchanged source sets, reduce repeated ranking passes in label detail paths, and consider caching per-session confidence summaries.

### Caveats

- The prototype did not replace the production store layer, so the end-to-end projected speedup is inferred from equivalent reads/writes and refresh profiling rather than a full adapter implementation.
- `better-sqlite3` is a native addon. It advertised Node 26 support during the spike, but package install scripts and platform prebuild availability must be part of release validation.
