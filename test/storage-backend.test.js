'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
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
