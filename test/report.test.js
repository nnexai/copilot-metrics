'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { queryOne } = require('../src/sqlite-store');

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

test('hook-only labels are visible without implying token usage', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-hook-only-'));
  run(['import', '--source', 'hooks', '--file', path.join(fixtures, 'hook-events.jsonl'), '--home', home, '--json']);
  const payload = JSON.parse(run(['report', 'labels', '--home', home, '--json']));
  const label = payload.labels.find((row) => row.label === 'DEMO-54321');
  assert.ok(label);
  assert.equal(label.usage_records, 0);
  assert.equal(label.input_tokens, 0);
  assert.equal(label.output_tokens, 0);
  assert.equal(label.token_status, 'hook-only');
  assert.equal(label.usage_status, 'evidence-only');
  const output = run(['report', 'labels', '--home', home]);
  assert.match(output, /evidence-only/);
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
  assert.match(output, /\$ est\./);
});

test('single label human report includes per-model breakdown by default', () => {
  const home = seedStore();
  const output = run(['report', 'label', 'DEMO-12345', '--home', home]);
  assert.match(output, /Model\s+Sess\s+Use/);
  assert.match(output, /gpt-5\.4/);
  assert.match(output, /Cr est\./);
  assert.match(output, /\$ est\./);
});
