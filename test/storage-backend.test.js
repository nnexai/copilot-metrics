'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const BetterSqlite = require('better-sqlite3');
const { resolvePaths } = require('../src/paths');
const { PRICING_VERSION } = require('../src/pricing');
const {
  addManualLabels,
  clearManualLabels,
  importCheckpoint,
  initStore,
  insertImport,
  listManualLabels,
  queryRows,
  repairDuplicateLabelEvidence,
  sessionExists,
  upsertImportCheckpoint,
} = require('../src/sqlite-store');

function tempDb() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-storage-'));
  return resolvePaths({ env: { COPILOT_METRICS_HOME: home }, cwd: process.cwd() }).usageDb;
}

function withRawDb(dbPath, callback) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new BetterSqlite(dbPath);
  try {
    return callback(db);
  } finally {
    db.close();
  }
}

function schemaVersion(dbPath) {
  return withRawDb(dbPath, (db) => Number(db.pragma('user_version', { simple: true })));
}

function fixtureImport() {
  return {
    rawRecords: [
      { line: 1, raw_fingerprint: 'fingerprint-1', value: { ok: true } },
      { line: 2, raw_fingerprint: 'fingerprint-1', value: { duplicate: true } },
    ],
    usageRecords: [{
      raw_line: 1,
      span_id: 'span-storage-1',
      trace_id: 'trace-storage',
      parent_span_id: null,
      timestamp: '2026-06-10T08:00:00.000Z',
      surface: 'vscode-chat',
      conversation_id: 'conversation-storage',
      session_id: 'session-storage',
      requested_model: 'gpt-5-mini',
      resolved_model: 'gpt-5-mini',
      repo: '/repo',
      branch: 'feature/DEMO-1701',
      cwd: '/repo/DEMO-1701',
      commit_sha: 'abc123',
      input_tokens: 100,
      output_tokens: 20,
      cache_read_tokens: 5,
      cache_creation_tokens: 0,
      reasoning_tokens: 0,
      actual_charge_nano_aiu: null,
      actual_ai_credits: null,
      actual_usd: null,
      actual_basis: null,
      displayed_ai_credits: 0.8,
      displayed_usd: 0.008,
      displayed_credit_text: '0.8 credits',
      displayed_credit_basis: 'fixture',
      inferred_cache_read_tokens: null,
      inferred_cache_read_reason: null,
      estimated_usd: 0.001,
      estimated_ai_credits: 0.1,
      upper_bound_usd: null,
      upper_bound_ai_credits: null,
      selected_ai_credits: 0.8,
      selected_usd: 0.008,
      selected_pricing_basis: 'displayed_credit',
      selected_confidence: 'high',
      selected_source: 'fixture',
      pricing_basis: 'displayed_credit',
      estimate_confidence: 'high',
      cache_read_status: 'known',
      pricing_source: 'fixture',
      estimate_label: `estimate:${PRICING_VERSION}`,
      pricing_metadata: { source: 'fixture' },
      pricing_diagnostics: ['fixture_diagnostic'],
      warnings: ['fixture_warning'],
      usage_identity: 'storage-fixture-identity',
      label_evidence: [{
        label: 'DEMO-1701',
        source_type: 'usage',
        source_field: 'branch',
        source_value: 'feature/DEMO-1701',
        confidence: 0.9,
      }],
    }],
    hookEvents: [{
      raw_line: 1,
      event: 'prompt',
      session_id: 'session-hook',
      cwd: '/repo/DEMO-1702',
      repo: '/repo',
      branch: 'feature/DEMO-1702',
      labels: ['DEMO-1702'],
      payload: { redacted: true },
      timestamp: '2026-06-10T08:01:00.000Z',
      label_evidence: [{
        label: 'DEMO-1702',
        source_type: 'hook',
        source_field: 'cwd',
        source_value: '/repo/DEMO-1702',
        confidence: 0.9,
      }],
    }],
    warnings: [{ line: 2, code: 'fixture_warning', message: 'fixture warning' }],
  };
}

test('store facade initializes, persists, dedupes, and reopens core tables', async () => {
  const dbPath = tempDb();
  await initStore(dbPath);
  assert.ok(fs.existsSync(dbPath));

  const fixture = fixtureImport();
  await insertImport(dbPath, 'vscode', '/tmp/source.jsonl', fixture.rawRecords, fixture.usageRecords, fixture.hookEvents, fixture.warnings);
  await upsertImportCheckpoint(dbPath, 'vscode', '/tmp/source.jsonl', 2, { file_stat: { size: 10, mtimeMs: 20 } });
  await addManualLabels(dbPath, 'session-storage', ['demo-999']);

  const raw = await queryRows(dbPath, 'SELECT COUNT(*) AS count FROM raw_records');
  const usage = await queryRows(dbPath, 'SELECT selected_ai_credits, selected_pricing_basis, pricing_metadata_json, pricing_diagnostics_json, warnings_json FROM usage_records');
  const hooks = await queryRows(dbPath, 'SELECT COUNT(*) AS count FROM hook_events');
  const evidence = await queryRows(dbPath, 'SELECT label, source_type, session_id FROM label_evidence ORDER BY label');
  const warnings = await queryRows(dbPath, 'SELECT code, message FROM import_warnings');
  const checkpoint = await importCheckpoint(dbPath, 'vscode', '/tmp/source.jsonl');
  const manual = await listManualLabels(dbPath, 'session-storage');

  assert.equal(raw[0].count, 1);
  assert.equal(usage.length, 1);
  assert.equal(usage[0].selected_ai_credits, 0.8);
  assert.equal(usage[0].selected_pricing_basis, 'displayed_credit');
  assert.deepEqual(JSON.parse(usage[0].pricing_metadata_json), { source: 'fixture' });
  assert.deepEqual(JSON.parse(usage[0].pricing_diagnostics_json), ['fixture_diagnostic']);
  assert.deepEqual(JSON.parse(usage[0].warnings_json), ['fixture_warning']);
  assert.equal(hooks[0].count, 1);
  assert.deepEqual(evidence.map((row) => row.label), ['DEMO-1701', 'DEMO-1702']);
  assert.equal(warnings[0].code, 'fixture_warning');
  assert.equal(checkpoint.checkpoint_line, 2);
  assert.deepEqual(checkpoint.context, { file_stat: { size: 10, mtimeMs: 20 } });
  assert.deepEqual(manual.manual_labels, ['DEMO-999']);
  assert.equal(await sessionExists(dbPath, 'session-storage'), true);

  await insertImport(dbPath, 'vscode', '/tmp/source.jsonl', fixture.rawRecords, fixture.usageRecords, fixture.hookEvents, fixture.warnings);
  await repairDuplicateLabelEvidence(dbPath);
  const counts = await queryRows(dbPath, `
    SELECT
      (SELECT COUNT(*) FROM raw_records) AS raw_count,
      (SELECT COUNT(*) FROM usage_records) AS usage_count,
      (SELECT COUNT(*) FROM hook_events) AS hook_count
  `);
  assert.deepEqual(counts[0], { raw_count: 1, usage_count: 1, hook_count: 1 });

  await clearManualLabels(dbPath, 'session-storage');
  const cleared = await listManualLabels(dbPath, 'session-storage');
  assert.deepEqual(cleared.manual_labels, []);
});

test('runtime storage no longer uses sql.js full-file export mechanics', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'sqlite-store.js'), 'utf8');
  assert.doesNotMatch(source, /require\(['"]sql\.js['"]\)/);
  assert.doesNotMatch(source, /initSqlJs/);
  assert.doesNotMatch(source, /\.export\s*\(/);
  assert.doesNotMatch(source, /persistDatabase\s*\([^)]*db\.export/);
  assert.doesNotMatch(source, /db\.transaction\s*\(\s*async/);
});

test('schema migration initializes a new store with a durable current version', async () => {
  const dbPath = tempDb();
  await initStore(dbPath);

  withRawDb(dbPath, (db) => {
    assert.ok(schemaVersion(dbPath) > 0);
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name));
    for (const table of ['raw_records', 'usage_records', 'hook_events', 'label_evidence', 'manual_label_assignments', 'import_warnings', 'import_checkpoints', 'store_metadata']) {
      assert.ok(tables.has(table), `missing table ${table}`);
    }
    const indexes = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all().map((row) => row.name));
    for (const index of ['idx_raw_records_fingerprint', 'idx_usage_records_identity', 'idx_hook_events_source_file_line', 'idx_label_evidence_usage_key', 'idx_label_evidence_hook_key']) {
      assert.ok(indexes.has(index), `missing index ${index}`);
    }
  });
});

test('unversioned store migration preserves rows and cleans duplicates before unique indexes', async () => {
  const dbPath = tempDb();
  await initStore(dbPath);
  withRawDb(dbPath, (db) => {
    db.pragma('user_version = 0');
    db.exec(`
      DROP INDEX idx_hook_events_source_file_line;
      DROP INDEX idx_label_evidence_hook_key;
      INSERT INTO hook_events (imported_at, source, source_file, raw_line, labels_json, payload_json)
      VALUES ('2026-07-20', 'hooks', '/tmp/hooks.jsonl', 9, '[]', '{}');
      INSERT INTO hook_events (imported_at, source, source_file, raw_line, labels_json, payload_json)
      VALUES ('2026-07-20', 'hooks', '/tmp/hooks.jsonl', 9, '[]', '{}');
      INSERT INTO label_evidence (imported_at, label, source_type, source_field, source_value, hook_event_id)
      SELECT '2026-07-20', 'DEMO-2101', 'hook', 'cwd', '/repo/DEMO-2101', id
      FROM hook_events WHERE raw_line = 9;
    `);
  });

  await initStore(dbPath);

  withRawDb(dbPath, (db) => {
    assert.ok(schemaVersion(dbPath) > 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM hook_events WHERE raw_line = 9').get().count, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM label_evidence WHERE label = 'DEMO-2101'").get().count, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index' AND name = 'idx_hook_events_source_file_line'").get().count, 1);
  });
});

test('current store initialization skips legacy schema and duplicate cleanup probes', async () => {
  const dbPath = tempDb();
  await initStore(dbPath);
  const currentVersion = schemaVersion(dbPath);
  withRawDb(dbPath, (db) => {
    db.exec(`
      DROP INDEX idx_hook_events_source_file_line;
      INSERT INTO hook_events (imported_at, source, source_file, raw_line, labels_json, payload_json)
      VALUES ('2026-07-20', 'hooks', '/tmp/current.jsonl', 7, '[]', '{}');
      INSERT INTO hook_events (imported_at, source, source_file, raw_line, labels_json, payload_json)
      VALUES ('2026-07-20', 'hooks', '/tmp/current.jsonl', 7, '[]', '{}');
    `);
  });

  await initStore(dbPath);

  withRawDb(dbPath, (db) => {
    assert.equal(schemaVersion(dbPath), currentVersion);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM hook_events WHERE raw_line = 7').get().count, 2);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index' AND name = 'idx_hook_events_source_file_line'").get().count, 0);
  });
});

test('migration rollback leaves schema version unadvanced and retries after the blocker is removed', async () => {
  const dbPath = tempDb();
  withRawDb(dbPath, (db) => {
    db.exec(`
      CREATE TABLE raw_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        imported_at TEXT NOT NULL,
        source TEXT NOT NULL,
        line INTEGER NOT NULL,
        payload_json TEXT NOT NULL
      );
      INSERT INTO raw_records (imported_at, source, line, payload_json)
      VALUES ('2026-07-20', 'legacy', 1, '{}');
      CREATE TABLE idx_raw_records_fingerprint (blocked INTEGER);
    `);
  });

  await assert.rejects(initStore(dbPath), /idx_raw_records_fingerprint|already exists/i);
  withRawDb(dbPath, (db) => {
    assert.equal(schemaVersion(dbPath), 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM pragma_table_info('raw_records') WHERE name = 'source_file'").get().count, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM raw_records').get().count, 1);
    db.exec('DROP TABLE idx_raw_records_fingerprint');
  });

  await initStore(dbPath);
  withRawDb(dbPath, (db) => {
    assert.ok(schemaVersion(dbPath) > 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM pragma_table_info('raw_records') WHERE name = 'source_file'").get().count, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM raw_records').get().count, 1);
  });
});

test('future schema version is rejected without modifying the store', async () => {
  const dbPath = tempDb();
  await initStore(dbPath);
  const futureVersion = schemaVersion(dbPath) + 1;
  withRawDb(dbPath, (db) => {
    db.pragma(`user_version = ${futureVersion}`);
    db.exec("INSERT INTO store_metadata (key, value) VALUES ('future-sentinel', 'intact')");
  });

  await assert.rejects(initStore(dbPath), new RegExp(`newer schema version ${futureVersion}`, 'i'));
  withRawDb(dbPath, (db) => {
    assert.equal(schemaVersion(dbPath), futureVersion);
    assert.equal(db.prepare("SELECT value FROM store_metadata WHERE key = 'future-sentinel'").get().value, 'intact');
  });
});
