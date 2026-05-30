'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { resolvePaths } = require('../src/paths');
const { readJsonl } = require('../src/jsonl');
const { normalizePayload } = require('../src/otel');
const { estimateCost, PRICING_VERSION } = require('../src/pricing');
const { ingestFile } = require('../src/ingest');
const { queryOne } = require('../src/sqlite-store');
const { loadConfiguredExtractors, runLabelExtractors } = require('../src/label-extractors');

const fixtures = path.join(__dirname, 'fixtures');

test('readJsonl skips malformed rows with warnings', () => {
  const parsed = readJsonl(path.join(fixtures, 'vscode-otel.jsonl'));
  assert.equal(parsed.records.length, 2);
  assert.equal(parsed.warnings.length, 1);
  assert.equal(parsed.warnings[0].code, 'malformed_jsonl');
});

test('normalizePayload keeps LLM spans and skips root agent spans', () => {
  const parsed = readJsonl(path.join(fixtures, 'vscode-otel.jsonl'));
  const usage = normalizePayload(parsed.records[0].value, 'vscode', parsed.records[0].line);
  assert.equal(usage.length, 1);
  assert.equal(usage[0].span_id, 'llm1');
  assert.equal(usage[0].input_tokens, 1000);
  assert.equal(usage[0].output_tokens, 500);
  assert.equal(usage[0].cache_read_tokens, 200);
  assert.equal(usage[0].cache_creation_tokens, 100);
  assert.equal(usage[0].reasoning_tokens, 50);
});

test('estimateCost produces USD and AI credits for known models', () => {
  const estimate = estimateCost({
    resolved_model: 'gpt-5.4',
    input_tokens: 1000,
    output_tokens: 500,
    cache_read_tokens: 200,
    cache_creation_tokens: 100,
  });
  assert.equal(estimate.warning, null);
  assert.ok(estimate.estimated_usd > 0);
  assert.equal(estimate.estimated_ai_credits, Number((estimate.estimated_usd / 0.01).toFixed(6)));
});

test('estimateCost flags unknown models', () => {
  const estimate = estimateCost({
    resolved_model: 'mystery-model',
    input_tokens: 1,
    output_tokens: 1,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
  });
  assert.equal(estimate.estimated_usd, null);
  assert.match(estimate.warning, /unknown_model/);
});

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
  assert.ok(result.warnings.some((warning) => warning.code === 'malformed_jsonl'));
  assert.ok(result.warnings.some((warning) => warning.message.includes('unknown_model')));
  const rows = await queryOne(paths.usageDb, 'SELECT COUNT(*) AS count, SUM(input_tokens) AS input FROM usage_records');
  assert.equal(rows[0].count, 2);
  assert.equal(rows[0].input, 1010);
  const evidence = await queryOne(paths.usageDb, "SELECT label, source_field FROM label_evidence WHERE label = 'DEMO-12345'");
  assert.ok(evidence.some((row) => row.source_field === 'branch'));
});

test('ingestFile stores copilot cli records and hook events', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-ingest-'));
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: tmp }, cwd: process.cwd() });
  const cli = await ingestFile({
    dbPath: paths.usageDb,
    file: path.join(fixtures, 'copilot-cli-otel.jsonl'),
    source: 'copilot-cli',
  });
  const hooks = await ingestFile({
    dbPath: paths.usageDb,
    file: path.join(fixtures, 'hook-events.jsonl'),
    source: 'hooks',
  });
  assert.equal(cli.usage_records, 1);
  assert.equal(hooks.hook_events, 2);
  const rows = await queryOne(paths.usageDb, 'SELECT COUNT(*) AS count FROM hook_events');
  assert.equal(rows[0].count, 2);
  const evidence = await queryOne(paths.usageDb, 'SELECT label, source_type, session_id FROM label_evidence ORDER BY label');
  assert.ok(evidence.some((row) => row.label === 'DEMO-200' && row.source_type === 'usage'));
  assert.ok(evidence.some((row) => row.label === 'DEMO-54321'));
  assert.ok(evidence.some((row) => row.session_id === 's1'));
});

test('custom extractors can return zero or more labels', () => {
  const none = runLabelExtractors('usage', { branch: 'main' }, [
    () => [],
  ]);
  assert.deepEqual(none, []);

  const custom = runLabelExtractors('usage', { branch: 'main' }, [
    (sourceType, sourceData) => sourceData.branch === 'main'
      ? [{ label: 'custom-42', source_field: 'branch', confidence: 0.25, source_type: sourceType }]
      : [],
  ]);
  assert.equal(custom.length, 1);
  assert.equal(custom[0].label, 'CUSTOM-42');
  assert.equal(custom[0].source_field, 'branch');
});

test('configured custom extractors load from config without source changes', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-extractor-'));
  const extractorPath = path.join(tmp, 'extractor.cjs');
  fs.writeFileSync(extractorPath, `
module.exports = (sourceType, sourceData) => {
  if (sourceType === 'usage' && sourceData.repo === 'copilot-metrics') {
    return [{ label: 'TEAM-777', source_field: 'repo', source_value: sourceData.repo, confidence: 0.6 }];
  }
  return [];
};
`);
  const configPath = path.join(tmp, 'config.json');
  fs.writeFileSync(configPath, `${JSON.stringify({ labelExtractors: [extractorPath] })}\n`);
  const extractors = loadConfiguredExtractors(configPath, process.cwd());
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: tmp }, cwd: process.cwd() });
  await ingestFile({
    dbPath: paths.usageDb,
    file: path.join(fixtures, 'vscode-otel.jsonl'),
    source: 'vscode',
    extractors,
  });
  const evidence = await queryOne(paths.usageDb, "SELECT label, source_field FROM label_evidence WHERE label = 'TEAM-777'");
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].source_field, 'repo');
});
