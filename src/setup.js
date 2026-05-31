'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { resolvePaths } = require('./paths');
const { version: PACKAGE_VERSION } = require('../package.json');

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

function readJsonFile(file) {
  if (!fs.existsSync(file)) return {};
  const text = fs.readFileSync(file, 'utf8');
  try {
    return JSON.parse(text);
  } catch {
    return JSON.parse(stripJsonComments(text).replace(/,\s*([}\]])/g, '$1'));
  }
}

function stripJsonComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function ensureDataDirs(paths) {
  for (const dir of [paths.home, paths.telemetryDir, paths.hooksDir, paths.storeDir, paths.skillsDir]) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const defaultConfig = {
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
  };

  if (!fs.existsSync(paths.configJson)) {
    writePrivateFile(paths.configJson, `${JSON.stringify(defaultConfig, null, 2)}\n`);
    return;
  }

  const current = readJsonFile(paths.configJson);
  const next = {
    ...defaultConfig,
    ...current,
    telemetry: { ...defaultConfig.telemetry, ...(current.telemetry || {}) },
    sources: {
      vscode: { ...defaultConfig.sources.vscode, ...(current.sources?.vscode || {}) },
      copilotCli: { ...defaultConfig.sources.copilotCli, ...(current.sources?.copilotCli || {}) },
    },
    labelExtractors: current.labelExtractors || defaultConfig.labelExtractors,
  };
  writePrivateFile(paths.configJson, `${JSON.stringify(next, null, 2)}\n`);
}

function vscodeSettings(paths) {
  return {
    'github.copilot.chat.otel.enabled': true,
    'github.copilot.chat.otel.exporterType': 'file',
    'github.copilot.chat.otel.outfile': paths.vscodeOtelJsonl,
    'github.copilot.chat.otel.captureContent': false,
  };
}

function defaultVscodeSettingsTargets(options = {}) {
  const env = options.env || process.env;
  const home = env.HOME || process.env.HOME;
  if (!home) return [];
  if (process.platform === 'darwin') {
    return [
      path.join(home, 'Library', 'Application Support', 'Code', 'User', 'settings.json'),
      path.join(home, 'Library', 'Application Support', 'Code - Insiders', 'User', 'settings.json'),
    ];
  }
  if (process.platform === 'win32') {
    const appData = env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return [
      path.join(appData, 'Code', 'User', 'settings.json'),
      path.join(appData, 'Code - Insiders', 'User', 'settings.json'),
    ];
  }
  return [
    path.join(home, '.config', 'Code', 'User', 'settings.json'),
    path.join(home, '.config', 'Code - Insiders', 'User', 'settings.json'),
  ];
}

function installVscodeSettings(paths, options = {}) {
  const settings = vscodeSettings(paths);
  const explicitTarget = options.target;
  const candidates = explicitTarget ? [explicitTarget] : defaultVscodeSettingsTargets(options);
  const existingTargets = candidates.filter((target) => fs.existsSync(target));
  const targets = existingTargets.length > 0 ? existingTargets : candidates.slice(0, 1);
  const results = [];
  for (const target of targets) {
    const current = readJsonFile(target);
    writePrivateFile(target, `${JSON.stringify({ ...current, ...settings }, null, 2)}\n`);
    results.push({ target, settings });
  }
  return results;
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
  if (isEphemeralPackageShim(command)) {
    return `npx -y copilot-metrics@${PACKAGE_VERSION}`;
  }
  const quoted = shellQuote(command);
  return command.endsWith('.js') ? `node ${quoted}` : quoted;
}

function isEphemeralPackageShim(command) {
  const normalized = String(command || '').replace(/\\/g, '/');
  return normalized.includes('/.npm/_npx/') || normalized.endsWith('/node_modules/.bin/copilot-metrics');
}

function hookEventsForSurface(surface) {
  if (surface === 'both') return Array.from(new Set([...COPILOT_CLI_HOOK_EVENTS, ...VSCODE_HOOK_EVENTS]));
  if (surface === 'copilot-cli') return COPILOT_CLI_HOOK_EVENTS;
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
  const vscodeInstalled = options.install === true ? installVscodeSettings(paths, options) : [];
  const hooksInstalled = options.install === true ? installHook(paths, {
    cwd: options.cwd,
    scope: options.scope || 'local',
    surface: options.surface || 'both',
    command: options.command,
  }) : null;
  return {
    paths,
    vscode: vscodeSettings(paths),
    vscodeInstalled,
    copilotCli: copilotCliEnvironment(paths),
    hooks: hookConfig(paths, options),
    hooksInstalled,
  };
}

module.exports = {
  HOOK_SURFACES,
  COPILOT_CLI_HOOK_EVENTS,
  VSCODE_HOOK_EVENTS,
  ensureDataDirs,
  defaultVscodeSettingsTargets,
  vscodeSettings,
  installVscodeSettings,
  copilotCliEnvironment,
  shellExports,
  shellQuote,
  hookConfig,
  hookTarget,
  installHook,
  mergeGlobalSettingsHooks,
  setupSnapshot,
};
