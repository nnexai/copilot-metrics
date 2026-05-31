'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readJsonl } = require('./jsonl');
const { normalizePayload, normalizeHookEvent, normalizeCopilotSessionEvents } = require('./otel');
const { estimateCost, PRICING_VERSION } = require('./pricing');
const {
  attachVscodeChatLabelEvidence,
  existingRawFingerprints,
  importedLineHighWater,
  insertImport,
  queryRows,
  updateUsageCostEstimates,
  updateVscodeUsageResponseIds,
  vscodeRawRecordsNeedingResponseBackfill,
} = require('./sqlite-store');
const { attachUsageLabelEvidence, attachHookLabelEvidence } = require('./labels');
const { loadConfiguredExtractors, runLabelExtractors } = require('./label-extractors');

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

function pushText(values, value) {
  if (typeof value === 'string' && value.trim()) values.push(value);
}

function pushPromptCandidates(values, value) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) pushPromptCandidates(values, item);
    return;
  }
  pushText(values, value.text);
  pushText(values, value.value);
  pushText(values, value.message);
  pushText(values, value.prompt);
  pushText(values, value.promptText);
  pushText(values, value.renderedUserMessage);
  pushText(values, value.userMessage);
  if (value.renderedUserMessage && typeof value.renderedUserMessage === 'object') {
    pushPromptCandidates(values, value.renderedUserMessage);
  }
  if (value.message && typeof value.message === 'object') pushPromptCandidates(values, value.message);
  if (value.result && typeof value.result === 'object') pushPromptCandidates(values, value.result);
  if (value.metadata && typeof value.metadata === 'object') pushPromptCandidates(values, value.metadata);
}

function responseId(value) {
  if (!value || typeof value !== 'object') return null;
  return value.responseId
    || value.metadata?.responseId
    || value.result?.responseId
    || value.result?.metadata?.responseId
    || value.modelMessageId
    || value.metadata?.modelMessageId
    || null;
}

function chatSessionId(value) {
  if (!value || typeof value !== 'object') return null;
  return value.sessionId
    || value.sessionID
    || value.metadata?.sessionId
    || value.result?.sessionId
    || value.result?.metadata?.sessionId
    || null;
}

function chatRequestIndex(record) {
  const key = Array.isArray(record.k) ? record.k : Array.isArray(record.key) ? record.key : [];
  if (key[0] !== 'requests') return null;
  const index = Number(key[1]);
  return Number.isInteger(index) ? index : null;
}

function normalizeVscodeChatSession(records, extractors = []) {
  const requests = new Map();
  let defaultSessionId = null;

  function entry(index) {
    const key = String(index);
    if (!requests.has(key)) requests.set(key, { texts: [] });
    return requests.get(key);
  }

  function mergeRequest(index, request, sessionId) {
    if (!request || typeof request !== 'object') return;
    const current = entry(index);
    current.sessionId = chatSessionId(request) || sessionId || current.sessionId;
    current.responseId = responseId(request) || current.responseId;
    pushPromptCandidates(current.texts, request);
  }

  for (const record of records) {
    const value = record.value;
    if (!value || typeof value !== 'object') continue;
    const root = value.v && typeof value.v === 'object' ? value.v : value;
    defaultSessionId = root.sessionId || root.sessionID || defaultSessionId;

    if (Array.isArray(root.requests)) {
      root.requests.forEach((request, index) => mergeRequest(index, request, defaultSessionId));
    }

    const key = Array.isArray(value.k) ? value.k : Array.isArray(value.key) ? value.key : [];
    if (key.length === 1 && key[0] === 'requests' && Array.isArray(value.v)) {
      const startIndex = requests.size;
      value.v.forEach((request, offset) => mergeRequest(startIndex + offset, request, defaultSessionId));
    }

    const index = chatRequestIndex(value);
    if (index !== null) {
      const current = entry(index);
      const patch = value.v;
      if (patch && typeof patch === 'object') {
        current.sessionId = chatSessionId(patch) || defaultSessionId || current.sessionId;
        current.responseId = responseId(patch) || current.responseId;
        pushPromptCandidates(current.texts, patch);
      } else {
        pushText(current.texts, patch);
      }
    }
  }

  return Array.from(requests.values())
    .filter((request) => request.responseId)
    .map((request) => {
      const labelEvidence = runLabelExtractors('usage', { prompt: request.texts }, extractors)
        .map((evidence) => ({
          ...evidence,
          source_type: 'usage',
          source_field: 'vscode_chat_response',
          source_value: request.responseId,
          confidence: Math.max(Number(evidence.confidence || 0), 0.95),
        }));
      return {
        responseId: request.responseId,
        sessionId: request.sessionId || defaultSessionId || null,
        label_evidence: labelEvidence,
      };
    })
    .filter((request) => request.label_evidence.length > 0);
}

async function ingestVscodeChatSessionFile(options) {
  const { dbPath, file } = options;
  const sourceFile = path.resolve(file);
  const parsed = readJsonl(sourceFile);
  const mappings = normalizeVscodeChatSession(parsed.records, options.extractors || []);
  const attached = await attachVscodeChatLabelEvidence(dbPath, mappings);
  return {
    source: 'vscode-chat',
    file,
    dbPath,
    raw_records: 0,
    new_raw_records: 0,
    skipped_existing_records: 0,
    usage_records: attached.matched_usage_records,
    hook_events: 0,
    label_evidence: attached.label_evidence,
    warnings: parsed.warnings,
    estimate_label: `estimate:${PRICING_VERSION}`,
  };
}

async function backfillVscodeUsageResponseIds(dbPath, sourceFile) {
  const rows = await vscodeRawRecordsNeedingResponseBackfill(dbPath, sourceFile);
  const updates = [];
  for (const row of rows) {
    let payload;
    try {
      payload = JSON.parse(row.payload_json);
    } catch {
      continue;
    }
    for (const usage of normalizePayload(payload, 'vscode', row.line)) {
      if (!usage.span_id) continue;
      updates.push({
        raw_line: usage.raw_line,
        span_id: usage.span_id,
        session_id: usage.session_id,
        timestamp: usage.timestamp,
        requested_model: usage.requested_model,
        resolved_model: usage.resolved_model,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_read_tokens: usage.cache_read_tokens,
        cache_creation_tokens: usage.cache_creation_tokens,
        reasoning_tokens: usage.reasoning_tokens,
      });
    }
  }
  return updateVscodeUsageResponseIds(dbPath, updates);
}

function parseWarningsJson(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function repairUsageCostEstimates(dbPath) {
  const rows = await queryRows(dbPath, `
    SELECT id, requested_model, resolved_model, input_tokens, output_tokens,
      cache_read_tokens, cache_creation_tokens, reasoning_tokens, warnings_json
    FROM usage_records
    WHERE estimated_ai_credits IS NULL
      OR estimated_ai_credits = 0
      OR warnings_json LIKE '%unknown_model:%'
      OR warnings_json LIKE '%missing_model%'
  `);
  const updates = [];
  for (const row of rows) {
    const estimate = estimateCost(row);
    if (estimate.warning) continue;
    const warnings = parseWarningsJson(row.warnings_json)
      .filter((warning) => !String(warning).startsWith('unknown_model:') && warning !== 'missing_model');
    updates.push({
      id: row.id,
      estimated_usd: estimate.estimated_usd,
      estimated_ai_credits: estimate.estimated_ai_credits,
      warnings,
    });
  }
  return updateUsageCostEstimates(dbPath, updates);
}

async function ingestFile(options) {
  const { dbPath, file, source } = options;
  if (source === 'vscode-chat') return ingestVscodeChatSessionFile(options);

  const sourceFile = path.resolve(file);
  const backfilledUsageRecords = source === 'vscode'
    ? await backfillVscodeUsageResponseIds(dbPath, sourceFile)
    : 0;
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
      backfilled_usage_records: backfilledUsageRecords,
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
  const repairedCostRecords = await repairUsageCostEstimates(dbPath);

  return {
    source,
    file,
    dbPath,
    raw_records: importableRecords.length,
    new_raw_records: newRecords.length,
    skipped_existing_records: highWaterLine,
    usage_records: enrichedUsage.length,
    hook_events: enrichedHooks.length,
    backfilled_usage_records: backfilledUsageRecords,
    repaired_cost_records: repairedCostRecords,
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
    ...discoverVscodeChatSessionFiles(sourceConfig.vscode?.chatSessions),
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

function listJsonlFiles(dir) {
  if (!dir || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
    .map((entry) => path.join(dir, entry.name));
}

function discoverWorkspaceChatSessions(workspaceStorageDir) {
  if (!workspaceStorageDir || !fs.existsSync(workspaceStorageDir)) return [];
  return fs.readdirSync(workspaceStorageDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => listJsonlFiles(path.join(workspaceStorageDir, entry.name, 'chatSessions')));
}

function discoverVscodeChatSessionFiles(configured) {
  const configuredEntries = Array.isArray(configured) ? configured : configured ? [configured] : [];
  const files = configuredEntries.length > 0
    ? configuredEntries.flatMap((entry) => {
      const resolved = path.resolve(entry);
      if (!fs.existsSync(resolved)) return [];
      const stat = fs.statSync(resolved);
      if (stat.isFile()) return [resolved];
      return listJsonlFiles(resolved).concat(discoverWorkspaceChatSessions(resolved));
    })
    : [
      path.join(os.homedir(), '.config', 'Code', 'User', 'workspaceStorage'),
      path.join(os.homedir(), '.config', 'Code - Insiders', 'User', 'workspaceStorage'),
    ].flatMap(discoverWorkspaceChatSessions);

  return files
    .sort()
    .map((file) => ({ source: 'vscode-chat', file }));
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
  discoverVscodeChatSessionFiles,
  backfillVscodeUsageResponseIds,
  ingestFile,
  normalizeVscodeChatSession,
  repairUsageCostEstimates,
};
