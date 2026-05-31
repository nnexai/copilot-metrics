'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { readJsonl } = require('./jsonl');
const { normalizePayload, normalizeHookEvent, normalizeCopilotSessionEvents } = require('./otel');
const { estimateCost, PRICING_VERSION } = require('./pricing');
const { existingRawFingerprints, importedLineHighWater, insertImport } = require('./sqlite-store');
const { attachUsageLabelEvidence, attachHookLabelEvidence } = require('./labels');
const { loadConfiguredExtractors } = require('./label-extractors');

function enrichCosts(records) {
  return records.map((record) => {
    const estimate = estimateCost(record);
    const warnings = [...record.warnings];
    if (estimate.warning) warnings.push(estimate.warning);
    return {
      ...record,
      estimated_usd: estimate.estimated_usd,
      estimated_ai_credits: estimate.estimated_ai_credits,
      estimate_label: `estimate:${PRICING_VERSION}`,
      warnings,
    };
  });
}

function rawFingerprint(source, file, record) {
  return crypto
    .createHash('sha256')
    .update(source)
    .update('\0')
    .update(path.resolve(file))
    .update('\0')
    .update(String(record.line))
    .update('\0')
    .update(JSON.stringify(record.value))
    .digest('hex');
}

function isCopilotSessionUsageRecord(record) {
  return record.value && record.value.type === 'session.shutdown';
}

async function ingestFile(options) {
  const { dbPath, file, source } = options;
  const sourceFile = path.resolve(file);
  const highWaterLine = await importedLineHighWater(dbPath, source, sourceFile);
  if (source === 'copilot-session' && highWaterLine > 0) {
    return {
      source,
      file,
      dbPath,
      raw_records: 0,
      new_raw_records: 0,
      skipped_existing_records: highWaterLine,
      usage_records: 0,
      hook_events: 0,
      label_evidence: 0,
      warnings: [],
      estimate_label: `estimate:${PRICING_VERSION}`,
    };
  }
  const needsSessionContext = source === 'copilot-session' && highWaterLine === 0;
  const parsed = readJsonl(file, { afterLine: needsSessionContext ? 0 : highWaterLine });
  const warnings = [...parsed.warnings];
  const parsedRecords = parsed.records.map((record) => ({
    ...record,
    raw_fingerprint: rawFingerprint(source, sourceFile, record),
  }));
  const importableRecords = source === 'copilot-session'
    ? parsedRecords.filter(isCopilotSessionUsageRecord)
    : parsedRecords;
  const existing = await existingRawFingerprints(
    dbPath,
    source,
    sourceFile,
    importableRecords.map((record) => record.raw_fingerprint),
  );
  const newRecords = importableRecords.filter((record) => !existing.has(record.raw_fingerprint));
  const usageRecords = [];
  const hookEvents = [];

  if (source === 'copilot-session') {
    usageRecords.push(...normalizeCopilotSessionEvents(newRecords, parsedRecords));
  } else {
    for (const record of newRecords) {
      if (source === 'hooks') {
        const event = normalizeHookEvent(record.value, source, record.line);
        if (event) hookEvents.push(event);
        continue;
      }
      usageRecords.push(...normalizePayload(record.value, source, record.line));
    }
  }

  const extractorOptions = { extractors: options.extractors || [] };
  const enrichedUsage = attachUsageLabelEvidence(enrichCosts(usageRecords), extractorOptions);
  const enrichedHooks = attachHookLabelEvidence(hookEvents, extractorOptions);
  for (const usage of enrichedUsage) {
    for (const warning of usage.warnings) {
      warnings.push({
        code: warning.split(':')[0],
        line: usage.raw_line,
        message: warning,
      });
    }
  }

  await insertImport(dbPath, source, sourceFile, newRecords, enrichedUsage, enrichedHooks, warnings);

  return {
    source,
    file,
    dbPath,
    raw_records: importableRecords.length,
    new_raw_records: newRecords.length,
    skipped_existing_records: highWaterLine,
    usage_records: enrichedUsage.length,
    hook_events: enrichedHooks.length,
    label_evidence: enrichedUsage.reduce((sum, usage) => sum + (usage.label_evidence || []).length, 0)
      + enrichedHooks.reduce((sum, event) => sum + (event.label_evidence || []).length, 0),
    warnings,
    estimate_label: `estimate:${PRICING_VERSION}`,
  };
}

function configuredSourceFiles(paths, config = {}) {
  const sourceConfig = config.sources || {};
  const telemetryConfig = config.telemetry || {};
  const files = [
    { source: 'vscode', file: sourceConfig.vscode?.telemetry || telemetryConfig.vscode || paths.vscodeOtelJsonl },
    { source: 'hooks', file: sourceConfig.vscode?.hooks || paths.hookEventsJsonl },
    { source: 'copilot-cli', file: sourceConfig.copilotCli?.telemetry || telemetryConfig.copilotCli || paths.copilotCliOtelJsonl },
    { source: 'hooks', file: sourceConfig.copilotCli?.hooks || paths.hookEventsJsonl },
    ...discoverCopilotSessionFiles(sourceConfig.copilotCli?.sessions || paths.copilotSessionStateDir),
  ];
  const seen = new Set();
  return files
    .filter((entry) => entry.file)
    .map((entry) => ({ source: entry.source, file: path.resolve(entry.file) }))
    .filter((entry) => {
      const key = `${entry.source}\0${entry.file}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function discoverCopilotSessionFiles(sessionStateDir) {
  if (!sessionStateDir || !fs.existsSync(sessionStateDir)) return [];
  return fs.readdirSync(sessionStateDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(sessionStateDir, entry.name, 'events.jsonl'))
    .filter((file) => fs.existsSync(file))
    .map((file) => ({ source: 'copilot-session', file }));
}

function readConfig(configJson) {
  if (!fs.existsSync(configJson)) return {};
  return JSON.parse(fs.readFileSync(configJson, 'utf8'));
}

async function autoImportConfiguredSources(paths, options = {}) {
  const config = readConfig(paths.configJson);
  const extractors = options.extractors || loadConfiguredExtractors(paths.configJson, options.cwd || process.cwd());
  const results = [];
  for (const entry of configuredSourceFiles(paths, config)) {
    if (!fs.existsSync(entry.file)) {
      results.push({ ...entry, skipped: true, reason: 'missing_file' });
      continue;
    }
    results.push(await ingestFile({
      dbPath: paths.usageDb,
      file: entry.file,
      source: entry.source,
      extractors,
    }));
  }
  return results;
}

module.exports = {
  autoImportConfiguredSources,
  configuredSourceFiles,
  discoverCopilotSessionFiles,
  ingestFile,
};
