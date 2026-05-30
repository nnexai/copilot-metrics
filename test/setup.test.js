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
  assert.equal(paths.hookEventsJsonl, path.join(home, 'hooks', 'copilot-hooks.jsonl'));
});

test('resolvePaths respects COPILOT_HOME for global hooks', () => {
  const paths = resolvePaths({
    env: {
      COPILOT_METRICS_HOME: '/tmp/copilot-metrics',
      COPILOT_HOME: '/tmp/custom-copilot',
    },
    cwd: '/tmp/work',
  });
  assert.equal(paths.globalHookConfig, path.join('/tmp/custom-copilot', 'hooks', 'copilot-metrics.json'));
});

test('setup snippets disable content capture by default', () => {
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: '/tmp/copilot-metrics' }, cwd: '/tmp/work' });
  const vscode = vscodeSettings(paths);
  const cli = copilotCliEnvironment(paths);
  assert.equal(vscode['github.copilot.chat.otel.captureContent'], false);
  assert.equal(vscode['github.copilot.chat.otel.exporterType'], 'file');
  assert.equal(cli.OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT, 'false');
  assert.equal(cli.COPILOT_OTEL_FILE_EXPORTER_PATH, paths.copilotCliOtelJsonl);
});

test('default hook config uses CLI-compatible events for both surfaces', () => {
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: '/tmp/copilot-metrics' }, cwd: '/tmp/work' });
  const config = hookConfig(paths, { cwd: '/repo', scope: 'local', command: '/usr/bin/copilot-metrics' });
  assert.equal(config.version, 1);
  assert.equal(config.surface, undefined);
  assert.equal(config.contentCapture, undefined);
  for (const event of ['sessionStart', 'userPromptSubmitted', 'preToolUse', 'postToolUse', 'agentStop']) {
    assert.equal(config.hooks[event][0].type, 'command');
    assert.match(config.hooks[event][0].command, /node/);
    assert.match(config.hooks[event][0].bash, /node/);
    assert.match(config.hooks[event][0].command, /hook-log/);
    assert.match(config.hooks[event][0].command, /--quiet/);
    assert.match(config.hooks[event][0].command, new RegExp(event));
    assert.match(config.hooks[event][0].command, /\/usr\/bin\/copilot-metrics/);
  }
});

test('copilot-cli hook config can emit CLI-native event names', () => {
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: '/tmp/copilot-metrics' }, cwd: '/tmp/work' });
  const config = hookConfig(paths, {
    cwd: '/repo',
    scope: 'local',
    surface: 'copilot-cli',
    command: '/usr/bin/copilot-metrics',
  });
  assert.ok(config.hooks.sessionStart);
  assert.ok(config.hooks.userPromptSubmitted);
  assert.ok(config.hooks.postToolUse);
  assert.equal(config.hooks.SessionStart, undefined);
});

test('vscode hook config can emit VS Code event names', () => {
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: '/tmp/copilot-metrics' }, cwd: '/tmp/work' });
  const config = hookConfig(paths, {
    cwd: '/repo',
    scope: 'local',
    surface: 'vscode',
    command: '/usr/bin/copilot-metrics',
  });
  assert.ok(config.hooks.SessionStart);
  assert.ok(config.hooks.UserPromptSubmit);
  assert.ok(config.hooks.PostToolUse);
  assert.equal(config.hooks.sessionStart, undefined);
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
    cwd: '/work/DEMO-12345',
    prompt: 'Please fix DEMO-12345 and include secret implementation details',
  };
  const redacted = redactHookPayload(payload, { event: 'userPromptSubmitted' });
  assert.deepEqual(redacted.labels, ['DEMO-12345']);
  assert.equal(redacted.prompt_preview, undefined);
  assert.equal(redacted.raw_prompt_stored, false);
});

test('hook logger accepts VS Code hook payload field names', () => {
  const payload = {
    hook_event_name: 'PreToolUse',
    session_id: 's1',
    cwd: '/work/DEMO-321',
    tool_name: 'run_in_terminal',
  };
  const redacted = redactHookPayload(payload);
  assert.equal(redacted.event, 'PreToolUse');
  assert.equal(redacted.tool_name, 'run_in_terminal');
  assert.deepEqual(redacted.labels, ['DEMO-321']);
});

test('hook logger tolerates non-object JSON payloads', () => {
  const redacted = redactHookPayload(null, { event: 'agentStop' });
  assert.equal(redacted.event, 'agentStop');
  assert.deepEqual(redacted.labels, []);
});

test('appendHookEvent writes JSONL', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-log-'));
  const result = appendHookEvent(
    { event: 'agentStop', cwd: '/repo', branch: 'feature/DEMO-222' },
    { env: { COPILOT_METRICS_HOME: tmp }, cwd: '/repo' },
  );
  assert.ok(fs.existsSync(result.path));
  const lines = fs.readFileSync(result.path, 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]).labels, ['DEMO-222']);
});
