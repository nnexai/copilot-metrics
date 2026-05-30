'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { resolvePaths } = require('./paths');

const HOOK_EVENTS = [
  'sessionStart',
  'userPromptSubmitted',
  'postToolUse',
  'agentStop',
  'errorOccurred',
];

function ensureDataDirs(paths) {
  for (const dir of [paths.home, paths.telemetryDir, paths.hooksDir, paths.storeDir, paths.skillsDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(paths.configJson)) {
    fs.writeFileSync(paths.configJson, `${JSON.stringify({
      version: 1,
      contentCapture: false,
      telemetry: {
        vscode: paths.vscodeOtelJsonl,
        copilotCli: paths.copilotCliOtelJsonl,
      },
      hooks: {
        events: paths.hookEventsJsonl,
      },
    }, null, 2)}\n`);
  }
}

function vscodeSettings(paths) {
  return {
    'github.copilot.chat.otel.enabled': true,
    'github.copilot.chat.otel.exporter': 'file',
    'github.copilot.chat.otel.file': paths.vscodeOtelJsonl,
    'github.copilot.chat.otel.contentCapture': false,
  };
}

function copilotCliEnvironment(paths) {
  return {
    COPILOT_OTEL: 'true',
    COPILOT_OTEL_EXPORTER: 'file',
    COPILOT_OTEL_FILE: paths.copilotCliOtelJsonl,
    COPILOT_OTEL_CONTENT_CAPTURE: 'false',
  };
}

function shellExports(env) {
  return Object.entries(env)
    .map(([key, value]) => `export ${key}=${JSON.stringify(value)}`)
    .join('\n');
}

function packageBinCommand(cwd) {
  return path.join(cwd, 'bin', 'copilot-metrics.js');
}

function hookConfig(paths, options = {}) {
  const command = options.command || packageBinCommand(options.cwd || process.cwd());
  return {
    version: 1,
    tool: 'copilot-metrics',
    scope: options.scope || 'local',
    contentCapture: false,
    events: Object.fromEntries(HOOK_EVENTS.map((event) => [
      event,
      {
        command: 'node',
        args: [command, 'hook-log', '--event', event],
        env: {
          COPILOT_METRICS_HOME: paths.home,
        },
      },
    ])),
  };
}

function hookTarget(paths, scope) {
  if (scope === 'global') return paths.globalHookConfig;
  if (scope === 'local') return paths.localHookConfig;
  throw new Error(`Unknown hook scope "${scope}". Use "local" or "global".`);
}

function installHook(paths, options = {}) {
  const scope = options.scope || 'local';
  const target = hookTarget(paths, scope);
  const config = hookConfig(paths, { ...options, scope });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(config, null, 2)}\n`);
  return { target, config };
}

function setupSnapshot(options = {}) {
  const paths = resolvePaths(options);
  return {
    paths,
    vscode: vscodeSettings(paths),
    copilotCli: copilotCliEnvironment(paths),
    hooks: hookConfig(paths, options),
  };
}

module.exports = {
  HOOK_EVENTS,
  ensureDataDirs,
  vscodeSettings,
  copilotCliEnvironment,
  shellExports,
  hookConfig,
  hookTarget,
  installHook,
  setupSnapshot,
};
