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
  backfillVscodeUsageResponseIds,
  configuredSourceEntries,
  ingestFile,
  normalizeVscodeFallbackUsage,
  normalizeVscodeChatSession,
  repairUsageCostEstimates,
} = require('../src/ingest');
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

  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(paths.usageDb));
  db.run("UPDATE usage_records SET span_id = NULL, session_id = NULL, timestamp = NULL WHERE source = 'vscode'");
  fs.writeFileSync(paths.usageDb, Buffer.from(db.export()));

  const updated = await backfillVscodeUsageResponseIds(paths.usageDb, path.resolve(file));
  assert.equal(updated, 1);

  const usage = await queryOne(paths.usageDb, 'SELECT span_id, session_id, timestamp FROM usage_records WHERE source = "vscode"');
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

  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(paths.usageDb));
  db.run("UPDATE usage_records SET estimated_usd = 0, estimated_ai_credits = 0, warnings_json = '[\"unknown_model:gpt-5-mini-2025-08-07\"]'");
  fs.writeFileSync(paths.usageDb, Buffer.from(db.export()));

  const updated = await repairUsageCostEstimates(paths.usageDb);
  assert.equal(updated, 1);

  const usage = await queryOne(paths.usageDb, 'SELECT estimated_usd, estimated_ai_credits, warnings_json FROM usage_records');
  assert.equal(usage[0].estimated_usd, 0.0099);
  assert.equal(usage[0].estimated_ai_credits, 0.99);
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
  const rows = await queryOne(paths.usageDb, 'SELECT COUNT(*) AS count, SUM(input_tokens) AS input FROM usage_records');
  assert.equal(rows[0].count, 1);
  assert.equal(rows[0].input, 30000);
  const evidence = await queryOne(paths.usageDb, "SELECT label, usage_record_id FROM label_evidence WHERE label = 'HDASPF-321'");
  assert.ok(evidence.length >= 1);
  assert.equal(new Set(evidence.map((row) => row.usage_record_id)).size, 1);
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
  const usage = await queryOne(paths.usageDb, 'SELECT session_id, resolved_model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, reasoning_tokens FROM usage_records');
  assert.equal(usage[0].session_id, 'session-native');
  assert.equal(usage[0].resolved_model, 'gpt-5-mini');
  assert.equal(usage[0].input_tokens, 1200);
  assert.equal(usage[0].output_tokens, 300);
  assert.equal(usage[0].cache_read_tokens, 100);
  assert.equal(usage[0].cache_creation_tokens, 50);
  assert.equal(usage[0].reasoning_tokens, 25);
  const evidence = await queryOne(paths.usageDb, "SELECT label, source_type FROM label_evidence WHERE label = 'DEMO-900'");
  assert.equal(evidence[0].source_type, 'usage');
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
