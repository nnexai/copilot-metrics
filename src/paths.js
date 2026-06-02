'use strict';

const os = require('node:os');
const path = require('node:path');

function defaultDataHome(env = process.env, platform = process.platform) {
  if (env.COPILOT_METRICS_HOME) return path.resolve(env.COPILOT_METRICS_HOME);

  if (platform === 'win32') {
    const base = env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(base, 'copilot-metrics');
  }

  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'copilot-metrics');
  }

  const xdg = env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  return path.join(xdg, 'copilot-metrics');
}

function defaultVscodeWorkspaceStorageDirs(env = process.env, platform = process.platform) {
  const home = env.HOME || env.USERPROFILE || os.homedir();
  if (platform === 'darwin') {
    return [
      path.join(home, 'Library', 'Application Support', 'Code', 'User', 'workspaceStorage'),
      path.join(home, 'Library', 'Application Support', 'Code - Insiders', 'User', 'workspaceStorage'),
    ];
  }
  if (platform === 'win32') {
    const appData = env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return [
      path.join(appData, 'Code', 'User', 'workspaceStorage'),
      path.join(appData, 'Code - Insiders', 'User', 'workspaceStorage'),
    ];
  }
  return [
    path.join(home, '.config', 'Code', 'User', 'workspaceStorage'),
    path.join(home, '.config', 'Code - Insiders', 'User', 'workspaceStorage'),
  ];
}

function resolvePaths(options = {}) {
  const env = options.env || process.env;
  const cwd = path.resolve(options.cwd || process.cwd());
  const home = path.resolve(options.home || defaultDataHome(env, options.platform || process.platform));
  const telemetryDir = path.join(home, 'telemetry');
  const hooksDir = path.join(home, 'hooks');
  const storeDir = path.join(home, 'store');
  const skillsDir = path.join(home, 'skills');
  const copilotHome = env.COPILOT_HOME || path.join(os.homedir(), '.copilot');
  const copilotSessionStateDir = path.join(copilotHome, 'session-state');
  const vscodeChatSessionDirs = defaultVscodeWorkspaceStorageDirs(env, options.platform || process.platform);

  return {
    home,
    telemetryDir,
    hooksDir,
    storeDir,
    skillsDir,
    vscodeOtelJsonl: path.join(telemetryDir, 'vscode-copilot-otel.jsonl'),
    copilotCliOtelJsonl: path.join(telemetryDir, 'copilot-cli-otel.jsonl'),
    hookEventsJsonl: path.join(hooksDir, 'copilot-hooks.jsonl'),
    usageDb: path.join(storeDir, 'copilot-metrics.sqlite'),
    configJson: path.join(home, 'config.json'),
    copilotHome,
    copilotSessionStateDir,
    vscodeChatSessionDirs,
    vscodeStableChatSessionDir: vscodeChatSessionDirs[0],
    vscodeInsidersChatSessionDir: vscodeChatSessionDirs[1],
    localHookConfig: path.join(cwd, '.github', 'hooks', 'copilot-metrics.json'),
    globalHookConfig: path.join(copilotHome, 'settings.json'),
  };
}

module.exports = {
  defaultDataHome,
  defaultVscodeWorkspaceStorageDirs,
  resolvePaths,
};
