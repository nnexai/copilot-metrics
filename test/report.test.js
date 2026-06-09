'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { queryOne, upsertImportCheckpoint } = require('../src/sqlite-store');

const root = path.join(__dirname, '..');
const cli = path.join(root, 'bin', 'copilot-metrics.js');
const fixtures = path.join(__dirname, 'fixtures');
const defaultCopilotHome = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-test-copilot-home-'));
const defaultUserHome = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-test-user-home-'));

function run(args) {
  return execFileSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, COPILOT_HOME: defaultCopilotHome, HOME: defaultUserHome, USERPROFILE: defaultUserHome },
  });
}

function runFailure(args) {
  try {
    run(args);
  } catch (error) {
    return {
      status: error.status,
      stderr: error.stderr.toString(),
      stdout: error.stdout.toString(),
    };
  }
  throw new Error(`Expected command to fail: ${args.join(' ')}`);
}

function seedStore() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-report-'));
  run(['import', '--source', 'vscode', '--file', path.join(fixtures, 'vscode-otel.jsonl'), '--home', tmp, '--json']);
  run(['import', '--source', 'copilot-cli', '--file', path.join(fixtures, 'copilot-cli-otel.jsonl'), '--home', tmp, '--json']);
  run(['import', '--source', 'hooks', '--file', path.join(fixtures, 'hook-events.jsonl'), '--home', tmp, '--json']);
  return tmp;
}

test('report labels returns stable JSON with evidence and estimates', () => {
  const home = seedStore();
  const payload = JSON.parse(run(['report', 'labels', '--home', home, '--json']));
  const label = payload.labels.find((row) => row.label === 'DEMO-12345');
  assert.ok(label);
  assert.ok(label.evidence_count >= 2);
  assert.ok(label.sessions >= 1);
  assert.ok(label.usage_records >= 1);
  assert.equal(label.cache_read_tokens, 200);
  assert.equal(label.cache_creation_tokens, 100);
  assert.equal(label.reasoning_tokens, 50);
  assert.equal(label.token_status, 'token-bearing');
  assert.equal(label.usage_status, 'usage');
  assert.ok(label.estimated_ai_credits > 0);
  assert.ok(label.estimated_usd > 0);
  assert.match(label.estimate_label, /^estimate:/);
  assert.equal(label.confidence.scoring_version, 'label-confidence:v1');
  assert.ok(label.confidence.ranked_sessions >= 1);
  assert.ok(label.confidence.distinct_evidence_count >= 1);
  assert.ok(label.confidence.source_summary.length >= 1);
});

test('report labels initializes an empty store instead of exposing sqlite errors', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-empty-report-'));
  const payload = JSON.parse(run(['report', 'labels', '--home', home, '--json']));
  assert.deepEqual(payload.labels, []);
  assert.ok(fs.existsSync(path.join(home, 'store', 'copilot-metrics.sqlite')));
});

test('report label detail preserves source and session context', () => {
  const home = seedStore();
  const payload = JSON.parse(run(['report', 'label', 'demo-12345', '--detail', '--home', home, '--json']));
  assert.equal(payload.label.label, 'DEMO-12345');
  assert.ok(payload.models.some((row) => row.model === 'gpt-5.4'));
  assert.equal(payload.label.cache_read_tokens, 200);
  assert.equal(payload.label.cache_creation_tokens, 100);
  assert.equal(payload.label.reasoning_tokens, 50);
  assert.ok(payload.details.some((row) => row.source_field === 'branch'));
  assert.ok(payload.details.some((row) => row.session_id === 's1'));
  assert.ok(payload.details.some((row) => row.cache_read_tokens === 200));
  assert.equal(payload.label.confidence.scoring_version, 'label-confidence:v1');
  assert.ok(payload.label.confidence.best_rank >= 1);
});

test('manual label CLI stores active assignments and returns post-operation JSON', async () => {
  const home = seedStore();
  const dbPath = path.join(home, 'store', 'copilot-metrics.sqlite');

  const empty = JSON.parse(run(['label', 's1', 'list', '--home', home, '--json']));
  assert.deepEqual(empty, {
    session_id: 's1',
    manual_labels: [],
    operation: 'list',
    changed: false,
  });

  const added = JSON.parse(run(['label', 's1', 'add', 'demo-222', 'DEMO-333', '--home', home, '--json']));
  assert.deepEqual(added.manual_labels, ['DEMO-222', 'DEMO-333']);
  assert.equal(added.operation, 'add');
  assert.equal(added.changed, true);

  const duplicate = JSON.parse(run(['label', 's1', 'add', 'DEMO-222', '--home', home, '--json']));
  assert.deepEqual(duplicate.manual_labels, ['DEMO-222', 'DEMO-333']);
  assert.equal(duplicate.changed, false);

  const removedMissing = JSON.parse(run(['label', 's1', 'remove', 'DEMO-404', '--home', home, '--json']));
  assert.deepEqual(removedMissing.manual_labels, ['DEMO-222', 'DEMO-333']);
  assert.equal(removedMissing.changed, false);

  const removed = JSON.parse(run(['label', 's1', 'remove', 'DEMO-222', '--home', home, '--json']));
  assert.deepEqual(removed.manual_labels, ['DEMO-333']);
  assert.equal(removed.changed, true);

  const set = JSON.parse(run(['label', 's1', 'set', 'demo-999', '--home', home, '--json']));
  assert.deepEqual(set.manual_labels, ['DEMO-999']);
  assert.equal(set.changed, true);
  let rows = await queryOne(dbPath, 'SELECT label FROM manual_label_assignments WHERE session_id = "s1" ORDER BY label');
  assert.deepEqual(rows.map((row) => row.label), ['DEMO-999']);

  const cleared = JSON.parse(run(['label', 's1', 'clear', '--home', home, '--json']));
  assert.deepEqual(cleared.manual_labels, []);
  assert.equal(cleared.changed, true);
  rows = await queryOne(dbPath, 'SELECT label FROM manual_label_assignments WHERE session_id = "s1"');
  assert.deepEqual(rows, []);

  const evidence = await queryOne(dbPath, 'SELECT COUNT(*) AS count FROM label_evidence WHERE session_id = "s1"');
  assert.ok(evidence[0].count > 0);
});

test('manual labels take report precedence while preserving automatic evidence', async () => {
  const home = seedStore();
  const dbPath = path.join(home, 'store', 'copilot-metrics.sqlite');
  const beforeEvidence = await queryOne(dbPath, 'SELECT COUNT(*) AS count FROM label_evidence WHERE session_id = "session-cli"');

  run(['label', 'session-cli', 'set', 'DEMO-902', 'DEMO-901', '--home', home, '--json']);

  const overview = JSON.parse(run(['report', 'labels', '--home', home, '--json']));
  const manualTop = overview.labels.find((row) => row.label === 'DEMO-901');
  const secondManual = overview.labels.find((row) => row.label === 'DEMO-902');
  assert.ok(manualTop);
  assert.equal(manualTop.usage_records, 1);
  assert.equal(manualTop.confidence.best_rank, 1);
  assert.equal(secondManual, undefined);

  const topK = JSON.parse(run(['report', 'label', 'DEMO-902', '--top-k', '2', '--session-detail', '--home', home, '--json']));
  assert.equal(topK.label.usage_records, 1);
  assert.ok(topK.session_details.some((row) => row.session_id === 'session-cli' && row.requested_label_rank === 2));
  assert.ok(topK.session_details[0].confidence.evidence.some((item) => item.source_field === 'manual' && item.created_at && item.updated_at));

  const autoDefault = JSON.parse(run(['report', 'label', 'DEMO-200', '--session-detail', '--home', home, '--json']));
  assert.equal(autoDefault.session_details.some((row) => row.session_id === 'session-cli'), false);
  const autoAll = JSON.parse(run(['report', 'label', 'DEMO-200', '--all-matches', '--session-detail', '--home', home, '--json']));
  assert.ok(autoAll.session_details.some((row) => row.session_id === 'session-cli' && row.requested_label_rank > 2));

  const detail = JSON.parse(run(['report', 'label', 'DEMO-901', '--detail', '--home', home, '--json']));
  const manualDetail = detail.details.find((row) => row.session_id === 'session-cli' && row.source_field === 'manual');
  assert.ok(manualDetail);
  assert.ok(manualDetail.created_at);
  assert.ok(manualDetail.updated_at);

  run(['label', 'session-cli', 'set', 'DEMO-999', '--home', home, '--json']);
  const replacedOverview = JSON.parse(run(['report', 'labels', '--home', home, '--json']));
  assert.equal(replacedOverview.labels.some((row) => row.label === 'DEMO-901'), false);
  assert.ok(replacedOverview.labels.some((row) => row.label === 'DEMO-999'));
  const staleDetail = JSON.parse(run(['report', 'label', 'DEMO-901', '--detail', '--home', home, '--json']));
  assert.equal(staleDetail.details.some((row) => row.source_field === 'manual'), false);

  run(['label', 'session-cli', 'clear', '--home', home, '--json']);
  const clearedAuto = JSON.parse(run(['report', 'label', 'DEMO-200', '--session-detail', '--home', home, '--json']));
  assert.ok(clearedAuto.session_details.some((row) => row.session_id === 'session-cli' && row.requested_label_rank === 1));
  const clearedManual = JSON.parse(run(['report', 'label', 'DEMO-999', '--detail', '--home', home, '--json']));
  assert.equal(clearedManual.details.some((row) => row.source_field === 'manual'), false);

  const afterEvidence = await queryOne(dbPath, 'SELECT COUNT(*) AS count FROM label_evidence WHERE session_id = "session-cli"');
  assert.equal(afterEvidence[0].count, beforeEvidence[0].count);
});

test('manual-only labeled sessions are attributed in reports', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-manual-only-'));
  run(['import', '--source', 'vscode', '--file', path.join(fixtures, 'vscode-log-records.jsonl'), '--home', home, '--json']);
  run(['label', 'otel-session', 'set', 'DEMO-777', '--home', home, '--json']);

  const overview = JSON.parse(run(['report', 'labels', '--home', home, '--json']));
  const manual = overview.labels.find((row) => row.label === 'DEMO-777');
  assert.ok(manual);
  assert.equal(manual.usage_records, 1);
  assert.equal(manual.confidence.source_summary.some((item) => item.source === 'manual'), true);

  const unattributed = JSON.parse(run(['report', 'unattributed', '--home', home, '--json']));
  assert.equal(unattributed.unattributed.some((row) => row.session_id === 'otel-session'), false);
});

test('manual label CLI rejects unknown sessions and empty labels', () => {
  const home = seedStore();

  const unknown = runFailure(['label', 'missing-session', 'add', 'DEMO-1', '--home', home, '--json']);
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /Unknown session_id "missing-session"/);

  const empty = runFailure(['label', 's1', 'add', '', '--home', home, '--json']);
  assert.equal(empty.status, 1);
  assert.match(empty.stderr, /Manual labels must be non-empty/);

  const noLabels = runFailure(['label', 's1', 'set', '--home', home, '--json']);
  assert.equal(noLabels.status, 1);
  assert.match(noLabels.stderr, /label set requires at least one label/);
});

test('report surfaces expose session ids for manual correction workflow', () => {
  const home = seedStore();

  const detail = JSON.parse(run(['report', 'label', 'DEMO-12345', '--detail', '--home', home, '--json']));
  assert.ok(detail.details.some((row) => row.session_id === 's1'));

  const unattributedHome = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-unattributed-session-'));
  run(['import', '--source', 'vscode', '--file', path.join(fixtures, 'vscode-log-records.jsonl'), '--home', unattributedHome, '--json']);
  const unattributed = JSON.parse(run(['report', 'unattributed', '--home', unattributedHome, '--json']));
  assert.ok(unattributed.unattributed.some((row) => row.session_id === 'otel-session'));
});

test('reports auto-import configured JSONL sources idempotently', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-auto-report-'));
  fs.mkdirSync(path.join(home, 'telemetry'), { recursive: true });
  fs.mkdirSync(path.join(home, 'hooks'), { recursive: true });
  fs.mkdirSync(path.join(home, 'copilot-home', 'session-state', 'session-native'), { recursive: true });
  fs.copyFileSync(path.join(fixtures, 'vscode-otel.jsonl'), path.join(home, 'telemetry', 'vscode-copilot-otel.jsonl'));
  fs.copyFileSync(path.join(fixtures, 'copilot-cli-otel.jsonl'), path.join(home, 'telemetry', 'copilot-cli-otel.jsonl'));
  fs.copyFileSync(path.join(fixtures, 'hook-events.jsonl'), path.join(home, 'hooks', 'copilot-hooks.jsonl'));
  fs.copyFileSync(path.join(fixtures, 'copilot-session-events.jsonl'), path.join(home, 'copilot-home', 'session-state', 'session-native', 'events.jsonl'));

  const env = {
    ...process.env,
    COPILOT_HOME: path.join(home, 'copilot-home'),
    HOME: path.join(home, 'user-home'),
    USERPROFILE: path.join(home, 'user-home'),
  };
  const first = JSON.parse(execFileSync(process.execPath, [cli, 'report', 'labels', '--home', home, '--json'], { cwd: root, encoding: 'utf8', env }));
  const second = JSON.parse(execFileSync(process.execPath, [cli, 'report', 'labels', '--home', home, '--json'], { cwd: root, encoding: 'utf8', env }));
  assert.deepEqual(second.labels, first.labels);
  assert.ok(first.labels.some((row) => row.label === 'DEMO-900' && row.usage_records === 1 && row.input_tokens === 1200));

  const rows = await queryOne(path.join(home, 'store', 'copilot-metrics.sqlite'), 'SELECT COUNT(*) AS count FROM usage_records');
  assert.equal(rows[0].count, 4);
});

test('report --refresh re-reads configured sources and merges new debug pricing evidence', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-refresh-report-'));
  const userHome = path.join(home, 'user-home');
  const workspace = path.join(userHome, '.config', 'Code - Insiders', 'User', 'workspaceStorage', 'workspace-a');
  const chatDir = path.join(workspace, 'chatSessions');
  const debugDir = path.join(workspace, 'GitHub.copilot-chat', 'debug-logs', 'session-refresh');
  fs.mkdirSync(chatDir, { recursive: true });
  fs.mkdirSync(debugDir, { recursive: true });
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify({
    sources: {
      vscode: {
        additionalChatSessions: [chatDir],
      },
    },
  }, null, 2));
  fs.writeFileSync(path.join(chatDir, 'session-refresh.jsonl'), JSON.stringify({
    kind: 0,
    v: {
      sessionId: 'session-refresh',
      inputState: { selectedModel: { metadata: { id: 'gpt-5-mini', inputCost: 25, outputCost: 200, cacheCost: 2 } } },
      requests: [{
        message: { text: 'Refresh DEMO-883 pricing evidence.' },
        responseId: 'response-refresh',
        resolvedModel: 'gpt-5-mini',
        usage: { inputTokens: 1000, outputTokens: 100 },
      }],
    },
  }) + '\n');

  const env = {
    ...process.env,
    COPILOT_HOME: path.join(home, 'copilot-home'),
    HOME: userHome,
    USERPROFILE: userHome,
  };
  const first = JSON.parse(execFileSync(process.execPath, [cli, 'report', 'labels', '--home', home, '--json'], { cwd: root, encoding: 'utf8', env }));
  assert.equal(first.labels.find((row) => row.label === 'DEMO-883').upper_bound_usage_records, 1);

  fs.writeFileSync(path.join(debugDir, 'main.jsonl'), JSON.stringify({
    type: 'llm_request',
    attrs: { cachedTokens: 250 },
  }) + '\n');
  const second = JSON.parse(execFileSync(process.execPath, [cli, 'report', 'labels', '--refresh', '--home', home, '--json'], { cwd: root, encoding: 'utf8', env }));
  const refreshed = second.labels.find((row) => row.label === 'DEMO-883');
  assert.equal(refreshed.usage_records, 1);
  assert.equal(refreshed.cache_read_tokens, 250);
  assert.equal(refreshed.upper_bound_usage_records, 0);

  const rows = await queryOne(path.join(home, 'store', 'copilot-metrics.sqlite'), 'SELECT COUNT(*) AS count, cache_read_tokens, cache_read_status FROM usage_records');
  assert.equal(rows[0].count, 1);
  assert.equal(rows[0].cache_read_tokens, 250);
  assert.equal(rows[0].cache_read_status, 'known');
});

test('report --refresh merges displayed-credit evidence without duplicate usage', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-display-refresh-report-'));
  const userHome = path.join(home, 'user-home');
  const workspace = path.join(userHome, '.config', 'Code - Insiders', 'User', 'workspaceStorage', 'workspace-a');
  const chatDir = path.join(workspace, 'chatSessions');
  fs.mkdirSync(chatDir, { recursive: true });
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify({
    sources: {
      vscode: {
        additionalChatSessions: [chatDir],
      },
    },
  }, null, 2));
  const sessionFile = path.join(chatDir, 'session-display-refresh.jsonl');
  const baseRecord = {
    kind: 0,
    v: {
      sessionId: 'session-display-refresh',
      inputState: { selectedModel: { metadata: { id: 'gpt-5-mini', inputCost: 25, outputCost: 200, cacheCost: 2 } } },
      requests: [{
        message: { text: 'Refresh DEMO-886 displayed credit evidence.' },
        responseId: 'response-display-refresh',
        resolvedModel: 'gpt-5-mini',
        usage: { inputTokens: 40000, outputTokens: 1000 },
      }],
    },
  };
  fs.writeFileSync(sessionFile, JSON.stringify(baseRecord) + '\n');

  const env = {
    ...process.env,
    COPILOT_HOME: path.join(home, 'copilot-home'),
    HOME: userHome,
    USERPROFILE: userHome,
  };
  const first = JSON.parse(execFileSync(process.execPath, [cli, 'report', 'labels', '--home', home, '--json'], { cwd: root, encoding: 'utf8', env }));
  assert.equal(first.labels.find((row) => row.label === 'DEMO-886').upper_bound_usage_records, 1);

  baseRecord.v.requests[0].result = { details: 'GPT-5 mini - 0.8 credit' };
  fs.writeFileSync(sessionFile, JSON.stringify(baseRecord) + '\n');
  const second = JSON.parse(execFileSync(process.execPath, [cli, 'report', 'labels', '--refresh', '--home', home, '--json'], { cwd: root, encoding: 'utf8', env }));
  const refreshed = second.labels.find((row) => row.label === 'DEMO-886');
  assert.equal(refreshed.usage_records, 1);
  assert.equal(refreshed.displayed_credit_usage_records, 1);
  assert.equal(refreshed.displayed_ai_credits, 0.8);
  assert.equal(refreshed.selected_ai_credits, 0.8);
  assert.equal(refreshed.selected_pricing_basis, 'displayed_credit');
  assert.ok(refreshed.estimated_ai_credits > refreshed.selected_ai_credits);
  assert.ok(refreshed.inferred_cache_read_tokens > 0);
  assert.equal(refreshed.upper_bound_usage_records, 0);

  const rows = await queryOne(path.join(home, 'store', 'copilot-metrics.sqlite'), 'SELECT COUNT(*) AS count, pricing_basis, displayed_ai_credits, selected_ai_credits FROM usage_records');
  assert.equal(rows[0].count, 1);
  assert.equal(rows[0].pricing_basis, 'displayed_credit');
  assert.equal(rows[0].displayed_ai_credits, 0.8);
  assert.equal(rows[0].selected_ai_credits, 0.8);

  const third = JSON.parse(execFileSync(process.execPath, [cli, 'report', 'labels', '--refresh', '--home', home, '--json'], { cwd: root, encoding: 'utf8', env }));
  assert.deepEqual(third.labels.find((row) => row.label === 'DEMO-886'), refreshed);
});

test('report --refresh skips unchanged historical VS Code chat files without stat checkpoints', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-stale-refresh-report-'));
  const userHome = path.join(home, 'user-home');
  const workspace = path.join(userHome, '.config', 'Code - Insiders', 'User', 'workspaceStorage', 'workspace-a');
  const chatDir = path.join(workspace, 'chatSessions');
  fs.mkdirSync(chatDir, { recursive: true });
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify({
    sources: {
      vscode: {
        additionalChatSessions: [chatDir],
      },
    },
  }, null, 2));
  const sessionFile = path.join(chatDir, 'session-stale-refresh.jsonl');
  fs.writeFileSync(sessionFile, JSON.stringify({
    kind: 0,
    v: {
      sessionId: 'session-stale-refresh',
      requests: [{
        message: { text: 'Historical DEMO-889 refresh evidence.' },
        responseId: 'response-stale-refresh',
        resolvedModel: 'gpt-5-mini',
        usage: { inputTokens: 1000, outputTokens: 100 },
      }],
    },
  }) + '\n');

  const oldTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  fs.utimesSync(sessionFile, oldTime, oldTime);

  const env = {
    ...process.env,
    COPILOT_HOME: path.join(home, 'copilot-home'),
    HOME: userHome,
    USERPROFILE: userHome,
  };
  const first = JSON.parse(execFileSync(process.execPath, [cli, 'report', 'labels', '--home', home, '--json'], { cwd: root, encoding: 'utf8', env }));
  const original = first.labels.find((row) => row.label === 'DEMO-889');
  assert.ok(original);

  await upsertImportCheckpoint(path.join(home, 'store', 'copilot-metrics.sqlite'), 'vscode-chat', path.resolve(sessionFile), 1, {});

  const second = JSON.parse(execFileSync(process.execPath, [cli, 'report', 'labels', '--refresh', '--home', home, '--json'], { cwd: root, encoding: 'utf8', env }));
  assert.deepEqual(second.labels.find((row) => row.label === 'DEMO-889'), original);

  const escapedFile = path.resolve(sessionFile).replace(/'/g, "''");
  const rows = await queryOne(
    path.join(home, 'store', 'copilot-metrics.sqlite'),
    `SELECT COUNT(*) AS count FROM raw_records WHERE source = 'vscode-chat' AND source_file = '${escapedFile}'`,
  );
  assert.equal(rows[0].count, 1);
});

test('hook-only labels are visible without implying token usage', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-hook-only-'));
  run(['import', '--source', 'hooks', '--file', path.join(fixtures, 'hook-events.jsonl'), '--home', home, '--json']);
  const payload = JSON.parse(run(['report', 'labels', '--home', home, '--json']));
  assert.equal(payload.inclusion.mode, 'top-label');
  assert.equal(payload.inclusion.overlap, false);
  assert.equal(payload.labels.some((row) => row.label === 'DEMO-54321'), false);
  const specific = JSON.parse(run(['report', 'label', 'DEMO-54321', '--all-matches', '--home', home, '--json']));
  const label = specific.label;
  assert.ok(label);
  assert.equal(label.usage_records, 0);
  assert.equal(label.input_tokens, 0);
  assert.equal(label.output_tokens, 0);
  assert.equal(label.token_status, 'hook-only');
  assert.equal(label.usage_status, 'evidence-only');
  assert.equal(specific.inclusion.mode, 'all-matches');
  assert.equal(specific.inclusion.overlap, true);
  const output = run(['report', 'label', 'DEMO-54321', '--all-matches', '--home', home]);
  assert.match(output, /evidence-only/);
});

test('specific label reports default to rank-1 and broaden with top-k', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-top-k-'));
  run(['import', '--source', 'hooks', '--file', path.join(fixtures, 'hook-events.jsonl'), '--home', home, '--json']);

  const topOnly = JSON.parse(run(['report', 'label', 'DEMO-54321', '--home', home, '--json']));
  assert.equal(topOnly.inclusion.mode, 'top-label');
  assert.equal(topOnly.inclusion.overlap, false);
  assert.equal(topOnly.label.usage_records, 0);
  assert.equal(topOnly.label.sessions, 0);
  assert.equal(topOnly.label.confidence.best_rank, 2);

  const topK = JSON.parse(run(['report', 'label', 'DEMO-54321', '--top-k', '2', '--home', home, '--json']));
  assert.equal(topK.inclusion.mode, 'top-k');
  assert.equal(topK.inclusion.top_k, 2);
  assert.equal(topK.inclusion.overlap, true);
  assert.equal(topK.label.sessions, 1);
  assert.equal(topK.label.usage_status, 'evidence-only');
});

test('specific label session-detail returns one aggregate row per included session', () => {
  const home = seedStore();
  const payload = JSON.parse(run(['report', 'label', 'DEMO-12345', '--session-detail', '--home', home, '--json']));
  assert.equal(payload.inclusion.mode, 'top-label');
  assert.ok(payload.session_details.length >= 1);
  const row = payload.session_details.find((item) => item.session_id === 's1');
  assert.ok(row);
  assert.equal(row.top_label, 'DEMO-12345');
  assert.equal(row.requested_label_rank, 1);
  const tokenRow = payload.session_details.find((item) => item.input_tokens > 0);
  assert.ok(tokenRow);
  assert.ok(tokenRow.model_count >= 1);
  assert.ok(Array.isArray(row.models));
  assert.ok(row.confidence_score > 0);
  assert.ok(row.evidence_summary.length >= 1);

  const output = run(['report', 'label', 'DEMO-12345', '--session-detail', '--home', home]);
  assert.match(output, /Session\s+Top\s+Rank/);
});

test('model, repo, and unattributed reports expose local usage only', () => {
  const home = seedStore();
  const models = JSON.parse(run(['report', 'models', '--home', home, '--json']));
  assert.ok(models.models.some((row) => row.model === 'gpt-5.4'));

  const repos = JSON.parse(run(['report', 'repos', '--home', home, '--json']));
  assert.ok(repos.repos.some((row) => row.repo === 'copilot-metrics'));

  const unattributed = JSON.parse(run(['report', 'unattributed', '--home', home, '--json']));
  assert.ok(unattributed.unattributed.some((row) => row.id));
  assert.equal(Object.hasOwn(unattributed.unattributed[0], 'prompt'), false);
});

test('human report output is compact and labels costs as estimates', () => {
  const home = seedStore();
  const output = run(['report', 'labels', '--home', home]);
  assert.match(output, /Label\s+Sess/);
  assert.match(output, /C read/);
  assert.match(output, /Think/);
  assert.match(output, /DEMO-12345/);
  assert.match(output, /AI Credits are estimates/);
  assert.match(output, /Status/);
  assert.match(output, /\$ sel\./);
});

test('human reports mark displayed-credit basis compactly', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-display-human-'));
  const sessionFile = path.join(home, 'session.jsonl');
  fs.writeFileSync(sessionFile, JSON.stringify({
    kind: 0,
    v: {
      sessionId: 'session-display-human',
      requests: [{
        message: { text: 'Show DEMO-887 displayed basis.' },
        responseId: 'response-display-human',
        resolvedModel: 'gpt-5-mini',
        usage: { inputTokens: 40000, outputTokens: 1000 },
        result: { details: 'GPT-5 mini - 0.8 credits' },
      }],
    },
  }) + '\n');
  run(['import', '--source', 'vscode-chat', '--file', sessionFile, '--home', home, '--json']);
  const output = run(['report', 'labels', '--home', home]);
  assert.match(output, /display\*/);
  assert.match(output, /VS Code displayed credits/);
});

test('single label human report includes per-model breakdown by default', () => {
  const home = seedStore();
  const output = run(['report', 'label', 'DEMO-12345', '--home', home]);
  assert.match(output, /Model\s+Sess\s+Use/);
  assert.match(output, /gpt-5\.4/);
  assert.match(output, /Cr sel\./);
  assert.match(output, /\$ sel\./);
});
