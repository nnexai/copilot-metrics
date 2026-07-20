'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { resolvePaths } = require('../src/paths');
const { vscodeSettings, installVscodeSettings, copilotCliEnvironment, hookConfig, installHook, mergeGlobalSettingsHooks, setupSnapshot } = require('../src/setup');
const { appendHookEvent, redactHookPayload } = require('../src/hook-logger');
const { parseFlags } = require('../src/cli');
const { loadConfiguredExtractors, runLabelExtractors } = require('../src/label-extractors');
const { version, bin: packageBins } = require('../package.json');

function runHookProcess(script, args, payload, options = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, ...options.env },
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
  });
}

function comparableHookRecord(record) {
  const { captured_at: _capturedAt, ...comparable } = record;
  return comparable;
}

test('resolvePaths uses COPILOT_METRICS_HOME override', () => {
  const home = path.join(os.tmpdir(), 'copilot-metrics-test-home');
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: home }, cwd: '/tmp/work' });
  assert.equal(paths.home, home);
  assert.equal(paths.vscodeOtelJsonl, path.join(home, 'telemetry', 'vscode-copilot-otel.jsonl'));
  assert.equal(paths.hookEventsJsonl, path.join(home, 'hooks', 'copilot-hooks.jsonl'));
  assert.equal(paths.copilotSessionStateDir, path.join(os.homedir(), '.copilot', 'session-state'));
  assert.ok(paths.vscodeChatSessionDirs.some((dir) => dir.includes('workspaceStorage')));
});

test('resolvePaths respects COPILOT_HOME for global hooks', () => {
  const paths = resolvePaths({
    env: {
      COPILOT_METRICS_HOME: '/tmp/copilot-metrics',
      COPILOT_HOME: '/tmp/custom-copilot',
    },
    cwd: '/tmp/work',
  });
  assert.equal(paths.globalHookConfig, path.join('/tmp/custom-copilot', 'settings.json'));
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

test('setup snapshot persists central config for setup-once flow', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-setup-'));
  const snapshot = setupSnapshot({
    env: { COPILOT_METRICS_HOME: tmp },
    cwd: '/tmp/work',
    command: '/usr/bin/copilot-metrics',
  });
  assert.ok(fs.existsSync(snapshot.paths.configJson));
  const config = JSON.parse(fs.readFileSync(snapshot.paths.configJson, 'utf8'));
  assert.equal(config.dataHome, tmp);
  assert.equal(config.telemetry.vscode, snapshot.paths.vscodeOtelJsonl);
  assert.equal(config.sources.copilotCli.telemetry, snapshot.paths.copilotCliOtelJsonl);
  assert.equal(config.sources.copilotCli.sessions, snapshot.paths.copilotSessionStateDir);
  assert.deepEqual(config.sources.vscode.chatSessions, snapshot.paths.vscodeChatSessionDirs);
  assert.deepEqual(config.sources.vscode.additionalChatSessions, []);
  assert.deepEqual(config.sources.copilotCli.additionalSessions, []);
  assert.deepEqual(config.labelPatterns, []);
  assert.deepEqual(config.labelExtractors, []);
});

test('setup snapshot persists one configured label pattern', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-setup-label-pattern-'));
  const snapshot = setupSnapshot({
    env: { COPILOT_METRICS_HOME: tmp },
    cwd: '/tmp/work',
    command: '/usr/bin/copilot-metrics',
    labelPatterns: ['\\b(TEAM-\\d+)\\b'],
  });
  const config = JSON.parse(fs.readFileSync(snapshot.paths.configJson, 'utf8'));
  assert.deepEqual(config.labelPatterns, ['\\b(TEAM-\\d+)\\b']);
});

test('setup snapshot persists multiple configured label patterns', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-setup-label-patterns-'));
  const snapshot = setupSnapshot({
    env: { COPILOT_METRICS_HOME: tmp },
    cwd: '/tmp/work',
    command: '/usr/bin/copilot-metrics',
    labelPatterns: ['\\b(TEAM-\\d+)\\b', '\\b(PROJ_\\d+)\\b'],
  });
  const config = JSON.parse(fs.readFileSync(snapshot.paths.configJson, 'utf8'));
  assert.deepEqual(config.labelPatterns, ['\\b(TEAM-\\d+)\\b', '\\b(PROJ_\\d+)\\b']);
});

test('setup snapshot rejects invalid configured label patterns', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-setup-bad-label-pattern-'));
  assert.throws(() => setupSnapshot({
    env: { COPILOT_METRICS_HOME: tmp },
    cwd: '/tmp/work',
    command: '/usr/bin/copilot-metrics',
    labelPatterns: ['['],
  }), /Invalid --label-patterns regex/);
});

test('parseFlags preserves repeated label-patterns values', () => {
  const parsed = parseFlags(['init', '--label-patterns', '\\b(TEAM-\\d+)\\b', '--label-patterns=/\\b(PROJ_\\d+)\\b/i']);
  assert.deepEqual(parsed.rest, ['init']);
  assert.deepEqual(parsed.flags.labelPatterns, ['\\b(TEAM-\\d+)\\b', '/\\b(PROJ_\\d+)\\b/i']);
});

test('persisted labelPatterns are consumed by configured extractors', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-setup-label-pattern-consume-'));
  const snapshot = setupSnapshot({
    env: { COPILOT_METRICS_HOME: tmp },
    cwd: '/tmp/work',
    command: '/usr/bin/copilot-metrics',
    labelPatterns: ['\\b(TEAM_\\d+)\\b'],
  });
  const extractors = loadConfiguredExtractors(snapshot.paths.configJson, '/tmp/work');
  const evidence = runLabelExtractors('hook', { cwd: '/repo/TEAM_123' }, extractors);
  assert.deepEqual(evidence.map((item) => item.label), ['TEAM_123']);
});

test('setup snapshot upgrades existing central config with session source', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-setup-upgrade-'));
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: tmp }, cwd: '/tmp/work' });
  fs.mkdirSync(path.dirname(paths.configJson), { recursive: true });
  fs.writeFileSync(paths.configJson, `${JSON.stringify({ version: 1, sources: { copilotCli: { hooks: '/custom/hooks.jsonl' } } })}\n`);
  const snapshot = setupSnapshot({
    env: { COPILOT_METRICS_HOME: tmp },
    cwd: '/tmp/work',
    command: '/usr/bin/copilot-metrics',
  });
  const config = JSON.parse(fs.readFileSync(snapshot.paths.configJson, 'utf8'));
  assert.equal(config.sources.copilotCli.hooks, '/custom/hooks.jsonl');
  assert.equal(config.sources.copilotCli.sessions, snapshot.paths.copilotSessionStateDir);
});

test('setup snapshot preserves custom fallback paths while retaining defaults', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-setup-custom-fallback-'));
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: tmp }, cwd: '/tmp/work' });
  fs.mkdirSync(path.dirname(paths.configJson), { recursive: true });
  fs.writeFileSync(paths.configJson, `${JSON.stringify({
    version: 1,
    sources: {
      vscode: {
        chatSessions: ['/custom/vscode-chat'],
        additionalChatSessions: ['/extra/vscode-chat'],
      },
      copilotCli: {
        sessions: '/custom/copilot/session-state',
        additionalSessions: ['/extra/copilot/session-state'],
      },
    },
  })}\n`);
  const snapshot = setupSnapshot({
    env: { COPILOT_METRICS_HOME: tmp },
    cwd: '/tmp/work',
    command: '/usr/bin/copilot-metrics',
  });
  const config = JSON.parse(fs.readFileSync(snapshot.paths.configJson, 'utf8'));
  assert.ok(config.sources.vscode.chatSessions.includes(snapshot.paths.vscodeStableChatSessionDir));
  assert.ok(config.sources.vscode.chatSessions.includes(snapshot.paths.vscodeInsidersChatSessionDir));
  assert.ok(config.sources.vscode.chatSessions.includes('/custom/vscode-chat'));
  assert.deepEqual(config.sources.vscode.additionalChatSessions, ['/extra/vscode-chat']);
  assert.equal(config.sources.copilotCli.sessions, '/custom/copilot/session-state');
  assert.deepEqual(config.sources.copilotCli.additionalSessions, ['/extra/copilot/session-state']);
});

test('installVscodeSettings merges telemetry settings into user settings', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-vscode-'));
  const target = path.join(tmp, 'settings.json');
  fs.writeFileSync(target, `${JSON.stringify({ 'editor.fontSize': 14 })}\n`);
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: path.join(tmp, 'home') }, cwd: '/tmp/work' });
  const results = installVscodeSettings(paths, { target });
  assert.equal(results[0].target, target);
  const settings = JSON.parse(fs.readFileSync(target, 'utf8'));
  assert.equal(settings['editor.fontSize'], 14);
  assert.equal(settings['github.copilot.chat.otel.enabled'], true);
  assert.equal(settings['github.copilot.chat.otel.outfile'], paths.vscodeOtelJsonl);
});

test('default hook config uses hook-only commands for both surfaces', () => {
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: '/tmp/copilot-metrics' }, cwd: '/tmp/work' });
  const config = hookConfig(paths, { cwd: '/repo', scope: 'local', command: '/repo/bin/copilot-metrics.js' });
  assert.equal(config.version, 1);
  assert.equal(config.surface, undefined);
  assert.equal(config.contentCapture, undefined);
  for (const event of ['sessionStart', 'userPromptSubmitted', 'preToolUse', 'postToolUse', 'agentStop']) {
    const commandHook = config.hooks[event][0];
    assert.equal(commandHook.type, 'command');
    assert.match(commandHook.command, /node/);
    assert.match(commandHook.bash, /node/);
    assert.doesNotMatch(commandHook.command, /hook-log/);
    assert.match(commandHook.command, /--quiet/);
    assert.match(commandHook.command, new RegExp(event));
    assert.match(commandHook.command, /\/repo\/bin\/copilot-metrics-hook\.js/);
  }
  assert.ok(config.hooks.SessionStart);
  assert.ok(config.hooks.UserPromptSubmit);
  assert.ok(config.hooks.PostToolUse);
});

test('installed executable hook commands do not wrap the shim with node', () => {
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: '/tmp/copilot-metrics' }, cwd: '/tmp/work' });
  const config = hookConfig(paths, { cwd: '/repo', scope: 'local', command: '/usr/bin/copilot-metrics' });
  const command = config.hooks.sessionStart[0].command;
  assert.match(command, /COPILOT_METRICS_HOME=/);
  assert.match(command, /'\/usr\/bin\/copilot-metrics-hook'/);
  assert.doesNotMatch(command, /hook-log/);
  assert.doesNotMatch(command, /node '\/usr\/bin\/copilot-metrics-hook'/);
});

test('npx cache hook commands use a stable package invocation', () => {
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: '/tmp/copilot-metrics' }, cwd: '/tmp/work' });
  const config = hookConfig(paths, {
    cwd: '/repo',
    scope: 'local',
    command: '/home/user/.npm/_npx/abc123/node_modules/.bin/copilot-metrics',
  });
  const command = config.hooks.sessionStart[0].command;
  assert.match(command, /COPILOT_METRICS_HOME=/);
  assert.match(command, new RegExp(`npx -y --package copilot-metrics@${version.replaceAll('.', '\\.')} copilot-metrics-hook`));
  assert.doesNotMatch(command, /hook-log/);
  assert.doesNotMatch(command, /\.npm\/_npx/);
});

test('hook commands quote repository paths containing spaces', () => {
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: '/tmp/metrics home' }, cwd: '/tmp/work' });
  const config = hookConfig(paths, {
    command: '/repo with spaces/bin/copilot-metrics.js',
  });
  const command = config.hooks.sessionStart[0].command;
  assert.match(command, /COPILOT_METRICS_HOME='\/tmp\/metrics home'/);
  assert.match(command, /node '\/repo with spaces\/bin\/copilot-metrics-hook\.js'/);
});

test('package exposes the hook-only executable', () => {
  assert.equal(packageBins['copilot-metrics-hook'], 'bin/copilot-metrics-hook.js');
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
  assert.equal(config.hooks.UserPromptSubmit, undefined);
  assert.equal(config.hooks.PostToolUse, undefined);
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
  const paths = resolvePaths({
    env: {
      COPILOT_METRICS_HOME: path.join(tmp, 'home'),
      COPILOT_HOME: path.join(tmp, 'copilot-home'),
    },
    cwd: tmp,
  });
  const local = installHook(paths, { cwd: tmp, scope: 'local' });
  assert.equal(local.target, path.join(tmp, '.github', 'hooks', 'copilot-metrics.json'));
  assert.ok(fs.existsSync(local.target));
  const global = installHook(paths, { cwd: tmp, scope: 'global' });
  assert.equal(global.target, path.join(tmp, 'copilot-home', 'settings.json'));
  const settings = JSON.parse(fs.readFileSync(global.target, 'utf8'));
  assert.ok(settings.hooks.postToolUse);
});

test('global hook merge replaces prior copilot-metrics hooks only', () => {
  const existing = {
    model: 'gpt-5-mini',
    hooks: {
      postToolUse: [
        { type: 'command', bash: 'echo keep' },
        { type: 'command', bash: 'node bin/copilot-metrics.js hook-log --event postToolUse' },
        { type: 'command', bash: 'copilot-metrics-hook --event postToolUse --quiet' },
      ],
    },
  };
  const next = mergeGlobalSettingsHooks(existing, {
    postToolUse: [{ type: 'command', bash: 'node /repo/bin/copilot-metrics-hook.js --event postToolUse --quiet' }],
  });
  assert.equal(next.model, 'gpt-5-mini');
  assert.equal(next.hooks.postToolUse.length, 2);
  assert.equal(next.hooks.postToolUse[0].bash, 'echo keep');
  assert.match(next.hooks.postToolUse[1].bash, /copilot-metrics/);
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

test('hook-only executable preserves hook-log redaction and output behavior', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-hook-only-'));
  const payload = {
    sessionId: 'session-1',
    cwd: '/work/DEMO-456',
    prompt: 'Keep this secret while working on DEMO-456',
  };
  const commonArgs = ['--event', 'userPromptSubmitted', '--json'];
  const legacy = runHookProcess('bin/copilot-metrics.js', ['hook-log', ...commonArgs], payload, {
    env: { COPILOT_METRICS_HOME: path.join(tmp, 'legacy') },
  });
  const lightweight = runHookProcess('bin/copilot-metrics-hook.js', commonArgs, payload, {
    env: { COPILOT_METRICS_HOME: path.join(tmp, 'lightweight') },
  });

  assert.equal(legacy.status, 0, legacy.stderr);
  assert.equal(lightweight.status, 0, lightweight.stderr);
  const legacyResult = JSON.parse(legacy.stdout);
  const lightweightResult = JSON.parse(lightweight.stdout);
  assert.deepEqual(
    comparableHookRecord(lightweightResult.record),
    comparableHookRecord(legacyResult.record),
  );
  assert.equal(lightweightResult.record.prompt_preview, undefined);
  assert.doesNotMatch(fs.readFileSync(lightweightResult.path, 'utf8'), /Keep this secret/);

  const quiet = runHookProcess('bin/copilot-metrics-hook.js', ['--event', 'agentStop', '--quiet'], {}, {
    env: { COPILOT_METRICS_HOME: path.join(tmp, 'quiet') },
  });
  assert.equal(quiet.status, 0, quiet.stderr);
  assert.equal(quiet.stdout, '');
});

test('generated hook-only command writes equivalent redacted hook output', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-generated-hook-'));
  const paths = resolvePaths({ env: { COPILOT_METRICS_HOME: tmp }, cwd: process.cwd() });
  const config = hookConfig(paths, {
    cwd: process.cwd(),
    scope: 'local',
    command: path.join(process.cwd(), 'bin', 'copilot-metrics.js'),
  });
  const payload = {
    sessionId: 'generated-session',
    cwd: '/work/DEMO-457',
    prompt: 'Do not retain this generated hook secret for DEMO-457',
  };

  const generated = spawnSync(config.hooks.userPromptSubmitted[0].command, {
    cwd: path.join(__dirname, '..'),
    env: process.env,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    shell: true,
  });

  assert.equal(generated.status, 0, generated.stderr);
  assert.equal(generated.stdout, '');
  const records = fs.readFileSync(paths.hookEventsJsonl, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(records.length, 1);
  assert.equal(records[0].session_id, 'generated-session');
  assert.deepEqual(records[0].labels, ['DEMO-457']);
  assert.equal(records[0].raw_prompt_stored, false);
  assert.equal(records[0].prompt_preview, undefined);
  assert.doesNotMatch(fs.readFileSync(paths.hookEventsJsonl, 'utf8'), /generated hook secret/);
});

test('hook-only executable has a narrow module graph', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-hook-modules-'));
  const moduleReport = path.join(tmp, 'modules.json');
  const result = runHookProcess('bin/copilot-metrics-hook.js', ['--event', 'agentStop', '--quiet'], {}, {
    env: {
      COPILOT_METRICS_HOME: path.join(tmp, 'home'),
      COPILOT_METRICS_HOOK_MODULE_REPORT: moduleReport,
    },
  });
  assert.equal(result.status, 0, result.stderr);
  const loaded = JSON.parse(fs.readFileSync(moduleReport, 'utf8'));
  for (const heavyweight of ['better-sqlite3', '/src/cli.js', '/src/ingest.js', '/src/pricing.js', '/src/reports.js']) {
    assert.equal(loaded.some((modulePath) => modulePath.includes(heavyweight)), false, heavyweight);
  }
});

test('hook-only executable rejects malformed JSON without appending', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-hook-invalid-'));
  const result = runHookProcess('bin/copilot-metrics-hook.js', ['--event', 'agentStop'], '{bad json', {
    env: { COPILOT_METRICS_HOME: tmp },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /copilot-metrics-hook:/);
  assert.equal(fs.existsSync(path.join(tmp, 'hooks', 'copilot-hooks.jsonl')), false);
});
