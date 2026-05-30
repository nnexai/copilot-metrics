'use strict';

const { resolvePaths } = require('./paths');
const {
  ensureDataDirs,
  vscodeSettings,
  copilotCliEnvironment,
  shellExports,
  hookConfig,
  installHook,
  setupSnapshot,
} = require('./setup');
const { appendHookEvent, readJsonFromStream } = require('./hook-logger');

function parseFlags(args) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) {
      rest.push(arg);
      continue;
    }
    const [rawKey, inlineValue] = arg.slice(2).split('=', 2);
    const key = rawKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (inlineValue !== undefined) {
      flags[key] = inlineValue;
    } else if (args[i + 1] && !args[i + 1].startsWith('--')) {
      flags[key] = args[i + 1];
      i += 1;
    } else {
      flags[key] = true;
    }
  }
  return { flags, rest };
}

function writeOutput(stdout, value, asJson = false) {
  if (asJson) {
    stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  stdout.write(`${value}\n`);
}

function helpText() {
  return `copilot-metrics

Usage:
  copilot-metrics init [--json]
  copilot-metrics paths [--json]
  copilot-metrics setup vscode [--json]
  copilot-metrics setup copilot-cli [--json]
  copilot-metrics hooks preview [--scope local|global] [--json]
  copilot-metrics hooks install [--scope local|global] [--json]
  copilot-metrics hook-log --event <name>

Environment:
  COPILOT_METRICS_HOME  Override the central data directory.
`;
}

function formatPaths(paths) {
  return [
    `home: ${paths.home}`,
    `telemetry: ${paths.telemetryDir}`,
    `hooks: ${paths.hooksDir}`,
    `store: ${paths.storeDir}`,
    `VS Code OTel JSONL: ${paths.vscodeOtelJsonl}`,
    `Copilot CLI OTel JSONL: ${paths.copilotCliOtelJsonl}`,
    `Hook events JSONL: ${paths.hookEventsJsonl}`,
  ].join('\n');
}

function formatVscode(settings) {
  return [
    'Add these settings to VS Code Insiders settings.json:',
    JSON.stringify(settings, null, 2),
    '',
    'Content capture is disabled by default.',
  ].join('\n');
}

function formatCopilotCli(env) {
  return [
    'Export these variables before running Copilot CLI:',
    shellExports(env),
    '',
    'Content capture is disabled by default.',
  ].join('\n');
}

async function main(args, io) {
  const { flags, rest } = parseFlags(args);
  const json = flags.json === true;
  const paths = resolvePaths({ env: io.env, cwd: io.cwd, home: flags.home });
  const [command, subcommand] = rest;

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    writeOutput(io.stdout, helpText(), false);
    return;
  }

  if (command === 'init') {
    ensureDataDirs(paths);
    writeOutput(io.stdout, json ? paths : `Initialized Copilot Metrics data directory:\n${formatPaths(paths)}`, json);
    return;
  }

  if (command === 'paths') {
    writeOutput(io.stdout, json ? paths : formatPaths(paths), json);
    return;
  }

  if (command === 'setup') {
    if (subcommand === 'vscode') {
      const settings = vscodeSettings(paths);
      writeOutput(io.stdout, json ? settings : formatVscode(settings), json);
      return;
    }
    if (subcommand === 'copilot-cli') {
      const env = copilotCliEnvironment(paths);
      writeOutput(io.stdout, json ? env : formatCopilotCli(env), json);
      return;
    }
    if (!subcommand || subcommand === 'all') {
      const snapshot = setupSnapshot({ env: io.env, cwd: io.cwd, home: flags.home, command: io.commandPath });
      writeOutput(io.stdout, json ? snapshot : [
        formatPaths(snapshot.paths),
        '',
        formatVscode(snapshot.vscode),
        '',
        formatCopilotCli(snapshot.copilotCli),
      ].join('\n'), json);
      return;
    }
    throw new Error(`Unknown setup target "${subcommand}". Use vscode or copilot-cli.`);
  }

  if (command === 'hooks') {
    const scope = flags.scope || 'local';
    if (subcommand === 'preview') {
      const config = hookConfig(paths, { cwd: io.cwd, scope, command: io.commandPath });
      writeOutput(io.stdout, json ? config : JSON.stringify(config, null, 2), json);
      return;
    }
    if (subcommand === 'install') {
      ensureDataDirs(paths);
      const result = installHook(paths, { cwd: io.cwd, scope, command: io.commandPath });
      writeOutput(io.stdout, json ? result : `Installed ${scope} hook config: ${result.target}`, json);
      return;
    }
    throw new Error(`Unknown hooks action "${subcommand}". Use preview or install.`);
  }

  if (command === 'hook-log') {
    const payload = await readJsonFromStream(io.stdin);
    const result = appendHookEvent(payload, {
      env: io.env,
      cwd: io.cwd,
      home: flags.home,
      event: flags.event,
      includePromptPreview: flags.includePromptPreview === true,
    });
    writeOutput(io.stdout, json ? result : `Logged hook event: ${result.path}`, json);
    return;
  }

  throw new Error(`Unknown command "${command}". Run copilot-metrics --help.`);
}

module.exports = {
  main,
  parseFlags,
  helpText,
};
