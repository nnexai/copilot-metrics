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

function resolvePaths(options = {}) {
  const env = options.env || process.env;
  const cwd = path.resolve(options.cwd || process.cwd());
  const home = path.resolve(options.home || defaultDataHome(env, options.platform || process.platform));
  const telemetryDir = path.join(home, 'telemetry');
  const hooksDir = path.join(home, 'hooks');
  const storeDir = path.join(home, 'store');
  const skillsDir = path.join(home, 'skills');
  const copilotHome = env.COPILOT_HOME || path.join(os.homedir(), '.copilot');

  return {
    home,
    telemetryDir,
    hooksDir,
    storeDir,
    skillsDir,
    vscodeOtelJsonl: path.join(telemetryDir, 'vscode-copilot-otel.jsonl'),
    copilotCliOtelJsonl: path.join(telemetryDir, 'copilot-cli-otel.jsonl'),
    hookEventsJsonl: path.join(hooksDir, 'copilot-cli-hooks.jsonl'),
    configJson: path.join(home, 'config.json'),
    localHookConfig: path.join(cwd, '.github', 'hooks', 'copilot-metrics.json'),
    globalHookConfig: path.join(copilotHome, 'hooks', 'copilot-metrics.json'),
  };
}

module.exports = {
  defaultDataHome,
  resolvePaths,
};
