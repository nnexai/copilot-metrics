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

function run(args) {
  return execFileSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: 'utf8',
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
  assert.ok(label.estimated_ai_credits > 0);
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
  fs.copyFileSync(path.join(fixtures, 'vscode-otel.jsonl'), path.join(home, 'telemetry', 'vscode-copilot-otel.jsonl'));
  fs.copyFileSync(path.join(fixtures, 'copilot-cli-otel.jsonl'), path.join(home, 'telemetry', 'copilot-cli-otel.jsonl'));
  fs.copyFileSync(path.join(fixtures, 'hook-events.jsonl'), path.join(home, 'hooks', 'copilot-hooks.jsonl'));

  const first = JSON.parse(run(['report', 'labels', '--home', home, '--json']));
  const second = JSON.parse(run(['report', 'labels', '--home', home, '--json']));
  assert.deepEqual(second.labels, first.labels);

  const rows = await queryOne(path.join(home, 'store', 'copilot-metrics.sqlite'), 'SELECT COUNT(*) AS count FROM usage_records');
  assert.equal(rows[0].count, 3);
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
  const output = run(['report', 'labels', '--home', home]);
  assert.match(output, /hook-only/);
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
  assert.match(output, /Label\s+Sessions/);
  assert.match(output, /Cache read/);
  assert.match(output, /Reasoning/);
  assert.match(output, /DEMO-12345/);
  assert.match(output, /Costs are estimates/);
});
