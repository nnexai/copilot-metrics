# Phase 17: File-Backed SQLite Storage - Research

**Researched:** 2026-06-10  
**Domain:** Node.js CLI local SQLite storage migration  
**Confidence:** HIGH

## User Constraints

No phase CONTEXT.md exists for Phase 17. [VERIFIED: init.phase-op]

### Locked Decisions
None beyond ROADMAP/REQUIREMENTS/AGENTS.md. [VERIFIED: codebase grep]

### the agent's Discretion
Adapter shape, exact transaction boundaries, and verification fixture layout are implementation discretion as long as PERF-01 through PERF-04 are satisfied. [VERIFIED: .planning/REQUIREMENTS.md]

### Deferred Ideas (OUT OF SCOPE)
Phase 18 refresh batching requirements PERF-05 through PERF-08 and Phase 19 report optimization requirements PERF-09 through PERF-14 are out of scope for Phase 17. [VERIFIED: .planning/ROADMAP.md]

## Project Constraints (from AGENTS.md)

- Use Node.js and npm scripts. [VERIFIED: AGENTS.md]
- Store app metadata locally in a central user-level folder by default. [VERIFIED: AGENTS.md]
- Prioritize easy-to-install CLI tools, scripts, and hooks over dashboard work. [VERIFIED: AGENTS.md]
- Treat Jira ticket IDs such as `DEMO-12345` as the primary label format. [VERIFIED: AGENTS.md]
- Extract labels from prompts, directories, branches, hooks, and tool-call context when available. [VERIFIED: AGENTS.md]
- Provide human-readable and machine-readable output for query/report commands. [VERIFIED: AGENTS.md]
- Prefer local JSONL ingestion and local storage before adding services. [VERIFIED: AGENTS.md]
- Treat Copilot cost numbers as estimates, not official billing. [VERIFIED: AGENTS.md]
- Keep content capture disabled by default and avoid storing full prompts unless explicitly requested. [VERIFIED: AGENTS.md]
- Keep verification runnable through npm scripts, with fixture-based tests for telemetry parsing, span classification, cost estimation, attribution, and reports. [VERIFIED: AGENTS.md]

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERF-01 | Existing setup, import, label, and report commands use a file-backed SQLite store without command/output changes. [VERIFIED: .planning/REQUIREMENTS.md] | Keep public `src/sqlite-store.js` exports stable and preserve `async` call shape while replacing internals. [VERIFIED: codebase grep] |
| PERF-02 | Preserve schema, migrations, dedupe constraints, checkpoints, manual labels, selected pricing fields, diagnostics, and warning rows. [VERIFIED: .planning/REQUIREMENTS.md] | Port current `initStore`, repair helpers, unique indexes, JSON fields, manual label table, `import_checkpoints`, and `import_warnings` behavior exactly. [VERIFIED: src/sqlite-store.js] |
| PERF-03 | Use shared database connections and explicit transactions for multi-step import/refresh work. [VERIFIED: .planning/REQUIREMENTS.md] | Add connection-aware helper variants so import, checkpoint updates, duplicate repair, selected-pricing repair, and report read batches avoid repeated open/export cycles. [VERIFIED: src/cli.js; src/ingest.js; src/sqlite-store.js] |
| PERF-04 | If `better-sqlite3` is adopted as default, validate native dependency install and local/external CLI/package workflows on supported Node versions. [VERIFIED: .planning/REQUIREMENTS.md] | `better-sqlite3@12.10.0` supports Node `20.x || 22.x || 23.x || 24.x || 25.x || 26.x`, has an install script, and loaded successfully in an isolated Node 26 smoke. [VERIFIED: npm registry; local smoke] |

</phase_requirements>

## Summary

Phase 17 should replace the current `sql.js` full-file load/export storage mechanics with `better-sqlite3@12.10.0` as the default file-backed SQLite engine while preserving the existing `src/sqlite-store.js` API and CLI behavior. [VERIFIED: npm registry] [VERIFIED: src/sqlite-store.js] The current store module exports async helpers used throughout setup, import, label, repair, and report paths; callers should not need command syntax or output changes. [VERIFIED: codebase grep]

Prior spike evidence shows the primary Phase 17 performance win is eliminating repeated full database rewrites on tiny mutations: 350 checkpoint upserts took 46,341.27 ms with the current `sql.js` helper pattern and 1.38 ms in one `better-sqlite3` transaction on a copied 57-59 MB store. [VERIFIED: .planning/spikes/001-sqlite-performance/write-benchmark-results.json] Normal report query microbenchmarks also improved, but only by tens of milliseconds per query; Phase 18 and Phase 19 should own unchanged-source refresh avoidance and report ranking/query optimization. [VERIFIED: .planning/spikes/001-sqlite-performance/README.md]

**Primary recommendation:** Use `better-sqlite3@12.10.0` behind the existing store facade, introduce connection/transaction-aware internal primitives, and keep Phase 17 verification centered on behavior equivalence plus package/native-addon viability. [VERIFIED: npm registry] [VERIFIED: codebase grep]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| File-backed SQLite connection lifecycle | CLI / local storage module | Filesystem | The CLI owns local store access at `paths.usageDb`; the filesystem only stores the `.sqlite`, `-wal`, and `-shm` files. [VERIFIED: src/paths.js; src/sqlite-store.js] |
| Schema initialization and migrations | Storage module | CLI commands | Commands call `initStore`; schema ownership belongs in storage internals so setup, import, label, and report paths share one contract. [VERIFIED: src/sqlite-store.js; src/cli.js] |
| Import/checkpoint mutation transactions | Storage module | Ingest orchestration | Ingest decides what records to import; storage should own atomic inserts, checkpoint upserts, warning rows, and repair helpers. [VERIFIED: src/ingest.js; src/sqlite-store.js] |
| Manual label mutations | Storage module | CLI label command | The CLI validates user intent and session existence; storage owns `manual_label_assignments` mutation consistency. [VERIFIED: src/cli.js; src/sqlite-store.js] |
| Report reads | Reports module | Storage query facade | Reports should continue using `queryRows`/`queryOne` or connection-aware equivalents without changing report semantics. [VERIFIED: src/reports.js; src/sqlite-store.js] |
| Native dependency validation | Packaging scripts | npm registry / external npx | The repo already validates pack contents with npm scripts; Phase 17 must extend validation to prove native addon install/load in local and neutral-directory package flows. [VERIFIED: scripts/verify-package.js; npm registry] |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `better-sqlite3` | 12.10.0, modified 2026-05-12, created 2016-09-07. [VERIFIED: npm registry] | Native file-backed SQLite binding for Node.js CLI storage. [CITED: github.com/WiseLibs/better-sqlite3] | Official docs support synchronous `Database`, prepared statements, transactions, and WAL pragmas; spike benchmarks show the transaction/write path addresses the current bottleneck. [CITED: github.com/WiseLibs/better-sqlite3/docs/api.md] [VERIFIED: spike] |
| Node.js | >=20 per project; current environment v26.0.0. [VERIFIED: package.json; local env] | Runtime for CLI and tests. | `better-sqlite3@12.10.0` declares Node support for 20/22/23/24/25/26. [VERIFIED: npm registry] |
| npm | current environment 11.16.0. [VERIFIED: local env] | Dependency install, package validation, `npx` smoke. | Existing project scripts use npm, and AGENTS.md requires npm-script verification. [VERIFIED: package.json; AGENTS.md] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sql.js` | 1.14.1, modified 2026-03-04, created 2014-05-24. [VERIFIED: npm registry] | Existing pure-WASM SQLite implementation. | Keep only if planner chooses a temporary compatibility/fallback period; Phase 17 goal is replacement of repeated load/export behavior. [VERIFIED: package.json; ROADMAP.md] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `better-sqlite3` | Keep `sql.js` with fewer opens | Avoids native-addon install risk, but still requires full-file export for writes unless storage mechanics are redesigned around one long-lived in-memory DB. [VERIFIED: src/sqlite-store.js] |
| `better-sqlite3` | `sqlite3` async binding | Adds async callback/promise surface not aligned with current synchronous local CLI workload; official `better-sqlite3` docs position its synchronous API and transactions as the simpler fit for serialized SQLite work. [CITED: github.com/WiseLibs/better-sqlite3] |

**Installation:**

```bash
npm install better-sqlite3@12.10.0
```

**Version verification:**

```bash
npm view better-sqlite3 version time.modified time.created repository.url engines dependencies scripts.install
npm view sql.js version time.modified time.created repository.url
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `better-sqlite3` [VERIFIED: npm registry] | npm | Created 2016-09-07; latest 12.10.0 modified 2026-05-12. [VERIFIED: npm registry] | 6,869,585/week for 2026-05-27 through 2026-06-02. [VERIFIED: npm downloads API] | `github.com/WiseLibs/better-sqlite3`. [VERIFIED: npm registry] | OK. [VERIFIED: slopcheck] | Approved, with native install validation required. |
| `sql.js` [VERIFIED: npm registry] | npm | Created 2014-05-24; latest 1.14.1 modified 2026-03-04. [VERIFIED: npm registry] | 1,407,154/week for 2026-05-27 through 2026-06-02. [VERIFIED: npm downloads API] | `github.com/sql-js/sql.js`. [VERIFIED: npm registry] | OK. [VERIFIED: slopcheck] | Existing dependency; remove only after migration tests and package validation pass. |

**Packages removed due to slopcheck [SLOP] verdict:** none. [VERIFIED: slopcheck]  
**Packages flagged as suspicious [SUS]:** none. [VERIFIED: slopcheck]

Package risk note: `better-sqlite3` has an install script `prebuild-install || node-gyp rebuild --release`; this is expected for its native addon but must be validated in CI/package smoke and external `npx` flows. [VERIFIED: npm registry] `prebuild-install@7.1.3` emitted an npm deprecation warning during local slopcheck install, so the planner should include an install-output audit checkpoint before release. [VERIFIED: local slopcheck]

## Architecture Patterns

### System Architecture Diagram

```text
CLI command
  |
  v
withStoreLock(paths.usageDb)
  |
  +--> setup/store init --------+
  |                             |
  +--> import/refresh ----------+--> Store facade (existing async exports)
  |                             |       |
  +--> label mutation ----------+       +--> open better-sqlite3 Database(dbPath)
  |                             |       +--> init schema / migrations / indexes
  +--> report auto-import ------+       +--> run transaction for mutations
        |                       |       +--> run prepared SELECTs for reports
        v                       |
    report queries <------------+
        |
        v
human / JSON output with unchanged semantics
```

### Recommended Project Structure

```text
src/
├── sqlite-store.js              # Public async facade retained for callers. [VERIFIED: codebase grep]
├── sqlite-better-store.js       # better-sqlite3 implementation internals. [ASSUMED]
├── ingest.js                    # Import orchestration; should pass shared store/connection where needed. [VERIFIED: codebase grep]
├── reports.js                   # Read-only report semantics; may use connection-aware query helpers. [VERIFIED: codebase grep]
└── paths.js                     # Existing central user-level store path resolution. [VERIFIED: codebase grep]
```

### Pattern 1: Keep Public Store API Stable

**What:** Preserve exported async functions from `src/sqlite-store.js`: `initStore`, `insertImport`, `queryRows`, `queryOne`, checkpoint helpers, repair helpers, manual-label helpers, and selected-pricing repair helpers. [VERIFIED: src/sqlite-store.js]

**When to use:** Use this for the first migration slice so setup/import/report tests can run unchanged against the new backend. [VERIFIED: test suite]

**Example:**

```js
// Source: https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md
const Database = require('better-sqlite3');

async function queryRows(dbPath, sql, params = []) {
  await initStore(dbPath);
  const db = new Database(dbPath, { fileMustExist: true });
  try {
    return db.prepare(sql).all(params);
  } finally {
    db.close();
  }
}
```

### Pattern 2: Connection-Aware Mutation Blocks

**What:** Add internal helpers that accept an existing `Database` connection, then expose higher-level `withStore(dbPath, fn)` / `withStoreTransaction(dbPath, fn)` wrappers to reuse the connection across multi-step operations. [ASSUMED]

**When to use:** Use for `insertImport`, `upsertImportCheckpoint`, duplicate repair, VS Code response-id backfill, cost-estimate repair, and manual-label mutations. [VERIFIED: src/sqlite-store.js; src/ingest.js]

**Example:**

```js
// Source: https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md
function withStoreTransaction(dbPath, fn) {
  const db = openStore(dbPath);
  try {
    const run = db.transaction(() => fn(db));
    return run();
  } finally {
    db.close();
  }
}
```

### Pattern 3: Use `better-sqlite3` Transactions Only Around Synchronous Work

**What:** `better-sqlite3` transaction functions commit when the wrapped function returns, and official docs warn that transaction functions do not work with async functions. [CITED: github.com/WiseLibs/better-sqlite3/docs/api.md]

**When to use:** Parse JSONL and do filesystem reads before opening the transaction, then execute synchronous DB writes inside the transaction. [VERIFIED: src/ingest.js] [CITED: github.com/WiseLibs/better-sqlite3/docs/api.md]

### Pattern 4: WAL Mode with Explicit Durability Decision

**What:** Official docs recommend `db.pragma('journal_mode = WAL')` for performance, while noting WAL defaults to `synchronous=NORMAL` in this distribution and can be overridden with `synchronous=FULL`. [CITED: github.com/WiseLibs/better-sqlite3/docs/performance.md]

**When to use:** Enable WAL during connection initialization if package validation accounts for `.sqlite-wal` and `.sqlite-shm` files and the team accepts NORMAL durability; otherwise set `synchronous = FULL` after WAL. [CITED: github.com/WiseLibs/better-sqlite3/docs/performance.md] [ASSUMED]

### Anti-Patterns to Avoid

- **Async work inside transaction wrapper:** The transaction can commit before awaited work resumes. [CITED: github.com/WiseLibs/better-sqlite3/docs/api.md]
- **Mixing raw `BEGIN`/`COMMIT` with `db.transaction()`:** Official docs say manual transaction statements should not be mixed with transaction-managed functions. [CITED: github.com/WiseLibs/better-sqlite3/docs/api.md]
- **Changing report semantics while swapping storage:** Phase 17 is storage mechanics only; label ranking/report optimization belongs to Phase 19. [VERIFIED: .planning/ROADMAP.md]
- **Treating native install as proven by local tests only:** PERF-04 requires local CLI/package and external `npx` validation because the new dependency has native install behavior. [VERIFIED: .planning/REQUIREMENTS.md; npm registry]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQLite file persistence | Custom export/rename lifecycle | `better-sqlite3` file-backed `Database` | The current export lifecycle is the bottleneck; SQLite already handles file-backed persistence. [VERIFIED: spike; src/sqlite-store.js] |
| Transactions/savepoints | Custom transaction stack | `db.transaction()` for synchronous mutation blocks | Official docs provide commit/rollback behavior and nested savepoints. [CITED: github.com/WiseLibs/better-sqlite3/docs/api.md] |
| PRAGMA execution | Raw SELECT-style PRAGMA parsing | `db.pragma()` | Official docs say this normalizes odd PRAGMA behavior. [CITED: github.com/WiseLibs/better-sqlite3/docs/api.md] |
| Native-addon install detection | Ad hoc file checks | `npm install`, `npm pack --dry-run --silent --json`, local CLI smoke, neutral-directory `npx` smoke | PERF-04 is about real install/use through package workflows. [VERIFIED: .planning/REQUIREMENTS.md; scripts/verify-package.js] |

**Key insight:** The win is not inventing a new storage model; it is letting SQLite own the file while preserving the existing local-first CLI contract. [VERIFIED: spike]

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Existing user stores live at central `paths.usageDb` under the Copilot Metrics home; schema tables include `raw_records`, `usage_records`, `hook_events`, `label_evidence`, `manual_label_assignments`, `import_warnings`, and `import_checkpoints`. [VERIFIED: src/paths.js; src/sqlite-store.js] | Code edit only if file format remains SQLite; run copied-store compatibility tests before touching real user stores. [ASSUMED] |
| Live service config | None found; project stores config in local JSON files and local telemetry/session JSONL sources, not a remote service. [VERIFIED: AGENTS.md; src/setup.js] | None. |
| OS-registered state | Hook setup may write local/global Copilot hook files with command paths, but Phase 17 does not rename command paths or hook names. [VERIFIED: src/setup.js; test/setup.test.js] | None for storage backend swap. |
| Secrets/env vars | `COPILOT_METRICS_HOME`, `COPILOT_HOME`, `HOME`, and `USERPROFILE` affect paths; no secret key rename is in scope. [VERIFIED: test/setup.test.js; src/paths.js] | Preserve env override semantics. |
| Build artifacts | `node_modules/better-sqlite3` native binary and package tarball metadata will be generated during install/package validation; SQLite WAL/SHM sidecars may appear if WAL is enabled. [VERIFIED: npm registry; local smoke] | Update package verification forbidden patterns to tolerate or exclude `.sqlite-wal`/`.sqlite-shm`; ensure no DB artifacts are packed. [VERIFIED: scripts/verify-package.js] |

## Common Pitfalls

### Pitfall 1: Losing Async API Compatibility

**What goes wrong:** Callers currently `await` store helpers; changing them to sync-only APIs can ripple through CLI, ingest, and report code. [VERIFIED: codebase grep]  
**Why it happens:** `better-sqlite3` is synchronous while the existing `sql.js` initialization path is async. [CITED: github.com/WiseLibs/better-sqlite3; src/sqlite-store.js]  
**How to avoid:** Keep exported helpers async and hide synchronous internals behind the facade. [ASSUMED]  
**Warning signs:** Large diffs in `src/cli.js`, `src/ingest.js`, and `src/reports.js` unrelated to connection passing. [ASSUMED]

### Pitfall 2: Transaction Wrapper Around Awaited Work

**What goes wrong:** DB work after an `await` runs after the transaction has committed. [CITED: github.com/WiseLibs/better-sqlite3/docs/api.md]  
**Why it happens:** Official docs state transaction functions do not work with async functions. [CITED: github.com/WiseLibs/better-sqlite3/docs/api.md]  
**How to avoid:** Complete file discovery/parsing before transaction entry; keep transaction callbacks synchronous. [VERIFIED: src/ingest.js]  
**Warning signs:** `db.transaction(async (...) => ...)` or `await` inside a transaction callback. [ASSUMED]

### Pitfall 3: Native Dependency Works Locally but Fails for Users

**What goes wrong:** Install falls back to `node-gyp` when prebuilds are unavailable; user systems may lack build tools. [VERIFIED: npm registry] [CITED: github.com/WiseLibs/better-sqlite3/docs/troubleshooting.md]  
**Why it happens:** The package install script is `prebuild-install || node-gyp rebuild --release`. [VERIFIED: npm registry]  
**How to avoid:** Add local clean-install smoke, packed-tarball install smoke, and neutral-directory `npx` smoke; document supported Node versions. [VERIFIED: .planning/REQUIREMENTS.md]  
**Warning signs:** npm install output mentions `node-gyp rebuild`, Python/Visual Studio errors, or missing native binding. [CITED: github.com/WiseLibs/better-sqlite3/docs/troubleshooting.md]

### Pitfall 4: WAL Sidecar Files Surprise Package/Artifact Checks

**What goes wrong:** `.sqlite-wal` and `.sqlite-shm` files appear and are accidentally packed, copied, or treated as dirty artifacts. [CITED: github.com/WiseLibs/better-sqlite3/docs/performance.md] [ASSUMED]  
**Why it happens:** WAL mode uses sidecar files. [CITED: sqlite.org/wal.html]  
**How to avoid:** Keep pack verification blocking `*.sqlite`, `*.sqlite-wal`, and `*.sqlite-shm`; run package checks after WAL smoke. [VERIFIED: scripts/verify-package.js]  
**Warning signs:** `npm pack --dry-run --silent --json` includes store files. [VERIFIED: scripts/verify-package.js]

### Pitfall 5: Absorbing Phase 18/19 Work

**What goes wrong:** Planner folds refresh source skipping or report ranking cache work into the storage migration. [VERIFIED: .planning/ROADMAP.md]  
**Why it happens:** Spike showed report/refresh slowness has multiple causes. [VERIFIED: spike]  
**How to avoid:** Land backend replacement first, then benchmark. [VERIFIED: spike]  
**Warning signs:** Plan tasks rewrite label ranking, auto-import discovery, or report SQL beyond what is required for store API compatibility. [ASSUMED]

## Code Examples

### Open File-Backed Store

```js
// Source: https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md
const Database = require('better-sqlite3');

function openStore(dbPath) {
  const db = new Database(dbPath, { timeout: 5000 });
  db.pragma('journal_mode = WAL');
  return db;
}
```

### Synchronous Transaction

```js
// Source: https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md
const insertImportRows = db.transaction((rows) => {
  const stmt = db.prepare('INSERT INTO import_warnings (imported_at, source, line, code, message) VALUES (?, ?, ?, ?, ?)');
  for (const row of rows) {
    stmt.run(row.imported_at, row.source, row.line, row.code, row.message);
  }
});
```

### Parameterized Query Helper

```js
// Source: https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md
function all(db, sql, params = []) {
  return db.prepare(sql).all(params);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `sql.js` opens by reading the whole DB file and persists by `db.export()` then atomic rename. [VERIFIED: src/sqlite-store.js] | File-backed `better-sqlite3` connection with prepared statements and transactions. [CITED: github.com/WiseLibs/better-sqlite3/docs/api.md] | Phase 17 planned for v0.6.0 after spike on 2026-06-09. [VERIFIED: .planning/STATE.md; spike] | Removes repeated full-file rewrite cost while preserving SQLite file format. [VERIFIED: spike] |
| Per-helper mutations each open/export/close. [VERIFIED: src/sqlite-store.js] | Multi-step mutation paths share one connection and transaction. [VERIFIED: .planning/REQUIREMENTS.md] | Phase 17. | Checkpoint/write microbench suggests orders-of-magnitude improvement for small write batches. [VERIFIED: spike] |

**Deprecated/outdated:**
- Treating `sql.js` portability as the overriding storage decision is outdated for v0.6.0 performance work; the spike validated `better-sqlite3` as the leading storage direction while preserving local-first behavior. [VERIFIED: memory; spike]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A separate `src/sqlite-better-store.js` file is the cleanest implementation split. | Recommended Project Structure | Low; planner can keep one file if diff is smaller. |
| A2 | Planner should keep exported helpers async even if internals are sync. | Pitfalls | Medium; changing call shape may expand implementation and test surface. |
| A3 | WAL should be enabled if package/artifact validation is adjusted and durability tradeoff is accepted. | Architecture Patterns | Medium; durability expectations may require `synchronous=FULL` or no WAL. |
| A4 | No runtime data migration is needed if the existing `.sqlite` file remains compatible. | Runtime State Inventory | Medium; old stores with odd schema drift must still be tested via copied stores. |

## Open Questions

1. **Should WAL use default NORMAL durability or set `synchronous = FULL`?**
   - What we know: Official docs recommend WAL for performance and document the NORMAL durability tradeoff. [CITED: github.com/WiseLibs/better-sqlite3/docs/performance.md]
   - What's unclear: Product tolerance for the small durability tradeoff in a local telemetry cache. [ASSUMED]
   - Recommendation: Start with WAL plus `synchronous = FULL` if benchmark impact is acceptable; otherwise document NORMAL explicitly. [ASSUMED]

2. **Should `sql.js` remain as a fallback for one release?**
   - What we know: `sql.js` is the current dependency and package-portable baseline. [VERIFIED: package.json]
   - What's unclear: Whether native install failures should have fallback behavior or fail with a clear installation diagnostic. [ASSUMED]
   - Recommendation: Do not build fallback unless package validation finds real install risk; fallback doubles storage test matrix. [ASSUMED]

3. **Which external `npx` version should release validation target?**
   - What we know: Current package is 0.5.2 and Phase 17 will likely ship in v0.6.0. [VERIFIED: package.json; .planning/ROADMAP.md]
   - What's unclear: Exact post-merge versioning/release flow for this phase. [ASSUMED]
   - Recommendation: Planner should include neutral-directory validation against packed tarball during phase and `npx -y copilot-metrics@<release>` during release. [VERIFIED: scripts/verify-package.js] [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Runtime/tests/native addon | ✓ | v26.0.0 [VERIFIED: local env] | Project supports Node >=20; package supports 20/22/23/24/25/26. [VERIFIED: package.json; npm registry] |
| npm | Install/package/npx validation | ✓ | 11.16.0 [VERIFIED: local env] | None needed. |
| `better-sqlite3` native addon | File-backed storage | ✓ in isolated `/tmp` smoke | 12.10.0 [VERIFIED: local smoke] | Keep `sql.js` fallback only if install validation fails. [ASSUMED] |
| `slopcheck` | Package legitimacy gate | ✓ | 0.6.1 installed during research. [VERIFIED: local env] | If unavailable later, gate install behind human verification. |
| Graphify | Semantic graph context | ✗ | disabled. [VERIFIED: graphify status] | Use codebase grep and planning docs. |

**Missing dependencies with no fallback:** none found. [VERIFIED: local env]  
**Missing dependencies with fallback:** graphify disabled; codebase grep used instead. [VERIFIED: graphify status]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node built-in `node:test`. [VERIFIED: package.json; test run] |
| Config file | none; tests discovered by `node --test`. [VERIFIED: package.json] |
| Quick run command | `npm test` (87 passing tests in 22.5s on 2026-06-10). [VERIFIED: local test run] |
| Full suite command | `npm test && npm run check && npm run verify:package`. [VERIFIED: package.json] |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-01 | Setup/import/label/report commands preserve syntax and JSON/human output. | integration | `npm test` | ✅ existing `test/setup.test.js`, `test/ingest.test.js`, `test/report.test.js` [VERIFIED: test files] |
| PERF-02 | Schema/migrations/constraints/checkpoints/manual labels/selected pricing/diagnostics persist equivalently. | unit/integration | `node --test test/ingest.test.js test/report.test.js` | ✅ partial existing; ❌ explicit backend equivalence fixture missing. [VERIFIED: test files] |
| PERF-03 | Multi-step mutations use shared connections and transactions. | unit/benchmark/static review | `node --test test/storage-backend.test.js` | ❌ Wave 0 gap. |
| PERF-04 | Native dependency installs and works via local CLI/package/npx workflows. | package smoke | `npm run verify:package` plus packed-tarball install smoke | ✅ package verifier exists; ❌ native dependency smoke missing. [VERIFIED: scripts/verify-package.js] |

### Sampling Rate

- **Per task commit:** `npm test` and `npm run check`. [VERIFIED: package.json]
- **Per wave merge:** `npm test && npm run check && npm run verify:package`. [VERIFIED: package.json]
- **Phase gate:** Full suite plus isolated `npm install`/`node -e "require('better-sqlite3')"` smoke from a neutral temp directory and copied-store benchmark comparison. [VERIFIED: local smoke; spike]

### Wave 0 Gaps

- [ ] `test/storage-backend.test.js` - backend equivalence for schema init, existing-store migration, constraints, checkpoint persistence, manual labels, selected pricing, diagnostics, and warnings. [ASSUMED]
- [ ] `scripts/verify-native-sqlite-package.js` - install packed tarball in temp dir, run `copilot-metrics store init`, import fixture, label session, run report JSON. [ASSUMED]
- [ ] `scripts/benchmark-storage.js` or reuse spike write benchmark - compare checkpoint/write workload before/after on copied stores. [VERIFIED: spike]
- [ ] Update `scripts/verify-package.js` required/forbidden expectations if WAL sidecars appear during package smoke. [VERIFIED: scripts/verify-package.js]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Local CLI has no auth surface in this phase. [VERIFIED: AGENTS.md; src/cli.js] |
| V3 Session Management | no | Copilot session IDs are imported attribution data, not application sessions. [VERIFIED: src/ingest.js; src/reports.js] |
| V4 Access Control | partial | Preserve local file permissions and central user-level data path; current `sql.js` persist writes mode `0600`. [VERIFIED: src/sqlite-store.js] |
| V5 Input Validation | yes | Continue parameterized SQL and existing label/session normalization. [VERIFIED: src/sqlite-store.js; src/cli.js] |
| V6 Cryptography | no | No encryption/crypto change in phase. [VERIFIED: phase scope] |

### Known Threat Patterns for Node CLI + SQLite

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection through labels/session IDs/file paths | Tampering | Use prepared statements with bound parameters; do not interpolate user values into SQL. [VERIFIED: src/sqlite-store.js] [CITED: github.com/WiseLibs/better-sqlite3/docs/api.md] |
| Local data disclosure through store permissions | Information Disclosure | Create store directories with `0700` and DB files with owner-only access where possible; verify file mode after migrating away from explicit export writes. [VERIFIED: src/sqlite-store.js] |
| Native dependency supply-chain/install script risk | Elevation of Privilege | Pin version, run slopcheck, inspect install scripts, verify package source, and validate install in isolated temp directories. [VERIFIED: npm registry; slopcheck] |
| Prompt/content overcapture during import tests | Information Disclosure | Keep content capture disabled by default and fixture-based tests free of full prompts. [VERIFIED: AGENTS.md; test/setup.test.js] |

## Sources

### Primary (HIGH confidence)

- `.planning/REQUIREMENTS.md` - PERF-01 through PERF-04 scope and requirement mapping. [VERIFIED: codebase grep]
- `.planning/ROADMAP.md` - Phase 17/18/19 boundaries and success criteria. [VERIFIED: codebase grep]
- `.planning/PROJECT.md` and `.planning/STATE.md` - v0.6.0 storage direction and phase status. [VERIFIED: codebase grep]
- `AGENTS.md` - project constraints. [VERIFIED: codebase grep]
- `.planning/spikes/001-sqlite-performance/README.md`, `benchmark-results.json`, `write-benchmark-results.json` - performance evidence. [VERIFIED: local files]
- `src/sqlite-store.js`, `src/cli.js`, `src/ingest.js`, `src/reports.js`, `src/paths.js` - current store API and call paths. [VERIFIED: codebase grep]
- `package.json`, `scripts/verify-package.js`, `test/*.test.js` - scripts, packaging, and validation baseline. [VERIFIED: local files]
- npm registry metadata for `better-sqlite3@12.10.0` and `sql.js@1.14.1`. [VERIFIED: npm registry]
- Slopcheck 0.6.1 result for `better-sqlite3` and `sql.js`: OK. [VERIFIED: slopcheck]

### Secondary (MEDIUM confidence)

- `https://github.com/WiseLibs/better-sqlite3` - official README for install, usage, WAL recommendation, release version. [CITED: github.com/WiseLibs/better-sqlite3]
- `https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md` - official API docs for `Database`, `prepare`, `transaction`, `pragma`, transaction caveats. [CITED: github.com/WiseLibs/better-sqlite3/docs/api.md]
- `https://github.com/WiseLibs/better-sqlite3/blob/master/docs/performance.md` - official WAL and durability notes. [CITED: github.com/WiseLibs/better-sqlite3/docs/performance.md]
- `https://github.com/WiseLibs/better-sqlite3/blob/master/docs/troubleshooting.md` - official native install troubleshooting. [CITED: github.com/WiseLibs/better-sqlite3/docs/troubleshooting.md]

### Tertiary (LOW confidence)

- Memory note that v0.6.0 direction is file-backed SQLite after spike; verified against local planning and spike files before use. [VERIFIED: memory; local files]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - npm registry, official docs, slopcheck, isolated native-addon smoke, and local spike agree. [VERIFIED: npm registry; slopcheck; local smoke; spike]
- Architecture: HIGH - current store API/callers are directly visible and phase scope is narrow. [VERIFIED: codebase grep]
- Pitfalls: MEDIUM - native packaging risks are documented, but cross-platform install behavior still needs release validation. [CITED: github.com/WiseLibs/better-sqlite3/docs/troubleshooting.md]

**Research date:** 2026-06-10  
**Valid until:** 2026-07-10 for stack/package metadata; recheck npm metadata before release. [ASSUMED]
