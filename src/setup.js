'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { resolvePaths } = require('./paths');

const HOOK_SURFACES = ['both', 'copilot-cli', 'vscode'];

const COPILOT_CLI_HOOK_EVENTS = [
  'sessionStart',
  'sessionEnd',
  'userPromptSubmitted',
  'preToolUse',
  'postToolUse',
  'agentStop',
  'subagentStop',
  'errorOccurred',
];

const VSCODE_HOOK_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PreCompact',
  'SubagentStart',
  'SubagentStop',
  'Stop',
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
      dataHome: paths.home,
      contentCapture: false,
      telemetry: {
        vscode: paths.vscodeOtelJsonl,
        copilotCli: paths.copilotCliOtelJsonl,
      },
      sources: {
        vscode: {
          telemetry: paths.vscodeOtelJsonl,
          hooks: paths.hookEventsJsonl,
        },
        copilotCli: {
          telemetry: paths.copilotCliOtelJsonl,
          hooks: paths.hookEventsJsonl,
          sessions: paths.copilotSessionStateDir,
        },
      },
      labelExtractors: [],
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

function commandInvocation(command) {
  const quoted = shellQuote(command);
  return command.endsWith('.js') ? `node ${quoted}` : quoted;
}

function hookEventsForSurface(surface) {
  if (surface === 'copilot-cli' || surface === 'both') return COPILOT_CLI_HOOK_EVENTS;
  if (surface === 'vscode') return VSCODE_HOOK_EVENTS;
  throw new Error(`Unknown hook surface "${surface}". Use "both", "copilot-cli", or "vscode".`);
}

function hookCommand(command, event, metricsHome) {
  return `COPILOT_METRICS_HOME=${shellQuote(metricsHome)} ${commandInvocation(command)} hook-log --event ${shellQuote(event)} --quiet`;
}

function hookConfig(paths, options = {}) {
  const surface = options.surface || 'both';
  const events = hookEventsForSurface(surface);
  const command = options.command || packageBinCommand(options.cwd || process.cwd());
  const commandHook = (event) => ({
    type: 'command',
    bash: hookCommand(command, event, paths.home),
    command: hookCommand(command, event, paths.home),
    env: {
      COPILOT_METRICS_HOME: paths.home,
    },
    timeout: 10,
    timeoutSec: 10,
  });
  return {
    version: 1,
    hooks: Object.fromEntries(events.map((event) => [
      event,
      [commandHook(event)],
    ])),
  };
}

function hookTarget(paths, scope) {
  if (scope === 'global') return paths.globalHookConfig;
  if (scope === 'local') return paths.localHookConfig;
  throw new Error(`Unknown hook scope "${scope}". Use "local" or "global".`);
}

function mergeGlobalSettingsHooks(settings, hooks) {
  const next = { ...settings };
  const existingHooks = next.hooks || {};
  const mergedHooks = {};
  const isMetricsHook = (hook) => {
    const command = `${hook.bash || ''}\n${hook.powershell || ''}\n${hook.command || ''}`;
    return command.includes('copilot-metrics') && command.includes('hook-log');
  };

  for (const event of new Set([...Object.keys(existingHooks), ...Object.keys(hooks)])) {
    const existing = Array.isArray(existingHooks[event]) ? existingHooks[event].filter((hook) => !isMetricsHook(hook)) : [];
    const additions = Array.isArray(hooks[event]) ? hooks[event] : [];
    if (existing.length > 0 || additions.length > 0) {
      mergedHooks[event] = [...existing, ...additions];
    }
  }

  next.hooks = mergedHooks;
  return next;
}

function installHook(paths, options = {}) {
  const scope = options.scope || 'local';
  const target = hookTarget(paths, scope);
  const config = hookConfig(paths, { ...options, scope });
  if (scope === 'global') {
    let settings = {};
    if (fs.existsSync(target)) {
      settings = JSON.parse(fs.readFileSync(target, 'utf8'));
    }
    writePrivateFile(target, `${JSON.stringify(mergeGlobalSettingsHooks(settings, config.hooks), null, 2)}\n`);
    return { target, config };
  }
  writePrivateFile(target, `${JSON.stringify(config, null, 2)}\n`);
  return { target, config };
}

function setupSnapshot(options = {}) {
  const paths = resolvePaths(options);
  ensureDataDirs(paths);
  return {
    paths,
    vscode: vscodeSettings(paths),
    copilotCli: copilotCliEnvironment(paths),
    hooks: hookConfig(paths, options),
  };
}

module.exports = {
  HOOK_SURFACES,
  COPILOT_CLI_HOOK_EVENTS,
  VSCODE_HOOK_EVENTS,
  ensureDataDirs,
  vscodeSettings,
  copilotCliEnvironment,
  shellExports,
  shellQuote,
  hookConfig,
  hookTarget,
  installHook,
  mergeGlobalSettingsHooks,
  setupSnapshot,
};
