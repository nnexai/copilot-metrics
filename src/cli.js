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
const { initStore } = require('./sqlite-store');
const { autoImportConfiguredSources, ingestFile } = require('./ingest');
const { MODEL_PRICES, PRICING_VERSION } = require('./pricing');
const {
  labelOverview,
  labelSummary,
  labelDetails,
  modelReport,
  repoReport,
  unattributedReport,
  formatLabels,
  formatLabelSummary,
  formatModels,
  formatRepos,
  formatUnattributed,
} = require('./reports');
const { loadConfiguredExtractors } = require('./label-extractors');

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
  copilot-metrics hooks preview [--scope local|global] [--surface both|vscode|copilot-cli] [--json]
  copilot-metrics hooks install [--scope local|global] [--surface both|vscode|copilot-cli] [--json]
  copilot-metrics hook-log --event <name>
  copilot-metrics store init [--json]
  copilot-metrics import --source vscode|copilot-cli|hooks --file <path> [--json]
  copilot-metrics report labels [--json]
  copilot-metrics report label <id> [--detail] [--json]
  copilot-metrics report models [--json]
  copilot-metrics report repos [--json]
  copilot-metrics report unattributed [--json]
  copilot-metrics pricing list [--json]

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
    `SQLite store: ${paths.usageDb}`,
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
    const surface = flags.surface || 'both';
    if (subcommand === 'preview') {
      const config = hookConfig(paths, { cwd: io.cwd, scope, surface, command: io.commandPath });
      writeOutput(io.stdout, json ? config : JSON.stringify(config, null, 2), json);
      return;
    }
    if (subcommand === 'install') {
      ensureDataDirs(paths);
      const result = installHook(paths, { cwd: io.cwd, scope, surface, command: io.commandPath });
      writeOutput(io.stdout, json ? result : `Installed ${scope} ${surface} hook config: ${result.target}`, json);
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
    if (flags.quiet === true) return;
    writeOutput(io.stdout, json ? result : `Logged hook event: ${result.path}`, json);
    return;
  }

  if (command === 'store') {
    if (subcommand !== 'init') {
      throw new Error(`Unknown store action "${subcommand}". Use init.`);
    }
    ensureDataDirs(paths);
    await initStore(paths.usageDb);
    writeOutput(io.stdout, json ? { dbPath: paths.usageDb } : `Initialized SQLite store: ${paths.usageDb}`, json);
    return;
  }

  if (command === 'import') {
    const source = flags.source;
    const file = flags.file || (source === 'vscode'
      ? paths.vscodeOtelJsonl
      : source === 'copilot-cli'
        ? paths.copilotCliOtelJsonl
        : source === 'hooks'
          ? paths.hookEventsJsonl
          : null);
    if (!['vscode', 'copilot-cli', 'hooks'].includes(source)) {
      throw new Error('import requires --source vscode|copilot-cli|hooks');
    }
    if (!file) throw new Error('import requires --file <path>');
    ensureDataDirs(paths);
    const result = await ingestFile({
      dbPath: paths.usageDb,
      file,
      source,
      extractors: loadConfiguredExtractors(paths.configJson, io.cwd),
    });
    writeOutput(io.stdout, json ? result : [
      `Imported ${result.raw_records} raw ${source} records into ${result.dbPath}`,
      `Normalized usage records: ${result.usage_records}`,
      `Hook events: ${result.hook_events}`,
      `Label evidence: ${result.label_evidence}`,
      `Warnings: ${result.warnings.length}`,
      `Costs are ${result.estimate_label}`,
    ].join('\n'), json);
    return;
  }

  if (command === 'report') {
    ensureDataDirs(paths);
    await autoImportConfiguredSources(paths, {
      cwd: io.cwd,
      extractors: loadConfiguredExtractors(paths.configJson, io.cwd),
    });

    if (subcommand === 'labels') {
      const rows = await labelOverview(paths.usageDb);
      writeOutput(io.stdout, json ? { labels: rows } : formatLabels(rows), json);
      return;
    }
    if (subcommand === 'label') {
      const label = rest[2];
      if (!label) throw new Error('report label requires <id>');
      const summary = await labelSummary(paths.usageDb, label);
      if (flags.detail === true) {
        const details = await labelDetails(paths.usageDb, label);
        writeOutput(io.stdout, json ? { label: summary, details } : formatLabelSummary(summary, details), json);
        return;
      }
      writeOutput(io.stdout, json ? { label: summary } : formatLabelSummary(summary), json);
      return;
    }
    if (subcommand === 'models') {
      const rows = await modelReport(paths.usageDb);
      writeOutput(io.stdout, json ? { models: rows } : formatModels(rows), json);
      return;
    }
    if (subcommand === 'repos') {
      const rows = await repoReport(paths.usageDb);
      writeOutput(io.stdout, json ? { repos: rows } : formatRepos(rows), json);
      return;
    }
    if (subcommand === 'unattributed') {
      const rows = await unattributedReport(paths.usageDb);
      writeOutput(io.stdout, json ? { unattributed: rows } : formatUnattributed(rows), json);
      return;
    }
    throw new Error(`Unknown report "${subcommand}". Use labels, label, models, repos, or unattributed.`);
  }

  if (command === 'pricing') {
    if (subcommand !== 'list') throw new Error(`Unknown pricing action "${subcommand}". Use list.`);
    const payload = { version: PRICING_VERSION, unit: 'USD per 1M tokens', models: MODEL_PRICES };
    writeOutput(io.stdout, json ? payload : JSON.stringify(payload, null, 2), json);
    return;
  }

  throw new Error(`Unknown command "${command}". Run copilot-metrics --help.`);
}

module.exports = {
  main,
  parseFlags,
  helpText,
};
