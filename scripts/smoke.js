#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '..');
const cli = path.join(root, 'bin', 'copilot-metrics.js');
const fixtures = path.join(root, 'test', 'fixtures');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-smoke-'));
const userHome = path.join(home, 'user-home');
const copilotHome = path.join(home, 'copilot-home');

function run(args) {
  return execFileSync(process.execPath, [cli, ...args, '--home', home], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: userHome,
      USERPROFILE: userHome,
      COPILOT_HOME: copilotHome,
    },
  });
}

try {
  JSON.parse(run(['init', '--json']));
  JSON.parse(run(['import', '--source', 'vscode', '--file', path.join(fixtures, 'vscode-otel.jsonl'), '--json']));
  JSON.parse(run(['import', '--source', 'copilot-cli', '--file', path.join(fixtures, 'copilot-cli-otel.jsonl'), '--json']));
  JSON.parse(run(['import', '--source', 'hooks', '--file', path.join(fixtures, 'hook-events.jsonl'), '--json']));

  const labels = JSON.parse(run(['report', 'labels', '--json']));
  const demo = labels.labels.find((row) => row.label === 'DEMO-12345');
  assert.ok(demo, 'expected DEMO-12345 in label overview');
  assert.ok(demo.input_tokens > 0, 'expected DEMO-12345 input tokens');
  assert.match(demo.estimate_label, /^estimate:/);

  const detail = JSON.parse(run(['report', 'label', 'DEMO-12345', '--detail', '--json']));
  assert.equal(detail.label.label, 'DEMO-12345');
  assert.ok(detail.details.some((row) => row.source_field === 'branch'));

  const unattributed = run(['report', 'unattributed']);
  assert.match(unattributed, /AI Credits are estimates/);

  process.stdout.write(`Smoke passed: ${home}\n`);
} finally {
  fs.rmSync(home, { recursive: true, force: true });
}
