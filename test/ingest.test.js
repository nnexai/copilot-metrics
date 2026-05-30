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
});
