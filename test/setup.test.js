'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { resolvePaths } = require('../src/paths');
const { vscodeSettings, copilotCliEnvironment, hookConfig, installHook } = require('../src/setup');
const { appendHookEvent, redactHookPayload } = require('../src/hook-logger');

test('resolvePaths uses COPILOT_METRICS_HOME override', () => {
  const home = path.join(os.tmpdir(), 'copilot-metrics-test-home');
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: home }, cwd: '/tmp/work' });
  assert.equal(paths.home, home);
  assert.equal(paths.vscodeOtelJsonl, path.join(home, 'telemetry', 'vscode-copilot-otel.jsonl'));
  assert.equal(paths.hookEventsJsonl, path.join(home, 'hooks', 'copilot-cli-hooks.jsonl'));
});

test('setup snippets disable content capture by default', () => {
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: '/tmp/copilot-metrics' }, cwd: '/tmp/work' });
  const vscode = vscodeSettings(paths);
  const cli = copilotCliEnvironment(paths);
  assert.equal(vscode['github.copilot.chat.otel.contentCapture'], false);
  assert.equal(cli.COPILOT_OTEL_CONTENT_CAPTURE, 'false');
});

test('hook config covers lifecycle events and points back to hook-log', () => {
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: '/tmp/copilot-metrics' }, cwd: '/tmp/work' });
  const config = hookConfig(paths, { cwd: '/repo', scope: 'local' });
  for (const event of ['sessionStart', 'userPromptSubmitted', 'postToolUse', 'agentStop', 'errorOccurred']) {
    assert.equal(config.events[event].command, 'node');
    assert.ok(config.events[event].args.includes('hook-log'));
    assert.ok(config.events[event].args.includes(event));
  }
  assert.equal(config.contentCapture, false);
});

test('installHook writes local and global hook files', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-hooks-'));
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: path.join(tmp, 'home') }, cwd: tmp });
  const local = installHook(paths, { cwd: tmp, scope: 'local' });
  assert.equal(local.target, path.join(tmp, '.github', 'hooks', 'copilot-metrics.json'));
  assert.ok(fs.existsSync(local.target));
});

test('hook logger redacts raw prompt content and extracts Jira labels', () => {
  const payload = {
    event: 'userPromptSubmitted',
    sessionId: 's1',
    cwd: '/work/HDASPF-12345',
    prompt: 'Please fix HDASPF-12345 and include secret implementation details',
  };
  const redacted = redactHookPayload(payload, { event: 'userPromptSubmitted' });
  assert.deepEqual(redacted.labels, ['HDASPF-12345']);
  assert.equal(redacted.prompt_preview, undefined);
  assert.equal(redacted.raw_prompt_stored, false);
});

test('appendHookEvent writes JSONL', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-log-'));
  const result = appendHookEvent(
    { event: 'agentStop', cwd: '/repo', branch: 'feature/HDASPF-222' },
    { env: { COPILOT_METRICS_HOME: tmp }, cwd: '/repo' },
  );
  assert.ok(fs.existsSync(result.path));
  const lines = fs.readFileSync(result.path, 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]).labels, ['HDASPF-222']);
});
