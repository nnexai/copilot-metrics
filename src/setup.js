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

function writePrivateFile(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, data, { mode: 0o600 });
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function ensureDataDirs(paths) {
  for (const dir of [paths.home, paths.telemetryDir, paths.hooksDir, paths.storeDir, paths.skillsDir]) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  if (!fs.existsSync(paths.configJson)) {
    writePrivateFile(paths.configJson, `${JSON.stringify({
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
    'github.copilot.chat.otel.exporterType': 'file',
    'github.copilot.chat.otel.outfile': paths.vscodeOtelJsonl,
    'github.copilot.chat.otel.captureContent': false,
  };
}

function copilotCliEnvironment(paths) {
  return {
    COPILOT_OTEL_ENABLED: 'true',
    COPILOT_OTEL_EXPORTER_TYPE: 'file',
    COPILOT_OTEL_FILE_EXPORTER_PATH: paths.copilotCliOtelJsonl,
    OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT: 'false',
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
    hooks: Object.fromEntries(HOOK_EVENTS.map((event) => [
      event,
      [{
        type: 'command',
        command: `node ${shellQuote(command)} hook-log --event ${shellQuote(event)}`,
        env: {
          COPILOT_METRICS_HOME: paths.home,
        },
      }],
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
  writePrivateFile(target, `${JSON.stringify(config, null, 2)}\n`);
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
  shellQuote,
  hookConfig,
  hookTarget,
  installHook,
  setupSnapshot,
};
