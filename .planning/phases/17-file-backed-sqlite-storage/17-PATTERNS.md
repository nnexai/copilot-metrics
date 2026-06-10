# Phase 17: File-Backed SQLite Storage - Pattern Map

**Mapped:** 2026-06-10
**Files analyzed:** 11
**Analogs found:** 11 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/sqlite-store.js` | service | CRUD / file-I/O | `src/sqlite-store.js` | exact |
| `src/sqlite-better-store.js` | service | CRUD / file-I/O | `src/sqlite-store.js` + spike `write-benchmark.js` | role-match |
| `src/ingest.js` | service | batch / file-I/O | `src/ingest.js` | exact |
| `src/reports.js` | service | request-response / CRUD reads | `src/reports.js` | exact |
| `src/cli.js` | controller | request-response | `src/cli.js` | exact |
| `package.json` | config | package metadata | `package.json` | exact |
| `package-lock.json` | config | package metadata | `.planning/spikes/001-sqlite-performance/package-lock.json` | role-match |
| `test/storage-backend.test.js` | test | CRUD / file-I/O | `test/ingest.test.js` + `test/report.test.js` | role-match |
| `scripts/verify-native-sqlite-package.js` | utility | batch / package smoke | `scripts/verify-package.js` | role-match |
| `scripts/benchmark-storage.js` | utility | batch / file-I/O | `.planning/spikes/001-sqlite-performance/write-benchmark.js` | exact |
| `scripts/verify-package.js` | utility | package metadata | `scripts/verify-package.js` | exact |

## Pattern Assignments

### `src/sqlite-store.js` (service, CRUD / file-I/O)

**Analog:** `src/sqlite-store.js`

**Imports and facade state pattern** (lines 1-13):
```javascript
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const initSqlJs = require('sql.js');
const { canonicalLabel } = require('./label-extractors');

let sqlModulePromise;

function getSqlModule() {
  if (!sqlModulePromise) sqlModulePromise = initSqlJs();
  return sqlModulePromise;
}
```

**Current anti-pattern to replace: full-file open/export** (lines 15-38):
```javascript
async function openDatabase(dbPath) {
  const SQL = await getSqlModule();
  if (fs.existsSync(dbPath)) {
    try {
      return new SQL.Database(fs.readFileSync(dbPath));
    } catch (error) {
      const message = error && error.message ? error.message : error && error.name ? error.name : String(error);
      throw new Error(`SQLite store is unreadable at ${dbPath}: ${message}. Move the file aside and re-run setup/report to rebuild from local sources.`);
    }
  }
  return new SQL.Database();
}

function persistDatabase(dbPath, db) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true, mode: 0o700 });
  const tmpPath = `${dbPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, Buffer.from(db.export()), { mode: 0o600 });
  fs.renameSync(tmpPath, dbPath);
}
```

**Schema and migration pattern to preserve** (lines 173-193, 254-292):
```javascript
async function initStore(dbPath) {
  const isNewStore = !fs.existsSync(dbPath);
  const db = await openDatabase(dbPath);
  try {
    let changed = isNewStore;
    db.run(`
CREATE TABLE IF NOT EXISTS raw_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  imported_at TEXT NOT NULL,
  source TEXT NOT NULL,
  source_file TEXT,
  line INTEGER NOT NULL,
  raw_fingerprint TEXT,
  payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS usage_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
```

```javascript
CREATE TABLE IF NOT EXISTS label_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  imported_at TEXT NOT NULL,
  label TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_field TEXT NOT NULL,
  source_value TEXT,
  confidence REAL NOT NULL DEFAULT 0,
  usage_record_id INTEGER,
  hook_event_id INTEGER,
  session_id TEXT,
  repo TEXT,
  branch TEXT,
  cwd TEXT,
  timestamp TEXT
);
CREATE TABLE IF NOT EXISTS manual_label_assignments (
  session_id TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (session_id, label)
);
CREATE TABLE IF NOT EXISTS import_warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  imported_at TEXT NOT NULL,
  source TEXT NOT NULL,
  line INTEGER,
  code TEXT NOT NULL,
  message TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS import_checkpoints (
  source TEXT NOT NULL,
  source_file TEXT NOT NULL,
  checkpoint_line INTEGER NOT NULL DEFAULT 0,
  context_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (source, source_file)
);
```

**Index and repair-on-init pattern to preserve** (lines 321-359):
```javascript
changed = createIndexIfMissing(
  db,
  'idx_raw_records_fingerprint',
  'CREATE UNIQUE INDEX idx_raw_records_fingerprint ON raw_records (source, source_file, raw_fingerprint)',
) || changed;
changed = createIndexIfMissing(
  db,
  'idx_usage_records_identity',
  'CREATE UNIQUE INDEX idx_usage_records_identity ON usage_records (usage_identity) WHERE usage_identity IS NOT NULL',
) || changed;
changed = dropIndexIfExists(db, 'idx_label_evidence_session_key') || changed;
changed = repairDuplicateHookEventsInDb(db) > 0 || changed;
changed = repairDuplicateLabelEvidenceInDb(db) > 0 || changed;
changed = createIndexIfMissing(
  db,
  'idx_manual_label_assignments_session',
  'CREATE INDEX idx_manual_label_assignments_session ON manual_label_assignments (session_id)',
) || changed;
if (changed) persistDatabase(dbPath, db);
```

**Exported API contract to keep stable** (lines 1511-1535):
```javascript
module.exports = {
  attachVscodeChatLabelEvidence,
  activeManualLabelAssignments,
  addManualLabels,
  clearImportCheckpoint,
  clearManualLabels,
  existingRawFingerprints,
  importCheckpoint,
  importedLineHighWater,
  initStore,
  insertImport,
  listManualLabels,
  loadImportState,
  queryOne,
  queryRows,
  repairDuplicateLabelEvidence,
  repairDuplicateVscodeUsageRecords,
  removeManualLabels,
  sessionExists,
  setManualLabels,
  upsertImportCheckpoint,
  updateUsageCostEstimates,
  updateVscodeUsageResponseIds,
  vscodeRawRecordsNeedingResponseBackfill,
};
```

---

### `src/sqlite-better-store.js` (service, CRUD / file-I/O)

**Analogs:** `src/sqlite-store.js`, `.planning/spikes/001-sqlite-performance/write-benchmark.js`

**better-sqlite3 import/open/close pattern** (spike lines 37-61):
```javascript
function betterCheckpointWrites(count) {
  const dbPath = copyStore('better');
  const db = betterSqlite(dbPath);
  const started = performance.now();
  try {
    const statement = db.prepare(`
      INSERT INTO import_checkpoints (source, source_file, checkpoint_line, context_json, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(source, source_file) DO UPDATE SET
        checkpoint_line = excluded.checkpoint_line,
        context_json = excluded.context_json,
        updated_at = excluded.updated_at
    `);
    const tx = db.transaction(() => {
      for (let index = 0; index < count; index += 1) {
        statement.run('spike-better', `/tmp/source-${index}.jsonl`, index, JSON.stringify({
          file_stat: { size: index, mtimeMs: index },
        }), new Date().toISOString());
      }
    });
    tx();
  } finally {
    db.close();
  }
}
```

**Transaction shape to port from current store** (store lines 649-657, 893-899):
```javascript
async function insertImport(dbPath, source, sourceFile, rawRecords, usageRecords, hookEvents, warnings) {
  await initStore(dbPath);
  const db = await openDatabase(dbPath);
  const importedAt = new Date().toISOString();
  let insertedUsageRecords = 0;
  let duplicateUsageRecords = 0;

  try {
    db.run('BEGIN');
```

```javascript
    db.run('COMMIT');
    persistDatabase(dbPath, db);
  } catch (error) {
    rollbackDatabase(db);
    throw error;
  } finally {
    closeDatabase(db);
  }
```

**Read helper shape to preserve while changing implementation** (store lines 1322-1345):
```javascript
async function queryOne(dbPath, sql) {
  const db = await openDatabase(dbPath);
  try {
    const result = db.exec(sql);
    if (!result.length) return [];
    const [{ columns, values }] = result;
    return values.map((row) => Object.fromEntries(row.map((value, index) => [columns[index], value])));
  } finally {
    closeDatabase(db);
  }
}

async function queryRows(dbPath, sql, params = []) {
  const db = await openDatabase(dbPath);
  const statement = db.prepare(sql);
  const rows = [];
  try {
    statement.bind(params);
    while (statement.step()) rows.push(statement.getAsObject());
  } finally {
    statement.free();
    closeDatabase(db);
  }
  return rows;
}
```

---

### `src/ingest.js` (service, batch / file-I/O)

**Analog:** `src/ingest.js`

**Store imports pattern** (lines 10-24):
```javascript
const {
  attachVscodeChatLabelEvidence,
  existingRawFingerprints,
  importCheckpoint,
  importedLineHighWater,
  initStore,
  insertImport,
  loadImportState,
  repairDuplicateVscodeUsageRecords,
  queryRows,
  upsertImportCheckpoint,
  updateUsageCostEstimates,
  updateVscodeUsageResponseIds,
  vscodeRawRecordsNeedingResponseBackfill,
} = require('./sqlite-store');
```

**Selected pricing enrichment pattern must remain unchanged** (lines 28-63):
```javascript
function enrichCosts(records) {
  return records.map((record) => {
    const pricing = classifyPricing(record);
    const warnings = [...record.warnings, ...pricing.warnings];
    return {
      ...record,
      usage_identity: usageIdentity(record),
      actual_charge_nano_aiu: pricing.actual_charge_nano_aiu,
      actual_ai_credits: pricing.actual_ai_credits,
      actual_usd: pricing.actual_usd,
      actual_basis: pricing.actual_basis,
      displayed_ai_credits: pricing.displayed_ai_credits,
      displayed_usd: pricing.displayed_usd,
      displayed_credit_text: pricing.displayed_credit_text,
      displayed_credit_basis: pricing.displayed_credit_basis,
      inferred_cache_read_tokens: pricing.inferred_cache_read_tokens,
      inferred_cache_read_reason: pricing.inferred_cache_read_reason,
      selected_ai_credits: pricing.selected_ai_credits,
      selected_usd: pricing.selected_usd,
      selected_pricing_basis: pricing.selected_pricing_basis,
      selected_confidence: pricing.selected_confidence,
      selected_source: pricing.selected_source,
```

**Call-site pattern for import plus checkpoint writes** (lines 1048-1061):
```javascript
const rawRecordsToInsert = source === 'copilot-session' ? newRecords.map(redactedSessionRecord) : newRecords;
let importResult = { inserted_usage_records: 0, duplicate_usage_records: 0 };
if (rawRecordsToInsert.length > 0 || enrichedUsage.length > 0 || enrichedHooks.length > 0 || warnings.length > 0) {
  importResult = await insertImport(dbPath, source, sourceFile, rawRecordsToInsert, enrichedUsage, enrichedHooks, warnings);
}
if (source === 'copilot-session') {
  const nextLine = newRecords.reduce((max, record) => Math.max(max, Number(record.line || 0)), checkpointLine);
  const context = updateCopilotSessionContext(checkpoint?.context || {}, newRecords);
  if (newRecords.length > 0 || nextLine > checkpointLine) {
    await upsertImportCheckpoint(dbPath, source, sourceFile, nextLine, context);
  }
}
const repairedCostRecords = options.repairCostEstimates === false ? 0 : await repairUsageCostEstimates(dbPath);
const repairedDuplicateUsageRecords = ['vscode', 'copilot-session'].includes(source) ? await repairDuplicateVscodeUsageRecords(dbPath) : 0;
```

Planner note: Phase 17 may introduce connection-aware variants, but the current public behavior expects these steps to remain awaited and return the same result fields.

---

### `src/reports.js` (service, request-response / CRUD reads)

**Analog:** `src/reports.js`

**Store import pattern** (lines 1-10):
```javascript
'use strict';

const { activeManualLabelAssignments, initStore, queryRows } = require('./sqlite-store');
const { canonicalLabel } = require('./label-extractors');
const {
  SCORING_VERSION,
  evidenceSessionKey,
  rankSessionEvidence,
  labelConfidenceSummaries,
} = require('./label-confidence');
```

**Report entrypoint pattern** (lines 275-284):
```javascript
async function labelOverview(dbPath) {
  await initStore(dbPath);
  const rows = await aggregateLabelRows(dbPath, { overview: true });
  return rows.sort((left, right) => n(right.selected_ai_credits) - n(left.selected_ai_credits) || left.label.localeCompare(right.label));
}

async function labelSummary(dbPath, label, options = {}) {
  await initStore(dbPath);
  const rows = await aggregateLabelRows(dbPath, { label: canonicalLabel(label), inclusion: inclusionForOptions(options) });
  return rows[0] || null;
}
```

**Manual-label read query pattern** (lines 423-474):
```javascript
async function manualLabelUsageRows(dbPath) {
  const rows = await queryRows(dbPath, `
SELECT
  NULL AS id,
  mla.created_at AS imported_at,
  mla.label,
  'manual' AS source_type,
  'manual' AS source_field,
  mla.label AS source_value,
  1 AS confidence,
  ur.id AS usage_record_id,
  ur.span_id,
  ur.trace_id,
  NULL AS hook_event_id,
  mla.session_id,
  ur.repo,
  ur.branch,
  ur.cwd,
  COALESCE(ur.timestamp, mla.updated_at, mla.created_at) AS timestamp,
  mla.created_at,
  mla.updated_at,
  ur.surface,
  ur.resolved_model,
  ur.requested_model,
  ur.selected_ai_credits,
  ur.selected_usd,
  ur.pricing_basis,
  ur.estimate_confidence,
  ur.selected_pricing_basis,
  ur.selected_confidence,
  ur.selected_source,
  ur.estimate_label,
  ur.usage_identity,
  COALESCE(ur.timestamp, mla.updated_at, mla.created_at) AS seen_at
FROM manual_label_assignments mla
LEFT JOIN usage_records ur ON ur.session_id = mla.session_id
ORDER BY mla.session_id, mla.label, ur.id`);
  return dedupeUsageRows(rows);
}
```

---

### `src/cli.js` (controller, request-response)

**Analog:** `src/cli.js`

**Store import pattern** (lines 16-24):
```javascript
const {
  addManualLabels,
  clearManualLabels,
  initStore,
  listManualLabels,
  removeManualLabels,
  sessionExists,
  setManualLabels,
} = require('./sqlite-store');
```

**Store lock and label mutation pattern** (lines 478-490):
```javascript
const normalizedLabels = normalizeManualLabelArgs(labels);
ensureDataDirs(paths);
const result = await withStoreLock(paths, io, async () => {
  if (!(await sessionExists(paths.usageDb, sessionId))) {
    throw new Error(`Unknown session_id "${sessionId}". Import local usage or label evidence before assigning manual labels.`);
  }
  if (action === 'list') return listManualLabels(paths.usageDb, sessionId);
  if (action === 'add') return addManualLabels(paths.usageDb, sessionId, normalizedLabels);
  if (action === 'remove') return removeManualLabels(paths.usageDb, sessionId, normalizedLabels);
  if (action === 'set') return setManualLabels(paths.usageDb, sessionId, normalizedLabels);
  return clearManualLabels(paths.usageDb, sessionId);
});
writeOutput(io.stdout, json ? result : formatManualLabelState(result), json);
```

**Store init command pattern** (lines 494-500):
```javascript
if (command === 'store') {
  if (subcommand !== 'init') {
    throw new Error(`Unknown store action "${subcommand}". Use init.`);
  }
  ensureDataDirs(paths);
  await withStoreLock(paths, io, () => initStore(paths.usageDb));
  writeOutput(io.stdout, json ? { dbPath: paths.usageDb } : `Initialized SQLite store: ${paths.usageDb}`, json);
  return;
}
```

---

### `package.json` / `package-lock.json` (config, package metadata)

**Analogs:** `package.json`, `.planning/spikes/001-sqlite-performance/package.json`

**Current dependency/script pattern** (`package.json` lines 28-52):
```json
"scripts": {
  "cli": "node bin/copilot-metrics.js",
  "check": "node --check bin/copilot-metrics.js && node --check src/*.js",
  "check:readme-version": "node scripts/sync-readme-version.js --check",
  "sync:readme-version": "node scripts/sync-readme-version.js --write",
  "version": "node scripts/sync-readme-version.js --write && git add README.md",
  "prepack": "node scripts/sync-readme-version.js --check",
  "smoke": "node scripts/smoke.js",
  "verify:package": "node scripts/verify-package.js",
  "test": "node --test"
},
"engines": {
  "node": ">=20"
},
"dependencies": {
  "sql.js": "^1.14.1"
}
```

**Dependency version source** (spike `package.json` lines 16 and lockfile references):
```json
"better-sqlite3": "12.10.0"
```

Planner note: add `better-sqlite3` as a normal dependency, not a dev-only dependency, because the installed CLI needs it at runtime.

---

### `test/storage-backend.test.js` (test, CRUD / file-I/O)

**Analogs:** `test/ingest.test.js`, `test/report.test.js`, `test/setup.test.js`

**Node test imports and temp-home pattern** (`test/ingest.test.js` lines 1-27):
```javascript
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const initSqlJs = require('sql.js');
const { resolvePaths } = require('../src/paths');
const { readJsonl } = require('../src/jsonl');
const { normalizePayload } = require('../src/otel');
const { estimateCost, PRICING_VERSION } = require('../src/pricing');
const {
  insertImport,
  queryOne,
  repairDuplicateLabelEvidence,
} = require('../src/sqlite-store');
```

**Ingest/store assertion pattern** (`test/ingest.test.js` lines 145-163):
```javascript
test('ingestFile stores vscode usage and warnings in SQLite', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-ingest-'));
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: tmp }, cwd: process.cwd() });
  const result = await ingestFile({
    dbPath: paths.usageDb,
    file: path.join(fixtures, 'vscode-otel.jsonl'),
    source: 'vscode',
  });
  assert.equal(result.raw_records, 2);
  assert.equal(result.usage_records, 2);
  assert.equal(result.estimate_label, `estimate:${PRICING_VERSION}`);
  const rows = await queryOne(paths.usageDb, 'SELECT COUNT(*) AS count, SUM(input_tokens) AS input FROM usage_records');
  assert.equal(rows[0].count, 2);
  assert.equal(rows[0].input, 1010);
});
```

**Manual-label storage contract pattern** (`test/report.test.js` lines 162-205):
```javascript
test('manual label CLI stores active assignments and returns post-operation JSON', async () => {
  const home = seedStore();
  const dbPath = path.join(home, 'store', 'copilot-metrics.sqlite');

  const added = JSON.parse(run(['label', 's1', 'add', 'demo-222', 'DEMO-333', '--home', home, '--json']));
  assert.deepEqual(added.manual_labels, ['DEMO-222', 'DEMO-333']);
  assert.equal(added.operation, 'add');
  assert.equal(added.changed, true);

  let rows = await queryOne(dbPath, 'SELECT label FROM manual_label_assignments WHERE session_id = "s1" ORDER BY label');
  assert.deepEqual(rows.map((row) => row.label), ['DEMO-999']);
});
```

**Selected-pricing persistence pattern** (`test/ingest.test.js` lines 451-469):
```javascript
const usage = await queryOne(paths.usageDb, `
  SELECT pricing_basis, estimate_confidence, displayed_ai_credits, displayed_usd,
    displayed_credit_text, estimated_ai_credits, upper_bound_ai_credits,
    cache_read_tokens, cache_read_status, inferred_cache_read_tokens,
    inferred_cache_read_reason, selected_ai_credits, selected_usd,
    selected_pricing_basis, selected_confidence, selected_source,
    pricing_diagnostics_json
  FROM usage_records
`);
assert.equal(usage[0].displayed_ai_credits, 0.8);
assert.equal(usage[0].selected_ai_credits, 0.8);
assert.equal(usage[0].selected_usd, 0.008);
assert.equal(usage[0].selected_pricing_basis, 'displayed_credit');
assert.equal(usage[0].selected_confidence, 'displayed');
assert.equal(usage[0].selected_source, 'vscode_result_details');
```

---

### `scripts/verify-native-sqlite-package.js` (utility, batch / package smoke)

**Analog:** `scripts/verify-package.js`

**Script style and sync command pattern** (lines 1-9, 36-55):
```javascript
#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');

execFileSync(process.execPath, ['scripts/sync-readme-version.js', '--check'], {
  encoding: 'utf8',
  stdio: 'inherit',
});
```

```javascript
const output = execFileSync('npm', ['pack', '--dry-run', '--json', '--silent'], { encoding: 'utf8' });
const [pack] = JSON.parse(output);
const files = pack.files.map((file) => file.path).sort();

const missing = required.filter((file) => !files.includes(file));
if (missing.length) {
  throw new Error(`Package is missing required files: ${missing.join(', ')}`);
}

process.stdout.write([
  `Package verification passed: ${pack.name}@${pack.version}`,
  `Tarball: ${pack.filename}`,
  `Files: ${files.length}`,
  `Unpacked size: ${pack.unpackedSize} bytes`,
].join('\n'));
process.stdout.write('\n');
```

Planner note: follow this script's no-framework, fail-fast style. For the native smoke, use temp directories and `execFileSync` to pack/install/run the CLI from outside the checkout.

---

### `scripts/benchmark-storage.js` (utility, batch / file-I/O)

**Analogs:** `.planning/spikes/001-sqlite-performance/write-benchmark.js`, `.planning/spikes/001-sqlite-performance/benchmark.js`

**Copied-store benchmark harness pattern** (`write-benchmark.js` lines 1-24):
```javascript
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const root = path.resolve(__dirname, '../../..');
const { resolvePaths } = require(path.join(root, 'src/paths'));
const { upsertImportCheckpoint } = require(path.join(root, 'src/sqlite-store'));
const betterSqlite = require('better-sqlite3');

const currentPaths = resolvePaths({ cwd: root });

function copyStore(suffix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `copilot-metrics-write-${suffix}-`));
  const dbPath = path.join(dir, 'copilot-metrics.sqlite');
  fs.copyFileSync(currentPaths.usageDb, dbPath);
  return dbPath;
}
```

**Result writing pattern** (`write-benchmark.js` lines 64-78):
```javascript
async function main() {
  const count = Number(process.argv[2] || 350);
  const results = {
    generated_at: new Date().toISOString(),
    store_size_bytes: fs.statSync(currentPaths.usageDb).size,
    writes: [
      await sqlJsCheckpointWrites(count),
      betterCheckpointWrites(count),
    ],
  };
  const outPath = path.join(__dirname, 'write-benchmark-results.json');
  fs.writeFileSync(outPath, `${JSON.stringify(results, null, 2)}\n`);
  console.log(`Wrote ${outPath}`);
  console.log(JSON.stringify(results, null, 2));
}
```

**CLI benchmark pattern** (`benchmark.js` lines 278-296):
```javascript
const labelsCold = command(['report', 'labels', '--json'], home);
results.cli.push(summarizeCommand(labelsCold));
const labelsPayload = parseJson(labelsCold.stdout);
const topLabel = labelsPayload?.labels?.[0]?.label || null;

const labelsWarm = command(['report', 'labels', '--json'], home);
results.cli.push(summarizeCommand(labelsWarm));

if (topLabel) {
  const detail = command(['report', 'label', topLabel, '--detail', '--session-detail', '--json'], home);
  results.cli.push(summarizeCommand(detail));
}

const refresh = command(['report', 'labels', '--refresh', '--json'], home);
results.cli.push(summarizeCommand(refresh));

results.store_after = storeStats(dbPath);
results.microbench.sql_js = await sqlJsQueries(dbPath);
results.microbench.better_sqlite3 = betterSqliteQueries(dbPath);
```

---

### `scripts/verify-package.js` (utility, package metadata)

**Analog:** `scripts/verify-package.js`

**Forbidden artifact pattern already covers SQLite/WAL/SHM** (lines 11-20):
```javascript
const forbidden = [
  /^\.codex\//,
  /^\.planning\//,
  /^test\//,
  /^copilot-metrics-data\//,
  /^\.copilot-metrics\//,
  /(?:^|\/).*\.sqlite(?:-shm|-wal)?$/,
  /(?:^|\/).*otel.*\.jsonl$/,
  /(?:^|\/).*hooks.*\.jsonl$/,
];
```

**Required file allowlist pattern** (lines 22-34):
```javascript
const required = [
  'package.json',
  'README.md',
  'CHANGELOG.md',
  'RELEASE.md',
  'LICENSE',
  'bin/copilot-metrics.js',
  'src/cli.js',
  'src/reports.js',
  'skills/copilot-metrics/SKILL.md',
  'scripts/manual-copilot-cli-flow.js',
  'scripts/sync-readme-version.js',
];
```

Planner note: if `scripts/verify-native-sqlite-package.js` becomes part of packed runtime validation, add it to `files` and `required`; otherwise keep it unpacked and invoked only from the repo.

## Shared Patterns

### Store Locking and Setup

**Source:** `src/cli.js` lines 478-500
**Apply to:** `src/cli.js`, `src/sqlite-store.js`, any new storage smoke scripts

All user-facing mutations should continue to run through `withStoreLock(paths, io, ...)` at the CLI layer. Do not add a second lock protocol in the storage backend unless it is internal and compatible with existing command behavior.

### Async Public Facade, Sync Internal Backend

**Source:** `src/sqlite-store.js` lines 1511-1535
**Apply to:** `src/sqlite-store.js`, `src/sqlite-better-store.js`, `src/ingest.js`, `src/reports.js`

Keep exported store helpers async-compatible because callers already `await` them. Hide `better-sqlite3` synchronous calls behind that facade.

### Transaction Boundaries

**Source:** `src/sqlite-store.js` lines 649-657, 893-899; spike `write-benchmark.js` lines 37-61
**Apply to:** `src/sqlite-better-store.js`, mutation helpers in `src/sqlite-store.js`, `src/ingest.js`

Use one opened file-backed connection plus one synchronous transaction for related writes. Keep filesystem discovery, JSONL parsing, and async work outside transaction callbacks.

### Schema Compatibility

**Source:** `src/sqlite-store.js` lines 173-359
**Apply to:** `src/sqlite-store.js`, `src/sqlite-better-store.js`, `test/storage-backend.test.js`

Preserve table names, columns, default values, unique indexes, manual-label table, `import_checkpoints`, `import_warnings`, selected pricing columns, and repair-on-init behavior.

### Report Semantics

**Source:** `src/reports.js` lines 275-284, 423-506, 654-680, 749-792
**Apply to:** `src/reports.js`, `test/storage-backend.test.js`, package smoke script

Report code reads stored selected-pricing fields and label evidence. Phase 17 must not change top-label, top-k/all-match, manual-label precedence, or selected-price semantics.

### Package Verification

**Source:** `scripts/verify-package.js` lines 11-55
**Apply to:** `scripts/verify-package.js`, `scripts/verify-native-sqlite-package.js`, `package.json`

Keep machine-readable `npm pack --dry-run --json --silent` parsing. Continue blocking `.sqlite`, `.sqlite-wal`, and `.sqlite-shm` artifacts from package contents.

## No Analog Found

All expected Phase 17 files have direct or role-level analogs in the current codebase or the prior SQLite performance spike.

## Metadata

**Analog search scope:** `src/`, `test/`, `scripts/`, `.planning/spikes/001-sqlite-performance/`, `package.json`, `package-lock.json`
**Files scanned:** 32
**Pattern extraction date:** 2026-06-10
