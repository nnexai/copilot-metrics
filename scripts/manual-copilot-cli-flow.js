#!/usr/bin/env node
'use strict';

const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { mergeGlobalSettingsHooks } = require('../src/setup');

const root = path.join(__dirname, '..');
const cli = path.join(root, 'bin', 'copilot-metrics.js');

function hasFlag(name) {
  return process.argv.includes(name);
}

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: options.stdio || 'pipe',
    cwd: options.cwd,
    env: options.env,
  });
}

function runCli(args, cwd, home) {
  return run(process.execPath, [cli, ...args, '--home', home], { cwd });
}

const workspace = path.resolve(option('--workspace', fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-example-'))));
const metricsHome = path.resolve(option('--home', path.join(workspace, '.copilot-metrics-data')));
const model = option('--model', 'gpt-5-mini');
const prompt = option(
  '--prompt',
  'Run pwd once, then reply with exactly: copilot-metrics validation ok',
);
const runPrompt = hasFlag('--run-prompt');
const setupOnly = hasFlag('--setup-only') || !runPrompt;

fs.mkdirSync(workspace, { recursive: true });
fs.writeFileSync(path.join(workspace, 'README.md'), '# copilot-metrics validation workspace\n', { flag: 'a' });
if (!fs.existsSync(path.join(workspace, '.git'))) {
  run('git', ['init'], { cwd: workspace });
}
try {
  run('git', ['remote', 'get-url', 'origin'], { cwd: workspace });
} catch {
  run('git', ['remote', 'add', 'origin', 'https://github.com/nnexai/copilot-metrics.git'], { cwd: workspace });
}

runCli(['init', '--json'], workspace, metricsHome);
const hookInstall = JSON.parse(runCli(['hooks', 'install', '--scope', 'local', '--surface', 'both', '--json'], workspace, metricsHome));
const envConfig = JSON.parse(runCli(['setup', 'copilot-cli', '--json'], workspace, metricsHome));
const paths = JSON.parse(runCli(['paths', '--json'], workspace, metricsHome));

const envFile = path.join(workspace, '.copilot-metrics.env');
fs.writeFileSync(envFile, `${Object.entries(envConfig).map(([key, value]) => `export ${key}=${JSON.stringify(value)}`).join('\n')}\n`);

const result = {
  workspace,
  metricsHome,
  envFile,
  hookConfig: hookInstall.target,
  temporaryGlobalSettings: path.join(process.env.COPILOT_HOME || path.join(os.homedir(), '.copilot'), 'settings.json'),
  copilotCliOtelJsonl: paths.copilotCliOtelJsonl,
  hookEventsJsonl: paths.hookEventsJsonl,
  ranPrompt: false,
  telemetryExists: false,
  hooksExist: false,
};

if (setupOnly) {
  process.stdout.write(`${JSON.stringify({ ...result, next: 'Re-run with --run-prompt to call Copilot CLI.' }, null, 2)}\n`);
  process.exit(0);
}

const settingsExisted = fs.existsSync(result.temporaryGlobalSettings);
const originalSettings = settingsExisted ? fs.readFileSync(result.temporaryGlobalSettings, 'utf8') : null;
let copilot;
try {
  const settings = settingsExisted ? JSON.parse(originalSettings) : {};
  fs.mkdirSync(path.dirname(result.temporaryGlobalSettings), { recursive: true });
  fs.writeFileSync(
    result.temporaryGlobalSettings,
    `${JSON.stringify(mergeGlobalSettingsHooks(settings, hookInstall.config.hooks), null, 2)}\n`,
  );

  copilot = spawnSync('copilot', ['-p', prompt, '--yolo', '--model', model, '--no-auto-update', '--silent'], {
    cwd: workspace,
    env: {
      ...process.env,
      ...envConfig,
      COPILOT_METRICS_HOME: metricsHome,
    },
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 8,
  });
} finally {
  if (settingsExisted) fs.writeFileSync(result.temporaryGlobalSettings, originalSettings);
  else if (fs.existsSync(result.temporaryGlobalSettings)) fs.rmSync(result.temporaryGlobalSettings);
}

result.ranPrompt = true;
result.exitCode = copilot.status;
result.stdout = (copilot.stdout || '').slice(0, 2000);
result.stderr = (copilot.stderr || '').slice(0, 2000);

if (copilot.status !== 0) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(copilot.status || 1);
}

result.telemetryExists = fs.existsSync(paths.copilotCliOtelJsonl) && fs.statSync(paths.copilotCliOtelJsonl).size > 0;
result.hooksExist = fs.existsSync(paths.hookEventsJsonl) && fs.statSync(paths.hookEventsJsonl).size > 0;

if (result.telemetryExists) {
  result.import = JSON.parse(runCli(['import', '--source', 'copilot-cli', '--file', paths.copilotCliOtelJsonl, '--json'], workspace, metricsHome));
  result.models = JSON.parse(runCli(['report', 'models', '--json'], workspace, metricsHome));
}

if (result.hooksExist) {
  result.hooksImport = JSON.parse(runCli(['import', '--source', 'hooks', '--file', paths.hookEventsJsonl, '--json'], workspace, metricsHome));
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

if (!result.telemetryExists || !result.hooksExist) {
  process.exitCode = 2;
}
