'use strict';

const fs = require('node:fs');
const { resolvePaths } = require('./paths');
const {
  ensureDataDirs,
  vscodeSettings,
  installVscodeSettings,
  copilotCliEnvironment,
  shellExports,
  hookConfig,
  installHook,
  setupSnapshot,
} = require('./setup');
const { appendHookEvent, readJsonFromStream } = require('./hook-logger');
const {
  addManualLabels,
  clearManualLabels,
  initStore,
  listManualLabels,
  removeManualLabels,
  sessionExists,
  setManualLabels,
} = require('./sqlite-store');
const { autoImportConfiguredSources, ingestFile } = require('./ingest');
const { MODEL_PRICES, PRICING_VERSION } = require('./pricing');
const {
  labelOverview,
  labelSummary,
  labelModelBreakdown,
  labelDetails,
  labelSessionDetails,
  createLabelReportContext,
  inclusionForOptions,
  modelReport,
  repoReport,
  unattributedReport,
  formatLabels,
  formatLabelReport,
  formatModels,
  formatRepos,
  formatUnattributed,
} = require('./reports');
const { canonicalLabel, loadConfiguredExtractors } = require('./label-extractors');
const path = require('node:path');

function parseFlags(args) {
  const flags = {};
  const rest = [];
  const setFlag = (key, value) => {
    if (flags[key] === undefined) {
      flags[key] = value;
    } else if (Array.isArray(flags[key])) {
      flags[key].push(value);
    } else {
      flags[key] = [flags[key], value];
    }
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--') {
      rest.push(...args.slice(i + 1));
      break;
    }
    if (!arg.startsWith('--')) {
      rest.push(arg);
      continue;
    }
    const [rawKey, inlineValue] = arg.slice(2).split('=', 2);
    const key = rawKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (inlineValue !== undefined) {
      setFlag(key, inlineValue);
    } else if (args[i + 1] && !args[i + 1].startsWith('--')) {
      setFlag(key, args[i + 1]);
      i += 1;
    } else {
      setFlag(key, true);
    }
  }
  return { flags, rest };
}

function labelPatternFlagValues(value) {
  const values = Array.isArray(value) ? value : [value];
  if (values.some((item) => item === true || item === undefined || item === null || item === '')) {
    throw new Error('--label-patterns requires a regex value.');
  }
  return values;
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
  copilot-metrics init [--label-patterns <regex> ...] [--json]
  copilot-metrics paths [--json]
  copilot-metrics setup [all] [--label-patterns <regex> ...] [--scope local|global] [--json]
  copilot-metrics setup vscode [--settings-file <path>] [--json]
  copilot-metrics setup copilot-cli [--scope local|global] [--json]
  copilot-metrics hooks preview [--scope local|global] [--surface both|vscode|copilot-cli] [--json]
  copilot-metrics hooks install [--scope local|global] [--surface both|vscode|copilot-cli] [--json]
  copilot-metrics hook-log --event <name>
  copilot-metrics store init [--json]
  copilot-metrics label <session-id> list [--json]
  copilot-metrics label <session-id> add <label...> [--json]
  copilot-metrics label <session-id> remove <label...> [--json]
  copilot-metrics label <session-id> set <label...> [--json]
  copilot-metrics label <session-id> clear [--json]
  copilot-metrics import --source vscode|vscode-chat|copilot-cli|copilot-session|hooks --file <path> [--json]
  copilot-metrics report labels [--refresh] [--json]
  copilot-metrics report label <id> [--detail] [--session-detail] [--top-k <n>|all] [--all-matches] [--refresh] [--json]
  copilot-metrics report models [--refresh] [--json]
  copilot-metrics report repos [--refresh] [--json]
  copilot-metrics report unattributed [--refresh] [--json]
  copilot-metrics pricing list [--json]

Environment:
  COPILOT_METRICS_HOME  Override the central data directory.

Label patterns:
  Repeat --label-patterns to persist one or more internal extractor regexes.
  Patterns define what labels can be found; confidence ranking is reported separately.
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

function formatVscodeInstall(results) {
  return [
    `Installed VS Code Copilot telemetry settings: ${results.map((result) => result.target).join(', ')}`,
    'Content capture is disabled.',
  ].join('\n');
}

function formatCopilotCli(env) {
  return [
    'Export these variables before running Copilot CLI:',
    shellExports(env),
    '',
    'This is optional. Copilot CLI session-state usage is imported by reports without these exports.',
    '',
    'Content capture is disabled by default.',
  ].join('\n');
}

function formatCopilotCliSetup(result) {
  return [
    `Installed ${result.scope} Copilot hook config: ${result.target}`,
    'Copilot CLI token usage is imported from local session-state; OTel exports are optional.',
  ].join('\n');
}

function normalizeManualLabelArgs(labels) {
  const normalized = (labels || []).map(canonicalLabel);
  if (normalized.some((label) => !label)) {
    throw new Error('Manual labels must be non-empty after trimming.');
  }
  return normalized;
}

function formatManualLabelState(state) {
  const labels = state.manual_labels.length ? state.manual_labels.join(', ') : '(none)';
  return [
    `Session: ${state.session_id}`,
    `Manual labels: ${labels}`,
    `Operation: ${state.operation}`,
    `Changed: ${state.changed ? 'yes' : 'no'}`,
  ].join('\n');
}

function telemetryDiagnostics(importResults) {
  const diagnostics = importResults
    .filter((result) => result.diagnostic || ['missing_path', 'unreadable_path', 'unsupported_format'].includes(result.reason))
    .map((result) => ({
      code: result.reason || result.code,
      message: result.message || `${result.source} fallback source could not be imported: ${result.file}`,
    }));
  for (const result of importResults) {
    for (const warning of result.warnings || []) {
      if (['content_only_session', 'no_token_metrics', 'unsupported_format', 'malformed_json', 'import_error'].includes(warning.code)) {
        diagnostics.push({
          code: warning.code,
          message: `${result.source} fallback estimate note: ${warning.message}`,
        });
      }
    }
  }
  const hookResult = importResults.find((result) => result.source === 'hooks' && result.raw_records > 0);
  if (!hookResult) return diagnostics;
  const sessionUsage = importResults.find((result) => result.source === 'copilot-session' && result.raw_records > 0);
  if (sessionUsage) return diagnostics;

  const cliTelemetry = importResults.find((result) => result.source === 'copilot-cli');
  if (!cliTelemetry) return diagnostics;

  if (cliTelemetry.skipped && cliTelemetry.reason === 'missing_file') {
    diagnostics.push({
      code: 'missing_copilot_cli_otel',
      message: `Hook evidence was found, but no token-bearing Copilot session-state or OTel usage was imported. Check that ${cliTelemetry.file} exists for optional OTel data, or that Copilot session-state files are available under the configured COPILOT_HOME.`,
    });
    return diagnostics;
  }

  if (cliTelemetry.raw_records === 0) {
    diagnostics.push({
      code: 'empty_copilot_cli_otel',
      message: `Hook evidence was found, but Copilot CLI token telemetry is empty at ${cliTelemetry.file}. Run another Copilot session with OTel enabled.`,
    });
    return diagnostics;
  }

  if (cliTelemetry.usage_records === 0) {
    diagnostics.push({
      code: 'no_copilot_cli_usage_records',
      message: `Copilot CLI telemetry was found at ${cliTelemetry.file}, but no token-bearing LLM spans were normalized from it.`,
    });
    return diagnostics;
  }

  return diagnostics;
}

function appendDiagnostics(output, diagnostics) {
  if (diagnostics.length === 0) return output;
  const visible = diagnostics.slice(0, 12);
  const hidden = diagnostics.length - visible.length;
  const counts = diagnostics.reduce((acc, diagnostic) => {
    const key = diagnostic.code || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const summary = Object.entries(counts)
    .map(([code, count]) => `${code}:${count}`)
    .join(', ');
  return [
    output,
    '',
    'Diagnostics:',
    ...visible.map((diagnostic) => `- ${diagnostic.message}`),
    hidden > 0 ? `- ... ${hidden} more diagnostics (${summary})` : null,
  ].filter(Boolean).join('\n');
}

function progressBar(current, total, width = 12) {
  if (total <= 0) return ''.padEnd(width, '-');
  const filled = Math.max(0, Math.min(width, Math.round((current / total) * width)));
  return `${'#'.repeat(filled)}${'-'.repeat(width - filled)}`;
}

function createImportProgress(io, enabled) {
  if (!enabled || !io.stderr || typeof io.stderr.write !== 'function') return null;
  const interactive = Boolean(io.stderr.isTTY);
  if (!interactive) return null;
  let lastLineLength = 0;
  const writeLine = (line, final = false) => {
    if (interactive) {
      const padded = line.padEnd(lastLineLength, ' ');
      io.stderr.write(`\r${padded}${final ? '\n' : ''}`);
      lastLineLength = final ? 0 : line.length;
      return;
    }
    io.stderr.write(`${line}\n`);
  };

  return (event) => {
    if (event.phase === 'discover') {
      writeLine('Importing configured sources: scanning...');
      return;
    }
    if (event.phase === 'start') {
      if (event.total === 0) writeLine('Importing configured sources: none found', true);
      return;
    }
    if (event.phase === 'source') {
      const name = event.file ? path.basename(event.file) : event.source;
      writeLine(`Importing [${progressBar(event.current - 1, event.total)}] ${event.current}/${event.total} ${event.source} ${name}`);
      return;
    }
    if (event.phase === 'done') {
      const result = event.result || {};
      const usage = Number(result.usage_records || 0);
      const duplicates = Number(result.duplicate_usage_records || 0);
      const suffix = result.skipped
        ? `skipped:${result.reason || 'unknown'}`
        : `usage:${usage}${duplicates ? ` dup:${duplicates}` : ''}`;
      writeLine(`Importing [${progressBar(event.current, event.total)}] ${event.current}/${event.total} ${suffix}`);
      return;
    }
    if (event.phase === 'finish') {
      writeLine(`Importing configured sources: complete (${event.total} checked)`, true);
    }
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withStoreLock(paths, io, fn) {
  const lockDir = `${paths.usageDb}.lock`;
  const deadline = Date.now() + 120_000;
  let announced = false;
  while (true) {
    try {
      fs.mkdirSync(lockDir, { recursive: false });
      fs.writeFileSync(`${lockDir}/owner`, JSON.stringify({
        pid: process.pid,
        started_at: new Date().toISOString(),
      }));
      break;
    } catch (error) {
      if (error && error.code !== 'EEXIST') throw error;
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for Copilot Metrics store lock: ${lockDir}`);
      }
      if (!announced && io.stderr && typeof io.stderr.write === 'function') {
        io.stderr.write(`Waiting for Copilot Metrics store lock: ${lockDir}\n`);
        announced = true;
      }
      await sleep(250);
    }
  }

  try {
    return await fn();
  } finally {
    fs.rmSync(lockDir, { recursive: true, force: true });
  }
}

async function main(args, io) {
  const { flags, rest } = parseFlags(args);
  const json = flags.json === true;
  const paths = resolvePaths({ env: io.env, cwd: io.cwd, home: flags.home });
  const setupOptions = flags.labelPatterns === undefined ? {} : { labelPatterns: labelPatternFlagValues(flags.labelPatterns) };
  const [command, subcommand] = rest;

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    writeOutput(io.stdout, helpText(), false);
    return;
  }

  if (command === 'init') {
    ensureDataDirs(paths, setupOptions);
    writeOutput(io.stdout, json ? paths : `Initialized Copilot Metrics data directory:\n${formatPaths(paths)}`, json);
    return;
  }

  if (command === 'paths') {
    writeOutput(io.stdout, json ? paths : formatPaths(paths), json);
    return;
  }

  if (command === 'setup') {
    if (subcommand === 'vscode') {
      ensureDataDirs(paths, setupOptions);
      if (flags.print === true || flags.dryRun === true) {
        const settings = vscodeSettings(paths);
        writeOutput(io.stdout, json ? settings : formatVscode(settings), json);
        return;
      }
      const results = installVscodeSettings(paths, { env: io.env, target: flags.settingsFile });
      writeOutput(io.stdout, json ? { installed: results } : formatVscodeInstall(results), json);
      return;
    }
    if (subcommand === 'copilot-cli') {
      ensureDataDirs(paths, setupOptions);
      if (flags.print === true || flags.dryRun === true) {
        const env = copilotCliEnvironment(paths);
        writeOutput(io.stdout, json ? env : formatCopilotCli(env), json);
        return;
      }
      const result = installHook(paths, {
        cwd: io.cwd,
        scope: flags.scope || 'local',
        surface: 'copilot-cli',
        command: io.commandPath,
      });
      writeOutput(io.stdout, json ? { installed: result } : formatCopilotCliSetup({ ...result, scope: flags.scope || 'local' }), json);
      return;
    }
    if (!subcommand || subcommand === 'all') {
      const snapshot = setupSnapshot({
        env: io.env,
        cwd: io.cwd,
        home: flags.home,
        command: io.commandPath,
        install: flags.print !== true && flags.dryRun !== true,
        scope: flags.scope || 'local',
        surface: flags.surface || 'both',
        target: flags.settingsFile,
        ...setupOptions,
      });
      writeOutput(io.stdout, json ? snapshot : [
        formatPaths(snapshot.paths),
        '',
        snapshot.vscodeInstalled.length ? formatVscodeInstall(snapshot.vscodeInstalled) : formatVscode(snapshot.vscode),
        '',
        snapshot.hooksInstalled ? formatCopilotCliSetup({ ...snapshot.hooksInstalled, scope: flags.scope || 'local' }) : formatCopilotCli(snapshot.copilotCli),
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

  if (command === 'label') {
    const sessionId = subcommand;
    const action = rest[2];
    const labels = rest.slice(3);
    if (!sessionId) throw new Error('label requires <session-id>');
    if (!['list', 'add', 'remove', 'set', 'clear'].includes(action)) {
      throw new Error('label requires action list|add|remove|set|clear');
    }
    if ((action === 'list' || action === 'clear') && labels.length > 0) {
      throw new Error(`label ${action} does not accept label arguments`);
    }
    if ((action === 'add' || action === 'remove' || action === 'set') && labels.length === 0) {
      throw new Error(`label ${action} requires at least one label`);
    }
    const normalizedLabels = normalizeManualLabelArgs(labels);
    ensureDataDirs(paths);
    const result = await withStoreLock(paths, io, async () => {
      if (!(await sessionExists(paths.usageDb, sessionId))) {
        throw new Error(`Unknown session_id "${sessionId}". Import local usage or label evidence before assigning manual labels.`);
      }
      if (action === 'list') return listManualLabels(paths.usageDb, sessionId);
      if (action === 'add') return addManualLabels(paths.usageDb, sessionId, normalizedLabels);
      if (action === 'remove') return removeManualLabels(paths.usageDb, sessionId, normalizedLabels);
      if (action === 'set') return setManualLabels(paths.usageDb, sessionId, normalizedLabels);
      return clearManualLabels(paths.usageDb, sessionId);
    });
    writeOutput(io.stdout, json ? result : formatManualLabelState(result), json);
    return;
  }

  if (command === 'store') {
    if (subcommand !== 'init') {
      throw new Error(`Unknown store action "${subcommand}". Use init.`);
    }
    ensureDataDirs(paths);
    await withStoreLock(paths, io, () => initStore(paths.usageDb));
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
    if (!['vscode', 'vscode-chat', 'copilot-cli', 'copilot-session', 'hooks'].includes(source)) {
      throw new Error('import requires --source vscode|vscode-chat|copilot-cli|copilot-session|hooks');
    }
    if (!file) throw new Error('import requires --file <path>');
    ensureDataDirs(paths);
    const result = await withStoreLock(paths, io, () => ingestFile({
      dbPath: paths.usageDb,
      file,
      source,
      extractors: loadConfiguredExtractors(paths.configJson, io.cwd),
    }));
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
    const progress = createImportProgress(io, !json);
    const reportPayload = await withStoreLock(paths, io, async () => {
      const imports = await autoImportConfiguredSources(paths, {
        cwd: io.cwd,
        extractors: loadConfiguredExtractors(paths.configJson, io.cwd),
        onProgress: progress,
        forceRefresh: flags.refresh === true,
      });
      const diagnostics = telemetryDiagnostics(imports);

      if (subcommand === 'labels') {
        const context = await createLabelReportContext(paths.usageDb);
        const rows = await labelOverview(paths.usageDb, { context });
        return json
          ? { value: { inclusion: inclusionForOptions(), labels: rows, diagnostics }, asJson: true }
          : { value: appendDiagnostics(formatLabels(rows), diagnostics), asJson: false };
      }
      if (subcommand === 'label') {
        const label = rest[2];
        if (!label) throw new Error('report label requires <id>');
        const context = await createLabelReportContext(paths.usageDb);
        const reportOptions = { topK: flags.topK, allMatches: flags.allMatches === true, context };
        const inclusion = inclusionForOptions(reportOptions);
        const summary = await labelSummary(paths.usageDb, label, reportOptions);
        const models = await labelModelBreakdown(paths.usageDb, label, reportOptions);
        const sessionDetails = flags.sessionDetail === true ? await labelSessionDetails(paths.usageDb, label, reportOptions) : null;
        if (flags.detail === true) {
          const details = await labelDetails(paths.usageDb, label, reportOptions);
          return json
            ? { value: { inclusion, label: summary, models, details, session_details: sessionDetails, diagnostics }, asJson: true }
            : { value: appendDiagnostics(formatLabelReport(summary, models, details), diagnostics), asJson: false };
        }
        return json
          ? { value: { inclusion, label: summary, models, session_details: sessionDetails, diagnostics }, asJson: true }
          : { value: appendDiagnostics(formatLabelReport(summary, models, null, sessionDetails), diagnostics), asJson: false };
      }
      if (subcommand === 'models') {
        const rows = await modelReport(paths.usageDb);
        return json ? { value: { models: rows, diagnostics }, asJson: true } : { value: appendDiagnostics(formatModels(rows), diagnostics), asJson: false };
      }
      if (subcommand === 'repos') {
        const rows = await repoReport(paths.usageDb);
        return json ? { value: { repos: rows, diagnostics }, asJson: true } : { value: appendDiagnostics(formatRepos(rows), diagnostics), asJson: false };
      }
      if (subcommand === 'unattributed') {
        const rows = await unattributedReport(paths.usageDb);
        return json ? { value: { unattributed: rows, diagnostics }, asJson: true } : { value: appendDiagnostics(formatUnattributed(rows), diagnostics), asJson: false };
      }
      throw new Error(`Unknown report "${subcommand}". Use labels, label, models, repos, or unattributed.`);
    });
    writeOutput(io.stdout, reportPayload.value, reportPayload.asJson);
    return;
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
  telemetryDiagnostics,
};
