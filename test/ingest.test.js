'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const BetterSqlite = require('better-sqlite3');
const { resolvePaths } = require('../src/paths');
const { readJsonl } = require('../src/jsonl');
const { normalizePayload } = require('../src/otel');
const { estimateCost, PRICING_VERSION } = require('../src/pricing');
const {
  applyVscodeDebugCachedTokens,
  backfillVscodeUsageResponseIds,
  configuredSourceEntries,
  ingestFile,
  normalizeVscodeFallbackUsage,
  normalizeVscodeChatSession,
  repairDuplicateVscodeUsageRecords,
  repairUsageCostEstimates,
} = require('../src/ingest');
const {
  importCheckpoint,
  insertImport,
  queryOne,
  repairDuplicateLabelEvidence,
  upsertImportCheckpoint,
} = require('../src/sqlite-store');
const { loadConfiguredExtractors, runLabelExtractors } = require('../src/label-extractors');

const fixtures = path.join(__dirname, 'fixtures');

test('readJsonl skips malformed rows with warnings', () => {
  const parsed = readJsonl(path.join(fixtures, 'vscode-otel.jsonl'));
  assert.equal(parsed.records.length, 2);
  assert.equal(parsed.warnings.length, 1);
  assert.equal(parsed.warnings[0].code, 'malformed_jsonl');
});

test('readJsonl incrementally reads only complete appended bytes with absolute lines', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-jsonl-reader-'));
  const file = path.join(tmp, 'events.jsonl');
  const initial = `${JSON.stringify({ value: 'å' })}\r\n${JSON.stringify({ value: 2 })}\r\n`;
  fs.writeFileSync(file, initial);
  const startByte = Buffer.byteLength(initial);
  fs.appendFileSync(file, `${JSON.stringify({ value: 3 })}\r\n${JSON.stringify({ value: 4 })}\r\n`);
  const reads = [];

  const parsed = readJsonl(file, {
    startByte,
    completedLines: 2,
    chunkSize: 7,
    onRead: (read) => reads.push(read),
  });

  assert.deepEqual(parsed.records.map((record) => record.line), [3, 4]);
  assert.deepEqual(parsed.records.map((record) => record.value.value), [3, 4]);
  assert.equal(parsed.nextByte, fs.statSync(file).size);
  assert.equal(parsed.completedLines, 4);
  assert.ok(reads.filter((read) => read.purpose === 'payload').every((read) => read.position >= startByte));
});

test('readJsonl incremental unchanged boundary performs no payload read', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-jsonl-unchanged-'));
  const file = path.join(tmp, 'events.jsonl');
  fs.writeFileSync(file, '{"value":1}\n');
  const reads = [];
  const size = fs.statSync(file).size;

  const parsed = readJsonl(file, {
    startByte: size,
    completedLines: 1,
    onRead: (read) => reads.push(read),
  });

  assert.deepEqual(parsed.records, []);
  assert.deepEqual(parsed.warnings, []);
  assert.equal(parsed.nextByte, size);
  assert.equal(parsed.completedLines, 1);
  assert.equal(reads.some((read) => read.purpose === 'payload'), false);
});

test('readJsonl incremental leaves a trailing partial value uncommitted until newline', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-jsonl-partial-'));
  const file = path.join(tmp, 'events.jsonl');
  fs.writeFileSync(file, '{"value":1}\n{"value":2');
  const firstLineByte = Buffer.byteLength('{"value":1}\n');

  const partial = readJsonl(file, { startByte: firstLineByte, completedLines: 1, chunkSize: 4 });
  assert.deepEqual(partial.records, []);
  assert.deepEqual(partial.warnings, []);
  assert.equal(partial.nextByte, firstLineByte);
  assert.equal(partial.completedLines, 1);

  fs.appendFileSync(file, '}\n');
  const completed = readJsonl(file, { startByte: partial.nextByte, completedLines: partial.completedLines, chunkSize: 4 });
  assert.deepEqual(completed.records, [{ line: 2, value: { value: 2 } }]);
  assert.equal(completed.nextByte, fs.statSync(file).size);
  assert.equal(completed.completedLines, 2);
});

test('readJsonl incremental warns for complete malformed lines at absolute line numbers', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-jsonl-warning-'));
  const file = path.join(tmp, 'events.jsonl');
  const prefix = '{"value":1}\n';
  fs.writeFileSync(file, `${prefix}not-json\n`);

  const parsed = readJsonl(file, { startByte: Buffer.byteLength(prefix), completedLines: 1 });
  assert.equal(parsed.records.length, 0);
  assert.equal(parsed.warnings.length, 1);
  assert.equal(parsed.warnings[0].code, 'malformed_jsonl');
  assert.equal(parsed.warnings[0].line, 2);
  assert.equal(parsed.completedLines, 2);
});

test('readJsonl incremental rejects incompatible and non-boundary byte resumes', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-jsonl-invalid-'));
  const file = path.join(tmp, 'events.jsonl');
  const line = `${JSON.stringify({ value: 'å' })}\n`;
  fs.writeFileSync(file, line);
  const multibyteStart = Buffer.from(line).indexOf(Buffer.from('å')) + 1;

  const middle = readJsonl(file, { startByte: multibyteStart, completedLines: 0 });
  assert.equal(middle.resetRequired, true);
  assert.equal(middle.resetReason, 'invalid_byte_boundary');

  const incompatible = readJsonl(file, { startByte: Buffer.byteLength(line), completedLines: -1 });
  assert.equal(incompatible.resetRequired, true);
  assert.equal(incompatible.resetReason, 'incompatible_range_metadata');
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

test('estimateCost splits cached tokens out of included input and output totals', () => {
  const estimate = estimateCost({
    resolved_model: 'claude sonnet 4.6',
    input_tokens: 1_000_000,
    output_tokens: 1_000_000,
    cache_read_tokens: 250_000,
    cache_creation_tokens: 100_000,
    reasoning_tokens: 123_456,
  });

  assert.equal(estimate.warning, null);
  assert.equal(estimate.estimated_usd, 16.2);
  assert.equal(estimate.estimated_ai_credits, 1620);
});

test('estimateCost does not add a separate charge for reasoning tokens', () => {
  const withoutReasoning = estimateCost({
    resolved_model: 'gpt-5-mini',
    input_tokens: 1_000_000,
    output_tokens: 1_000_000,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
    reasoning_tokens: 0,
  });
  const withReasoning = estimateCost({
    resolved_model: 'gpt-5-mini',
    input_tokens: 1_000_000,
    output_tokens: 1_000_000,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
    reasoning_tokens: 500_000,
  });

  assert.equal(withReasoning.estimated_usd, withoutReasoning.estimated_usd);
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

test('estimateCost maps dated Copilot model ids to matching known pricing rows', () => {
  const mini = estimateCost({
    resolved_model: 'gpt-5-mini-2025-08-07',
    input_tokens: 1_000_000,
    output_tokens: 1_000_000,
    cache_read_tokens: 1_000_000,
    cache_creation_tokens: 0,
  });
  assert.equal(mini.warning, null);
  assert.equal(mini.estimated_usd, 2.025);

  const sonnet = estimateCost({
    resolved_model: 'claude sonnet 4.5-2026-01-02',
    input_tokens: 1_000_000,
    output_tokens: 1_000_000,
    cache_read_tokens: 0,
    cache_creation_tokens: 1_000_000,
  });
  assert.equal(sonnet.warning, null);
  assert.equal(sonnet.estimated_usd, 6.75);
});

test('estimateCost maps hyphenated Copilot model ids to matching known pricing rows', () => {
  const haiku = estimateCost({
    resolved_model: 'claude-haiku-4.5',
    input_tokens: 1_000_000,
    output_tokens: 1_000_000,
    cache_read_tokens: 1_000_000,
    cache_creation_tokens: 0,
  });
  assert.equal(haiku.warning, null);
  assert.equal(haiku.estimated_usd, 5.1);
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

test('ingestFile preserves VS Code log-record timestamps, session, and response id', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-vscode-log-'));
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: tmp }, cwd: process.cwd() });
  const result = await ingestFile({
    dbPath: paths.usageDb,
    file: path.join(fixtures, 'vscode-log-records.jsonl'),
    source: 'vscode',
  });

  assert.equal(result.usage_records, 1);
  const usage = await queryOne(paths.usageDb, 'SELECT source, span_id, session_id, resolved_model, input_tokens, output_tokens, timestamp FROM usage_records');
  assert.equal(usage[0].source, 'vscode');
  assert.equal(usage[0].span_id, 'vscode-response');
  assert.equal(usage[0].session_id, 'otel-session');
  assert.equal(usage[0].resolved_model, 'gpt-5-mini-2025-08-07');
  assert.equal(usage[0].input_tokens, 30000);
  assert.equal(usage[0].output_tokens, 1200);
  assert.equal(usage[0].timestamp, '2026-05-31T21:28:50.000Z');
});

test('backfillVscodeUsageResponseIds repairs existing VS Code rows imported before response ids were captured', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-vscode-backfill-'));
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: tmp }, cwd: process.cwd() });
  const file = path.join(fixtures, 'vscode-log-records.jsonl');
  await ingestFile({ dbPath: paths.usageDb, file, source: 'vscode' });

  const db = new BetterSqlite(paths.usageDb);
  try {
    db.prepare("UPDATE usage_records SET span_id = NULL, session_id = NULL, timestamp = NULL WHERE source = 'vscode'").run();
  } finally {
    db.close();
  }

  const updated = await backfillVscodeUsageResponseIds(paths.usageDb, path.resolve(file));
  assert.equal(updated, 1);

  const usage = await queryOne(paths.usageDb, "SELECT span_id, session_id, timestamp FROM usage_records WHERE source = 'vscode'");
  assert.equal(usage[0].span_id, 'vscode-response');
  assert.equal(usage[0].session_id, 'otel-session');
  assert.equal(usage[0].timestamp, '2026-05-31T21:28:50.000Z');
});

test('repairUsageCostEstimates updates existing zero-cost dated model rows', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-cost-repair-'));
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: tmp }, cwd: process.cwd() });
  await ingestFile({
    dbPath: paths.usageDb,
    file: path.join(fixtures, 'vscode-log-records.jsonl'),
    source: 'vscode',
  });

  const db = new BetterSqlite(paths.usageDb);
  try {
    db.prepare("UPDATE usage_records SET estimated_usd = 0, estimated_ai_credits = 0, selected_ai_credits = NULL, selected_usd = NULL, selected_pricing_basis = NULL, selected_confidence = NULL, selected_source = NULL, warnings_json = '[\"unknown_model:gpt-5-mini-2025-08-07\"]'").run();
  } finally {
    db.close();
  }

  const updated = await repairUsageCostEstimates(paths.usageDb);
  assert.equal(updated, 1);

  const usage = await queryOne(paths.usageDb, 'SELECT estimated_usd, estimated_ai_credits, selected_ai_credits, selected_usd, selected_pricing_basis, warnings_json FROM usage_records');
  assert.equal(usage[0].estimated_usd, 0.0099);
  assert.equal(usage[0].estimated_ai_credits, 0.99);
  assert.equal(usage[0].selected_ai_credits, 0.99);
  assert.equal(usage[0].selected_usd, 0.0099);
  assert.equal(usage[0].selected_pricing_basis, 'estimated');
  assert.equal(usage[0].warnings_json, '[]');
});

test('ingestFile links VS Code chat labels to OTel usage by response id without storing chat raw records', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-vscode-chat-'));
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: tmp }, cwd: process.cwd() });

  await ingestFile({
    dbPath: paths.usageDb,
    file: path.join(fixtures, 'vscode-log-records.jsonl'),
    source: 'vscode',
  });
  const result = await ingestFile({
    dbPath: paths.usageDb,
    file: path.join(fixtures, 'vscode-chat-session.jsonl'),
    source: 'vscode-chat',
  });

  assert.equal(result.raw_records, 2);
  assert.equal(result.usage_records, 1);
  assert.equal(result.label_evidence, 1);

  const evidence = await queryOne(paths.usageDb, "SELECT label, source_field, source_value, session_id, usage_record_id FROM label_evidence WHERE label = 'HDASPF-321'");
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].source_field, 'vscode_chat_response');
  assert.equal(evidence[0].source_value, 'vscode-response');
  assert.equal(evidence[0].session_id, 'chat-session');
  assert.ok(evidence[0].usage_record_id > 0);

  const rawRows = await queryOne(paths.usageDb, "SELECT payload_json FROM raw_records WHERE source = 'vscode-chat'");
  assert.equal(rawRows.length, 2);
  assert.doesNotMatch(rawRows.map((row) => row.payload_json).join('\n'), /HDASPF-321/);

  const second = await ingestFile({
    dbPath: paths.usageDb,
    file: path.join(fixtures, 'vscode-chat-session.jsonl'),
    source: 'vscode-chat',
  });
  assert.equal(second.label_evidence, 0);
});

test('ingestFile stores VS Code fallback token usage from jsonl without persisting prompts', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-vscode-fallback-'));
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: tmp }, cwd: process.cwd() });
  const result = await ingestFile({
    dbPath: paths.usageDb,
    file: path.join(fixtures, 'vscode-fallback-usage.jsonl'),
    source: 'vscode-chat',
  });

  assert.equal(result.usage_records, 1);
  assert.ok(result.label_evidence >= 1);
  const usage = await queryOne(paths.usageDb, 'SELECT source, surface, session_id, resolved_model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, reasoning_tokens FROM usage_records');
  assert.equal(usage[0].source, 'vscode-chat');
  assert.equal(usage[0].surface, 'vscode-chat-session');
  assert.equal(usage[0].session_id, 'fallback-session');
  assert.equal(usage[0].resolved_model, 'gpt-5-mini');
  assert.equal(usage[0].input_tokens, 1400);
  assert.equal(usage[0].output_tokens, 350);
  assert.equal(usage[0].cache_read_tokens, 40);
  assert.equal(usage[0].cache_creation_tokens, 10);
  assert.equal(usage[0].reasoning_tokens, 5);

  const evidence = await queryOne(paths.usageDb, "SELECT label, source_field, usage_record_id FROM label_evidence WHERE label = 'DEMO-777'");
  assert.ok(evidence.some((row) => row.source_field === 'prompt' && row.usage_record_id > 0));
  const rawRows = await queryOne(paths.usageDb, "SELECT payload_json FROM raw_records WHERE source = 'vscode-chat'");
  assert.doesNotMatch(rawRows.map((row) => row.payload_json).join('\n'), /Please finish/);

  const second = await ingestFile({
    dbPath: paths.usageDb,
    file: path.join(fixtures, 'vscode-fallback-usage.jsonl'),
    source: 'vscode-chat',
  });
  assert.equal(second.new_raw_records, 0);
  assert.equal(second.usage_records, 0);
});

test('same session exchange is not duplicated across OTel and fallback sources', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-cross-source-dedupe-'));
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: tmp }, cwd: process.cwd() });

  await ingestFile({
    dbPath: paths.usageDb,
    file: path.join(fixtures, 'vscode-log-records.jsonl'),
    source: 'vscode',
  });
  const fallback = await ingestFile({
    dbPath: paths.usageDb,
    file: path.join(fixtures, 'vscode-fallback-duplicate.jsonl'),
    source: 'vscode-chat',
  });

  assert.equal(fallback.usage_records, 1);
  assert.equal(fallback.repaired_duplicate_usage_records, 1);
  const rows = await queryOne(paths.usageDb, 'SELECT COUNT(*) AS count, SUM(input_tokens) AS input FROM usage_records');
  assert.equal(rows[0].count, 1);
  assert.equal(rows[0].input, 30000);
  const evidence = await queryOne(paths.usageDb, "SELECT label, usage_record_id FROM label_evidence WHERE label = 'HDASPF-321'");
  assert.ok(evidence.length >= 1);
  assert.equal(new Set(evidence.map((row) => row.usage_record_id)).size, 1);
  assert.equal(await repairDuplicateVscodeUsageRecords(paths.usageDb), 0);
});

test('repeated hook imports dedupe by log entry while preserving distinct entries', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-hook-evidence-dedupe-'));
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: tmp }, cwd: process.cwd() });
  const hook = (rawLine) => ({
    raw_line: rawLine,
    event: 'stop',
    session_id: 'session-hook-repeat',
    cwd: '/repo/HDASPF-321',
    repo: '/repo',
    branch: 'feature/HDASPF-321',
    labels: ['HDASPF-321'],
    payload: { session_id: 'session-hook-repeat' },
    label_evidence: [{
      label: 'HDASPF-321',
      source_type: 'hook',
      source_field: 'labels',
      source_value: 'HDASPF-321',
      confidence: 0.95,
    }],
  });

  await insertImport(paths.usageDb, 'hook', 'hooks.jsonl', [], [], [hook(1), hook(2)], []);
  await insertImport(paths.usageDb, 'hook', 'hooks.jsonl', [], [], [hook(1), hook(2)], []);

  const evidence = await queryOne(paths.usageDb, `
SELECT COUNT(*) AS count, COUNT(DISTINCT hook_event_id) AS hook_events
FROM label_evidence
WHERE label = 'HDASPF-321' AND session_id = 'session-hook-repeat'
`);
  assert.equal(evidence[0].count, 2);
  assert.equal(evidence[0].hook_events, 2);
  assert.equal(await repairDuplicateLabelEvidence(paths.usageDb), 0);
});

test('ingestFile stores VS Code fallback token usage from json files', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-vscode-fallback-json-'));
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: tmp }, cwd: process.cwd() });
  const result = await ingestFile({
    dbPath: paths.usageDb,
    file: path.join(fixtures, 'vscode-fallback-usage.json'),
    source: 'vscode-chat',
  });

  assert.equal(result.usage_records, 1);
  const usage = await queryOne(paths.usageDb, 'SELECT session_id, input_tokens, output_tokens FROM usage_records');
  assert.equal(usage[0].session_id, 'fallback-json-session');
  assert.equal(usage[0].input_tokens, 1500);
  assert.equal(usage[0].output_tokens, 360);
});

test('VS Code fallback without numeric cache reads uses upper-bound session-local pricing', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-vscode-upper-'));
  const sessionFile = path.join(tmp, 'session.jsonl');
  fs.writeFileSync(sessionFile, JSON.stringify({
    kind: 0,
    v: {
      sessionId: 'session-upper',
      inputState: {
        selectedModel: {
          metadata: {
            id: 'gpt-5-mini',
            inputCost: 25,
            outputCost: 200,
            cacheCost: 2,
            multiplierNumeric: 0,
          },
        },
      },
      requests: [{
        message: { text: 'Estimate DEMO-881 without debug cache data.' },
        responseId: 'response-upper',
        resolvedModel: 'gpt-5-mini',
        usage: { inputTokens: 1000, outputTokens: 100 },
        metadata: { cacheKey: 'cache-key', renderedUserMessage: [{ cacheType: 'ephemeral' }] },
      }],
    },
  }) + '\n');
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: tmp }, cwd: process.cwd() });
  await ingestFile({ dbPath: paths.usageDb, file: sessionFile, source: 'vscode-chat' });

  const usage = await queryOne(paths.usageDb, 'SELECT cache_read_status, pricing_basis, estimate_confidence, pricing_source, estimated_ai_credits, upper_bound_ai_credits, pricing_diagnostics_json FROM usage_records');
  assert.equal(usage[0].cache_read_status, 'unknown');
  assert.equal(usage[0].pricing_basis, 'upper_bound');
  assert.equal(usage[0].estimate_confidence, 'upper_bound');
  assert.equal(usage[0].pricing_source, 'session');
  assert.equal(usage[0].estimated_ai_credits, 0.045);
  assert.equal(usage[0].upper_bound_ai_credits, 0.045);
  assert.match(usage[0].pricing_diagnostics_json, /cache_key_present/);
  assert.match(usage[0].pricing_diagnostics_json, /included_or_zero/);
});

test('VS Code displayed credits select displayed-credit basis before upper-bound estimates', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-vscode-display-'));
  const sessionFile = path.join(tmp, 'session.jsonl');
  fs.writeFileSync(sessionFile, JSON.stringify({
    kind: 0,
    v: {
      sessionId: 'session-display',
      inputState: {
        selectedModel: {
          metadata: {
            id: 'gpt-5-mini',
            inputCost: 25,
            outputCost: 200,
            cacheCost: 2,
          },
        },
      },
      requests: [{
        message: { text: 'Use displayed credits for DEMO-884.' },
        responseId: 'response-display',
        resolvedModel: 'gpt-5-mini',
        usage: { inputTokens: 100000, outputTokens: 2000 },
        result: { details: 'GPT-5 mini - 0.8 credits' },
      }],
    },
  }) + '\n');
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: tmp }, cwd: process.cwd() });
  await ingestFile({ dbPath: paths.usageDb, file: sessionFile, source: 'vscode-chat' });

  const usage = await queryOne(paths.usageDb, `
    SELECT pricing_basis, estimate_confidence, displayed_ai_credits, displayed_usd,
      displayed_credit_text, estimated_ai_credits, upper_bound_ai_credits,
      cache_read_tokens, cache_read_status, inferred_cache_read_tokens,
      inferred_cache_read_reason, selected_ai_credits, selected_usd,
      selected_pricing_basis, selected_confidence, selected_source,
      pricing_diagnostics_json
    FROM usage_records
  `);
  assert.equal(usage[0].pricing_basis, 'displayed_credit');
  assert.equal(usage[0].estimate_confidence, 'displayed');
  assert.equal(usage[0].displayed_ai_credits, 0.8);
  assert.equal(usage[0].displayed_usd, 0.008);
  assert.equal(usage[0].displayed_credit_text, 'GPT-5 mini - 0.8 credits');
  assert.equal(usage[0].selected_ai_credits, 0.8);
  assert.equal(usage[0].selected_usd, 0.008);
  assert.equal(usage[0].selected_pricing_basis, 'displayed_credit');
  assert.equal(usage[0].selected_confidence, 'displayed');
  assert.equal(usage[0].selected_source, 'vscode_result_details');
  assert.ok(usage[0].estimated_ai_credits > usage[0].displayed_ai_credits);
  assert.equal(usage[0].upper_bound_ai_credits, usage[0].estimated_ai_credits);
  assert.equal(usage[0].cache_read_tokens, 0);
  assert.equal(usage[0].cache_read_status, 'unknown');
  assert.ok(usage[0].inferred_cache_read_tokens > 0);
  assert.equal(usage[0].inferred_cache_read_reason, 'displayed_delta');
  assert.match(usage[0].pricing_diagnostics_json, /displayed_inferred_cache_read/);
  assert.match(usage[0].pricing_diagnostics_json, /displayed_estimate_delta/);
});

test('VS Code displayed 0x imports included display evidence', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-vscode-zero-display-'));
  const sessionFile = path.join(tmp, 'session.jsonl');
  fs.writeFileSync(sessionFile, JSON.stringify({
    kind: 0,
    v: {
      sessionId: 'session-zero-display',
      requests: [{
        message: { text: 'Zero display DEMO-885.' },
        responseId: 'response-zero-display',
        resolvedModel: 'gpt-5-mini',
        usage: { inputTokens: 1000, outputTokens: 100 },
        result: { details: 'GPT-5 mini - 0x' },
      }],
    },
  }) + '\n');
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: tmp }, cwd: process.cwd() });
  await ingestFile({ dbPath: paths.usageDb, file: sessionFile, source: 'vscode-chat' });

  const usage = await queryOne(paths.usageDb, 'SELECT pricing_basis, estimate_confidence, displayed_ai_credits, displayed_credit_text, estimated_ai_credits, selected_ai_credits, selected_usd, selected_pricing_basis, pricing_diagnostics_json FROM usage_records');
  assert.equal(usage[0].pricing_basis, 'included_or_zero');
  assert.equal(usage[0].estimate_confidence, 'plan_included');
  assert.equal(usage[0].displayed_ai_credits, 0);
  assert.ok(usage[0].estimated_ai_credits > 0);
  assert.equal(usage[0].selected_ai_credits, 0);
  assert.equal(usage[0].selected_usd, 0);
  assert.equal(usage[0].selected_pricing_basis, 'included_or_zero');
  assert.equal(usage[0].displayed_credit_text, 'GPT-5 mini - 0x');
  assert.match(usage[0].pricing_diagnostics_json, /included_or_zero/);
});

test('actual charge evidence remains stronger than displayed credits', async () => {
  const pricing = require('../src/pricing').classifyPricing({
    resolved_model: 'gpt-5-mini',
    input_tokens: 40000,
    output_tokens: 1000,
    cache_read_tokens: 0,
    cache_read_status: 'unknown',
    actual_charge_nano_aiu: 500000000,
    displayed_ai_credits: 0.8,
    displayed_credit_text: 'GPT-5 mini - 0.8 credits',
  });
  assert.equal(pricing.pricing_basis, 'actual');
  assert.equal(pricing.actual_ai_credits, 0.5);
  assert.equal(pricing.displayed_ai_credits, 0.8);
  assert.equal(pricing.selected_ai_credits, 0.5);
  assert.equal(pricing.selected_pricing_basis, 'actual');
  assert.equal(pricing.selected_source, 'totalNanoAiu');
});

test('VS Code debug log cachedTokens upgrades fallback cache-read evidence', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-vscode-debug-'));
  const workspace = path.join(tmp, 'workspaceStorage', 'workspace-a');
  const chatDir = path.join(workspace, 'chatSessions');
  const debugDir = path.join(workspace, 'GitHub.copilot-chat', 'debug-logs', 'session-debug');
  fs.mkdirSync(chatDir, { recursive: true });
  fs.mkdirSync(debugDir, { recursive: true });
  const sessionFile = path.join(chatDir, 'session-debug.jsonl');
  fs.writeFileSync(sessionFile, JSON.stringify({
    kind: 0,
    v: {
      sessionId: 'session-debug',
      inputState: { selectedModel: { metadata: { id: 'gpt-5-mini', inputCost: 25, outputCost: 200, cacheCost: 2 } } },
      requests: [{
        message: { text: 'Use debug cache data for DEMO-882.' },
        responseId: 'response-debug',
        resolvedModel: 'gpt-5-mini',
        usage: { inputTokens: 1000, outputTokens: 100 },
      }],
    },
  }) + '\n');
  fs.writeFileSync(path.join(debugDir, 'main.jsonl'), JSON.stringify({
    type: 'llm_request',
    attrs: { cachedTokens: 250 },
  }) + '\n');
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: tmp }, cwd: process.cwd() });
  await ingestFile({ dbPath: paths.usageDb, file: sessionFile, source: 'vscode-chat' });

  const usage = await queryOne(paths.usageDb, 'SELECT cache_read_tokens, cache_read_status, pricing_basis, estimate_confidence, estimated_ai_credits, pricing_diagnostics_json FROM usage_records');
  assert.equal(usage[0].cache_read_tokens, 250);
  assert.equal(usage[0].cache_read_status, 'known');
  assert.equal(usage[0].pricing_basis, 'estimated');
  assert.equal(usage[0].estimate_confidence, 'high');
  assert.equal(usage[0].estimated_ai_credits, 0.03925);
  assert.match(usage[0].pricing_diagnostics_json, /vscode_debug_cached_tokens/);
});

test('VS Code debug log is parsed once per import and enriches every eligible usage row', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-vscode-debug-reuse-'));
  const workspace = path.join(tmp, 'workspaceStorage', 'workspace-a');
  const chatDir = path.join(workspace, 'chatSessions');
  const debugDir = path.join(workspace, 'GitHub.copilot-chat', 'debug-logs', 'session-reuse');
  fs.mkdirSync(chatDir, { recursive: true });
  fs.mkdirSync(debugDir, { recursive: true });
  const sessionFile = path.join(chatDir, 'session-reuse.jsonl');
  fs.writeFileSync(sessionFile, `${JSON.stringify({
    kind: 0,
    v: {
      sessionId: 'session-reuse',
      inputState: { selectedModel: { metadata: { id: 'gpt-5-mini' } } },
      requests: [
        {
          message: { text: 'First request for DEMO-883.' },
          responseId: 'response-reuse-1',
          resolvedModel: 'gpt-5-mini',
          usage: { inputTokens: 1000, outputTokens: 100 },
        },
        {
          message: { text: 'Second request for DEMO-883.' },
          responseId: 'response-reuse-2',
          resolvedModel: 'gpt-5-mini',
          usage: { inputTokens: 500, outputTokens: 50 },
        },
      ],
    },
  })}\n`);
  fs.writeFileSync(path.join(debugDir, 'main.jsonl'), [
    JSON.stringify({ type: 'llm_request', attrs: { cachedTokens: 125, payload: 'do not persist this debug text' } }),
    JSON.stringify({ type: 'llm_request', attrs: { cachedTokens: 75 } }),
    '',
  ].join('\n'));
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: tmp }, cwd: process.cwd() });
  let parseCount = 0;

  await ingestFile({
    dbPath: paths.usageDb,
    file: sessionFile,
    source: 'vscode-chat',
    vscodeDebugOptions: {
      readJsonl(debugFile) {
        parseCount += 1;
        return readJsonl(debugFile);
      },
    },
  });

  assert.equal(parseCount, 1);
  const usage = await queryOne(paths.usageDb, `
    SELECT span_id, cache_read_tokens, cache_read_status, pricing_diagnostics_json
    FROM usage_records
    ORDER BY span_id
  `);
  assert.deepEqual(usage.map((row) => row.span_id), ['response-reuse-1', 'response-reuse-2']);
  assert.ok(usage.every((row) => row.cache_read_tokens === 200));
  assert.ok(usage.every((row) => row.cache_read_status === 'known'));
  assert.ok(usage.every((row) => row.pricing_diagnostics_json.includes('vscode_debug_cached_tokens')));
  assert.doesNotMatch(JSON.stringify(usage), /do not persist this debug text/);
});

test('VS Code debug cache preserves explicit evidence and caches absent results', () => {
  let resolveCount = 0;
  let parseCount = 0;
  const records = [
    { session_id: 'missing', cache_read_tokens: 0, cache_read_status: 'unknown', pricing_diagnostics: [] },
    { session_id: 'missing', cache_read_tokens: 0, cache_read_status: 'unknown', pricing_diagnostics: [] },
    { session_id: 'known', cache_read_tokens: 44, cache_read_status: 'known', pricing_diagnostics: ['source_evidence'] },
    { session_id: 'zero', cache_read_tokens: 0, cache_read_status: 'explicit_zero', pricing_diagnostics: ['source_evidence'] },
  ];

  const enriched = applyVscodeDebugCachedTokens(records, '/workspace/chatSessions/source.jsonl', {
    resolveDebugFile(_sourceFile, sessionId) {
      resolveCount += 1;
      return sessionId === 'missing' ? '/missing/debug.jsonl' : null;
    },
    readJsonl() {
      parseCount += 1;
      return { records: [{ line: 1, value: { type: 'unrelated' } }], warnings: [] };
    },
  });

  assert.equal(resolveCount, 1);
  assert.equal(parseCount, 1);
  assert.deepEqual(enriched, records);
});

test('normalizeVscodeFallbackUsage returns token-bearing request usage', () => {
  const parsed = readJsonl(path.join(fixtures, 'vscode-fallback-usage.jsonl'));
  const records = normalizeVscodeFallbackUsage(parsed.records);
  assert.equal(records.length, 1);
  assert.equal(records[0].session_id, 'fallback-session');
  assert.equal(records[0].input_tokens, 1400);
});

test('normalizeVscodeChatSession ignores chat labels without response ids', () => {
  const mappings = normalizeVscodeChatSession([
    { value: { kind: 0, v: { sessionId: 'chat-session', requests: [{ message: { text: 'HDASPF-404 missing response' } }] } } },
  ]);
  assert.deepEqual(mappings, []);
});

test('normalizeVscodeChatSession handles VS Code request insert and result patch records', () => {
  const parsed = readJsonl(path.join(fixtures, 'vscode-chat-session-patches.jsonl'));
  const mappings = normalizeVscodeChatSession(parsed.records);

  assert.equal(mappings.length, 1);
  assert.equal(mappings[0].responseId, 'vscode-response');
  assert.equal(mappings[0].sessionId, 'chat-session');
  assert.equal(mappings[0].label_evidence[0].label, 'HDASPF-321');
});

test('ingestFile stores Copilot session-state shutdown usage without OTel env', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-session-'));
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: tmp }, cwd: process.cwd() });
  const result = await ingestFile({
    dbPath: paths.usageDb,
    file: path.join(fixtures, 'copilot-session-events.jsonl'),
    source: 'copilot-session',
  });
  assert.equal(result.usage_records, 1);
  assert.ok(result.label_evidence >= 1);
  const usage = await queryOne(paths.usageDb, 'SELECT session_id, resolved_model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, reasoning_tokens, actual_charge_nano_aiu, actual_ai_credits, pricing_basis, cache_read_status FROM usage_records');
  assert.equal(usage[0].session_id, 'session-native');
  assert.equal(usage[0].resolved_model, 'gpt-5-mini');
  assert.equal(usage[0].input_tokens, 1200);
  assert.equal(usage[0].output_tokens, 300);
  assert.equal(usage[0].cache_read_tokens, 100);
  assert.equal(usage[0].cache_creation_tokens, 50);
  assert.equal(usage[0].reasoning_tokens, 25);
  assert.equal(usage[0].actual_charge_nano_aiu, 0);
  assert.equal(usage[0].actual_ai_credits, 0);
  assert.equal(usage[0].pricing_basis, 'actual');
  assert.equal(usage[0].cache_read_status, 'known');
  const evidence = await queryOne(paths.usageDb, "SELECT label, source_type FROM label_evidence WHERE label = 'DEMO-900'");
  assert.equal(evidence[0].source_type, 'usage');
});

test('Copilot session-state trusts nonzero totalNanoAiu as observed local charge', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-session-charge-'));
  const sessionFile = path.join(tmp, 'events.jsonl');
  fs.writeFileSync(sessionFile, [
    '{"type":"session.start","data":{"sessionId":"session-charge","context":{"cwd":"/repo/DEMO-902","gitRoot":"/repo","branch":"feature/DEMO-902"}},"id":"start1","timestamp":"2026-06-02T08:00:00.000Z"}',
    '{"type":"session.shutdown","data":{"totalPremiumRequests":0,"modelMetrics":{"gpt-5-mini":{"requests":{"count":3,"cost":0},"usage":{"inputTokens":1000,"outputTokens":200,"cacheReadTokens":100,"cacheWriteTokens":0,"reasoningTokens":0},"totalNanoAiu":974185000}}},"id":"shutdown1","timestamp":"2026-06-02T08:00:03.000Z"}',
  ].join('\n') + '\n');
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: tmp }, cwd: process.cwd() });
  await ingestFile({ dbPath: paths.usageDb, file: sessionFile, source: 'copilot-session' });

  const usage = await queryOne(paths.usageDb, 'SELECT actual_charge_nano_aiu, actual_ai_credits, actual_usd, estimated_ai_credits, pricing_basis, pricing_metadata_json, pricing_diagnostics_json FROM usage_records');
  assert.equal(usage[0].actual_charge_nano_aiu, 974185000);
  assert.equal(usage[0].actual_ai_credits, 0.974185);
  assert.equal(usage[0].actual_usd, 0.00974185);
  assert.ok(usage[0].estimated_ai_credits > 0);
  assert.equal(usage[0].pricing_basis, 'actual');
  assert.match(usage[0].pricing_metadata_json, /totalPremiumRequests/);
  assert.match(usage[0].pricing_diagnostics_json, /requests_cost_zero/);
});

test('Copilot session-state import checkpoints appended logs without dropping new usage', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-session-append-'));
  const sessionFile = path.join(tmp, 'events.jsonl');
  fs.writeFileSync(sessionFile, [
    '{"type":"session.start","data":{"sessionId":"session-append","context":{"cwd":"/repo/DEMO-901","gitRoot":"/repo","branch":"feature/DEMO-901","headCommit":"abc123"}},"id":"start1","timestamp":"2026-06-02T08:00:00.000Z"}',
    '{"type":"hook.start","data":{"input":{"prompt":"Work on DEMO-901"}},"id":"hook1","timestamp":"2026-06-02T08:00:01.000Z"}',
  ].join('\n') + '\n');
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: tmp }, cwd: process.cwd() });

  const first = await ingestFile({ dbPath: paths.usageDb, file: sessionFile, source: 'copilot-session' });
  assert.equal(first.usage_records, 0);
  assert.equal(first.new_raw_records, 2);

  fs.appendFileSync(sessionFile, '{"type":"session.shutdown","data":{"modelMetrics":{"gpt-5-mini":{"usage":{"inputTokens":500,"outputTokens":125}}}},"id":"shutdown1","timestamp":"2026-06-02T08:00:02.000Z"}\n');
  const second = await ingestFile({ dbPath: paths.usageDb, file: sessionFile, source: 'copilot-session' });
  assert.equal(second.new_raw_records, 1);
  assert.equal(second.usage_records, 1);

  const usage = await queryOne(paths.usageDb, 'SELECT session_id, branch, input_tokens, output_tokens FROM usage_records');
  assert.equal(usage[0].session_id, 'session-append');
  assert.equal(usage[0].branch, 'feature/DEMO-901');
  assert.equal(usage[0].input_tokens, 500);
  assert.equal(usage[0].output_tokens, 125);
  const evidence = await queryOne(paths.usageDb, "SELECT label, source_field FROM label_evidence WHERE label = 'DEMO-901'");
  assert.ok(evidence.length >= 1);

  const third = await ingestFile({ dbPath: paths.usageDb, file: sessionFile, source: 'copilot-session' });
  assert.equal(third.new_raw_records, 0);
  assert.equal(third.usage_records, 0);
});

function cliUsageLine(spanId, label, inputTokens = 10) {
  return JSON.stringify({
    name: 'copilot cli chat',
    spanId,
    traceId: `trace-${spanId}`,
    attributes: {
      'gen_ai.operation.name': 'chat',
      'gen_ai.request.model': 'gpt-5-mini',
      'session.id': `session-${spanId}`,
      cwd: `/repo/${label}`,
      'git.branch': `feature/${label}`,
      'gen_ai.usage.input_tokens': inputTokens,
      'gen_ai.usage.output_tokens': 5,
    },
  });
}

test('incremental ingest checkpoints bytes and reads only appended JSONL payload', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-incremental-'));
  const file = path.join(tmp, 'events.jsonl');
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: tmp }, cwd: process.cwd() });
  fs.writeFileSync(file, `${cliUsageLine('first', 'DEMO-920')}\n`);
  const first = await ingestFile({ dbPath: paths.usageDb, file, source: 'copilot-cli' });
  assert.equal(first.usage_records, 1);
  const initialSize = fs.statSync(file).size;

  fs.appendFileSync(file, `${cliUsageLine('second', 'DEMO-921')}\n`);
  const reads = [];
  const second = await ingestFile({
    dbPath: paths.usageDb,
    file,
    source: 'copilot-cli',
    jsonlReadOptions: { chunkSize: 11, onRead: (read) => reads.push(read) },
  });

  assert.equal(second.new_raw_records, 1);
  assert.equal(second.usage_records, 1);
  assert.ok(reads.filter((read) => read.purpose === 'payload').every((read) => read.position >= initialSize));
  const checkpoint = await importCheckpoint(paths.usageDb, 'copilot-cli', path.resolve(file));
  assert.equal(checkpoint.checkpoint_line, 2);
  assert.equal(checkpoint.context.jsonl.byte_offset, fs.statSync(file).size);
  assert.equal(checkpoint.context.jsonl.completed_lines, 2);
  assert.equal(checkpoint.context.file_stat.size, fs.statSync(file).size);
  assert.ok(checkpoint.context.file_stat.identity || process.platform === 'win32');
});

test('incremental ingest skips unchanged files without invoking JSONL reads', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-incremental-skip-'));
  const file = path.join(tmp, 'events.jsonl');
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: tmp }, cwd: process.cwd() });
  fs.writeFileSync(file, `${cliUsageLine('first', 'DEMO-922')}\n`);
  await ingestFile({ dbPath: paths.usageDb, file, source: 'copilot-cli' });
  const reads = [];

  const result = await ingestFile({
    dbPath: paths.usageDb,
    file,
    source: 'copilot-cli',
    jsonlReadOptions: { onRead: (read) => reads.push(read) },
  });

  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'unchanged_file');
  assert.deepEqual(reads, []);
});

test('incremental ingest resets after truncation and upgrades legacy line checkpoints', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-incremental-reset-'));
  const file = path.join(tmp, 'events.jsonl');
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: tmp }, cwd: process.cwd() });
  fs.writeFileSync(file, `${cliUsageLine('first', 'DEMO-923')}\n${cliUsageLine('second', 'DEMO-924')}\n`);
  await ingestFile({ dbPath: paths.usageDb, file, source: 'copilot-cli' });

  fs.writeFileSync(file, `${cliUsageLine('replacement', 'DEMO-925', 1)}\n`);
  const truncated = await ingestFile({ dbPath: paths.usageDb, file, source: 'copilot-cli' });
  assert.equal(truncated.usage_records, 1);
  assert.equal(truncated.skipped_existing_records, 0);

  await upsertImportCheckpoint(paths.usageDb, 'copilot-cli', path.resolve(file), 1, {
    file_stat: { size: fs.statSync(file).size, mtimeMs: Math.trunc(fs.statSync(file).mtimeMs) },
  });
  fs.appendFileSync(file, `${cliUsageLine('legacy-append', 'DEMO-926')}\n`);
  const legacy = await ingestFile({ dbPath: paths.usageDb, file, source: 'copilot-cli' });
  assert.equal(legacy.usage_records, 1);
  const checkpoint = await importCheckpoint(paths.usageDb, 'copilot-cli', path.resolve(file));
  assert.equal(checkpoint.context.jsonl.completed_lines, 2);
  assert.equal(checkpoint.context.jsonl.byte_offset, fs.statSync(file).size);

  const usage = await queryOne(paths.usageDb, 'SELECT span_id FROM usage_records ORDER BY span_id');
  assert.deepEqual(usage.map((row) => row.span_id), ['first', 'legacy-append', 'replacement', 'second']);
});

test('incremental ingest resets when a JSONL file identity changes and on explicit refresh', async (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-incremental-rotation-'));
  const file = path.join(tmp, 'events.jsonl');
  const rotated = path.join(tmp, 'rotated.jsonl');
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: tmp }, cwd: process.cwd() });
  fs.writeFileSync(file, `${cliUsageLine('first', 'DEMO-927')}\n`);
  await ingestFile({ dbPath: paths.usageDb, file, source: 'copilot-cli' });
  const before = await importCheckpoint(paths.usageDb, 'copilot-cli', path.resolve(file));
  if (!before.context.file_stat.identity) return t.skip('runtime does not expose stable file identity');

  fs.writeFileSync(rotated, `${cliUsageLine('rotated', 'DEMO-928')}\n`);
  fs.renameSync(rotated, file);
  const replacement = await ingestFile({ dbPath: paths.usageDb, file, source: 'copilot-cli' });
  assert.equal(replacement.usage_records, 1);
  assert.equal(replacement.skipped_existing_records, 0);

  fs.appendFileSync(file, `${cliUsageLine('refreshed', 'DEMO-929')}\n`);
  const refreshedAt = new Date(Date.now() + 2000);
  fs.utimesSync(file, refreshedAt, refreshedAt);
  const refreshed = await ingestFile({ dbPath: paths.usageDb, file, source: 'copilot-cli', forceRefresh: true });
  assert.equal(refreshed.usage_records, 1);
  const usage = await queryOne(paths.usageDb, 'SELECT span_id FROM usage_records');
  assert.deepEqual(new Set(usage.map((row) => row.span_id)), new Set(['first', 'rotated', 'refreshed']));
});

test('incremental and complete imports produce equivalent usage, attribution, and identities', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-incremental-equivalence-'));
  const incrementalFile = path.join(tmp, 'incremental.jsonl');
  const completeFile = path.join(tmp, 'complete.jsonl');
  const incrementalPaths = resolvePaths({ env: { COPILOT_METRICS_HOME: path.join(tmp, 'incremental-home') }, cwd: process.cwd() });
  const completePaths = resolvePaths({ env: { COPILOT_METRICS_HOME: path.join(tmp, 'complete-home') }, cwd: process.cwd() });
  const lines = [
    cliUsageLine('equivalent-first', 'DEMO-930', 21),
    cliUsageLine('equivalent-second', 'DEMO-931', 34),
  ];
  fs.writeFileSync(incrementalFile, `${lines[0]}\n`);
  await ingestFile({ dbPath: incrementalPaths.usageDb, file: incrementalFile, source: 'copilot-cli' });
  fs.appendFileSync(incrementalFile, `${lines[1]}\n`);
  await ingestFile({ dbPath: incrementalPaths.usageDb, file: incrementalFile, source: 'copilot-cli' });
  fs.writeFileSync(completeFile, `${lines.join('\n')}\n`);
  await ingestFile({ dbPath: completePaths.usageDb, file: completeFile, source: 'copilot-cli' });

  const usageSql = 'SELECT span_id, resolved_model, input_tokens, output_tokens, usage_identity FROM usage_records ORDER BY span_id';
  assert.deepEqual(
    await queryOne(incrementalPaths.usageDb, usageSql),
    await queryOne(completePaths.usageDb, usageSql),
  );
  const evidenceSql = 'SELECT label, source_field, source_value FROM label_evidence ORDER BY label, source_field, source_value';
  assert.deepEqual(
    await queryOne(incrementalPaths.usageDb, evidenceSql),
    await queryOne(completePaths.usageDb, evidenceSql),
  );
  const fingerprints = await queryOne(incrementalPaths.usageDb, 'SELECT raw_fingerprint FROM raw_records');
  assert.equal(fingerprints.length, 2);
  assert.ok(fingerprints.every((row) => /^[a-f0-9]{64}$/.test(row.raw_fingerprint)));
});

test('incremental malformed and partial lines retain complete-read warning and retry behavior', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-incremental-partial-'));
  const file = path.join(tmp, 'events.jsonl');
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: tmp }, cwd: process.cwd() });
  const first = cliUsageLine('partial-first', 'DEMO-932');
  const second = cliUsageLine('partial-second', 'DEMO-933');
  const split = Math.floor(second.length / 2);
  fs.writeFileSync(file, `${first}\nnot-json\n${second.slice(0, split)}`);

  const partial = await ingestFile({ dbPath: paths.usageDb, file, source: 'copilot-cli' });
  assert.equal(partial.usage_records, 1);
  assert.deepEqual(partial.warnings.map(({ code, line }) => ({ code, line })), [
    { code: 'malformed_jsonl', line: 2 },
  ]);
  let usage = await queryOne(paths.usageDb, 'SELECT span_id FROM usage_records ORDER BY span_id');
  assert.deepEqual(usage.map((row) => row.span_id), ['partial-first']);

  fs.appendFileSync(file, `${second.slice(split)}\n`);
  const completed = await ingestFile({ dbPath: paths.usageDb, file, source: 'copilot-cli' });
  assert.equal(completed.usage_records, 1);
  assert.deepEqual(completed.warnings, []);
  usage = await queryOne(paths.usageDb, 'SELECT span_id FROM usage_records ORDER BY span_id');
  assert.deepEqual(usage.map((row) => row.span_id), ['partial-first', 'partial-second']);

  const refreshedAt = new Date(Date.now() + 2000);
  fs.utimesSync(file, refreshedAt, refreshedAt);
  const refreshed = await ingestFile({ dbPath: paths.usageDb, file, source: 'copilot-cli', forceRefresh: true });
  assert.equal(refreshed.usage_records, 0);
  assert.equal(refreshed.duplicate_usage_records, 2);
  assert.deepEqual(refreshed.warnings.map(({ code, line }) => ({ code, line })), [
    { code: 'malformed_jsonl', line: 2 },
  ]);
});

test('incremental Copilot session imports preserve redaction and Jira evidence across resets', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-incremental-privacy-'));
  const file = path.join(tmp, 'events.jsonl');
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: tmp }, cwd: process.cwd() });
  const secret = 'private customer prompt DEMO-934 do not persist';
  const start = JSON.stringify({
    type: 'session.start',
    data: { sessionId: 'privacy-session', context: { cwd: '/repo/DEMO-934', branch: 'feature/DEMO-934' } },
    id: 'privacy-start',
  });
  const prompt = JSON.stringify({
    type: 'hook.start',
    data: { input: { prompt: secret } },
    id: 'privacy-prompt',
  });
  const shutdown = JSON.stringify({
    type: 'session.shutdown',
    data: { modelMetrics: { 'gpt-5-mini': { usage: { inputTokens: 55, outputTokens: 8 } } } },
    id: 'privacy-shutdown',
  });
  fs.writeFileSync(file, `${start}\n${prompt}\n`);
  await ingestFile({ dbPath: paths.usageDb, file, source: 'copilot-session' });
  fs.appendFileSync(file, `${shutdown}\n`);
  await ingestFile({ dbPath: paths.usageDb, file, source: 'copilot-session' });

  const raw = await queryOne(paths.usageDb, "SELECT payload_json, raw_fingerprint FROM raw_records WHERE source = 'copilot-session'");
  assert.equal(raw.length, 3);
  assert.doesNotMatch(raw.map((row) => row.payload_json).join('\n'), /private customer prompt/);
  assert.ok(raw.every((row) => /^[a-f0-9]{64}$/.test(row.raw_fingerprint)));
  const evidence = await queryOne(paths.usageDb, "SELECT label, source_field FROM label_evidence WHERE label = 'DEMO-934'");
  assert.ok(evidence.length >= 1);

  const refreshedAt = new Date(Date.now() + 2000);
  fs.utimesSync(file, refreshedAt, refreshedAt);
  const refreshed = await ingestFile({ dbPath: paths.usageDb, file, source: 'copilot-session', forceRefresh: true });
  assert.equal(refreshed.usage_records, 0);
  const usage = await queryOne(paths.usageDb, "SELECT COUNT(*) AS count, COUNT(DISTINCT usage_identity) AS identities FROM usage_records WHERE source = 'copilot-session'");
  assert.equal(usage[0].count, 1);
  assert.equal(usage[0].identities, 1);
});

test('configured source discovery keeps default fallback paths and additive custom paths', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-discovery-'));
  const custom = path.join(tmp, 'custom-chat');
  fs.mkdirSync(custom, { recursive: true });
  fs.copyFileSync(path.join(fixtures, 'vscode-fallback-usage.json'), path.join(custom, 'session.json'));
  const paths = resolvePaths({
    env: { COPILOT_METRICS_HOME: tmp, HOME: '/home/tester', COPILOT_HOME: path.join(tmp, 'copilot-home') },
    cwd: process.cwd(),
    platform: 'linux',
  });
  const entries = configuredSourceEntries(paths, {
    sources: {
      vscode: {
        additionalChatSessions: [custom],
      },
      copilotCli: {
        additionalSessions: [path.join(tmp, 'missing-session-state')],
      },
    },
  });

  assert.ok(entries.files.some((entry) => entry.source === 'vscode-chat' && entry.file.endsWith('session.json')));
  assert.ok(entries.diagnostics.some((entry) => entry.source === 'vscode-chat' && entry.file.includes('.config/Code/User/workspaceStorage')));
  assert.ok(entries.diagnostics.some((entry) => entry.source === 'copilot-session' && entry.code === 'missing_path'));
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

test('custom extractors override the built-in Jira extractor', () => {
  const evidence = runLabelExtractors('usage', { branch: 'feature/DEMO-12345' }, [
    () => [{ label: 'TEAM-42', source_field: 'branch' }],
  ]);

  assert.deepEqual(evidence.map((item) => item.label), ['TEAM-42']);
});

test('configured label patterns use the built-in metadata extractor', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-pattern-'));
  const configPath = path.join(tmp, 'config.json');
  fs.writeFileSync(configPath, `${JSON.stringify({
    labelPatterns: ['\\b(ENGREQ-\\d+)\\b'],
  })}\n`);
  const extractors = loadConfiguredExtractors(configPath, process.cwd());
  const evidence = runLabelExtractors('usage', {
    branch: 'feature/ENGREQ-42',
    cwd: '/work/DEMO-12345/ENGREQ-99',
  }, extractors);

  assert.deepEqual(evidence.map((item) => item.label).sort(), ['ENGREQ-42', 'ENGREQ-99']);
  assert.ok(evidence.some((item) => item.label === 'ENGREQ-42' && item.source_field === 'branch' && item.confidence === 0.85));
  assert.ok(evidence.every((item) => item.label !== 'DEMO-12345'));
});

test('configured label pattern accepts regex literal strings', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-pattern-'));
  const configPath = path.join(tmp, 'config.json');
  fs.writeFileSync(configPath, `${JSON.stringify({
    labelPattern: '/\\b(team_[a-z]+-\\d+)\\b/i',
  })}\n`);
  const extractors = loadConfiguredExtractors(configPath, process.cwd());
  const evidence = runLabelExtractors('hook', {
    task_hint: 'follow team_core-17 and DEMO-12345',
  }, extractors);

  assert.deepEqual(evidence.map((item) => item.label), ['TEAM_CORE-17']);
  assert.equal(evidence[0].source_field, 'task_hint');
});

test('custom extractors override configured label patterns', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-extractor-'));
  const extractorPath = path.join(tmp, 'extractor.cjs');
  fs.writeFileSync(extractorPath, `
module.exports = () => [{ label: 'TEAM-42', source_field: 'custom' }];
`);
  const configPath = path.join(tmp, 'config.json');
  fs.writeFileSync(configPath, `${JSON.stringify({
    labelPatterns: ['\\b(ENGREQ-\\d+)\\b'],
    labelExtractors: [extractorPath],
  })}\n`);
  const extractors = loadConfiguredExtractors(configPath, process.cwd());
  const evidence = runLabelExtractors('usage', { branch: 'feature/ENGREQ-42' }, extractors);

  assert.deepEqual(evidence.map((item) => item.label), ['TEAM-42']);
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
