'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

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
  assert.ok(label.estimated_ai_credits > 0);
  assert.match(label.estimate_label, /^estimate:/);
});

test('report label detail preserves source and session context', () => {
  const home = seedStore();
  const payload = JSON.parse(run(['report', 'label', 'demo-12345', '--detail', '--home', home, '--json']));
  assert.equal(payload.label.label, 'DEMO-12345');
  assert.ok(payload.details.some((row) => row.source_field === 'branch'));
  assert.ok(payload.details.some((row) => row.session_id === 's1'));
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
  assert.match(output, /DEMO-12345/);
  assert.match(output, /Costs are estimates/);
});
