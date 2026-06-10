'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readJsonl } = require('./jsonl');
const { normalizePayload, normalizeHookEvent, normalizeCopilotSessionEvents } = require('./otel');
const { classifyPricing, PRICING_VERSION } = require('./pricing');
const {
  attachVscodeChatLabelEvidence,
  existingRawFingerprints,
  importCheckpoint,
  importedLineHighWater,
  initStore,
  insertImport,
  loadImportState,
  repairDuplicateVscodeUsageRecords,
  queryRows,
  runImportMutationBatch,
  upsertImportCheckpoint,
  updateUsageCostEstimates,
  updateVscodeUsageResponseIds,
  vscodeRawRecordsNeedingResponseBackfill,
} = require('./sqlite-store');
const { attachUsageLabelEvidence, attachHookLabelEvidence } = require('./labels');
const { loadConfiguredExtractors, runLabelExtractors } = require('./label-extractors');

function enrichCosts(records) {
  return records.map((record) => {
    const pricing = classifyPricing(record);
    const warnings = [...record.warnings, ...pricing.warnings];
    return {
      ...record,
      usage_identity: usageIdentity(record),
      actual_charge_nano_aiu: pricing.actual_charge_nano_aiu,
      actual_ai_credits: pricing.actual_ai_credits,
      actual_usd: pricing.actual_usd,
      actual_basis: pricing.actual_basis,
      displayed_ai_credits: pricing.displayed_ai_credits,
      displayed_usd: pricing.displayed_usd,
      displayed_credit_text: pricing.displayed_credit_text,
      displayed_credit_basis: pricing.displayed_credit_basis,
      inferred_cache_read_tokens: pricing.inferred_cache_read_tokens,
      inferred_cache_read_reason: pricing.inferred_cache_read_reason,
      estimated_usd: pricing.estimated_usd,
      estimated_ai_credits: pricing.estimated_ai_credits,
      upper_bound_usd: pricing.upper_bound_usd,
      upper_bound_ai_credits: pricing.upper_bound_ai_credits,
      selected_ai_credits: pricing.selected_ai_credits,
      selected_usd: pricing.selected_usd,
      selected_pricing_basis: pricing.selected_pricing_basis,
      selected_confidence: pricing.selected_confidence,
      selected_source: pricing.selected_source,
      pricing_basis: pricing.pricing_basis,
      estimate_confidence: pricing.estimate_confidence,
      cache_read_status: pricing.cache_read_status,
      pricing_source: pricing.pricing_source,
      estimate_label: `estimate:${PRICING_VERSION}`,
      pricing_metadata: record.pricing_metadata || null,
      pricing_diagnostics: pricing.pricing_diagnostics,
      warnings,
    };
  });
}

function usageIdentity(record) {
  const model = record.resolved_model || record.requested_model || '';
  if (record.source === 'vscode' || record.source === 'vscode-chat' || record.surface === 'vscode-chat-session') {
    if (record.span_id) return `vscode-response:${record.span_id}|model:${model}`;
    const session = record.session_id || record.trace_id || '';
    const timestamp = record.timestamp || '';
    if (session || timestamp) return `vscode-session:${session}|time:${timestamp}|model:${model}`;
  }
  const tokens = [
    record.input_tokens || 0,
    record.output_tokens || 0,
    record.cache_read_tokens || 0,
    record.cache_creation_tokens || 0,
    record.reasoning_tokens || 0,
  ].join(':');
  if (record.span_id) return `span:${record.span_id}|model:${model}`;
  const session = record.session_id || record.trace_id || '';
  const conversation = record.conversation_id || '';
  const timestamp = record.timestamp || '';
  if (session || conversation || timestamp) {
    return `session:${session}|conversation:${conversation}|time:${timestamp}|model:${model}|tokens:${tokens}`;
  }
  return null;
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

function importStateKey(source, sourceFile) {
  return `${source}\0${sourceFile}`;
}

async function sourceHighWater(options, source, sourceFile) {
  const state = options.importState;
  if (state?.highWater) {
    return Number(state.highWater.get(importStateKey(source, sourceFile)) || 0);
  }
  return importedLineHighWater(options.dbPath, source, sourceFile);
}

async function sourceCheckpoint(options, source, sourceFile) {
  const state = options.importState;
  if (state?.checkpoints) {
    const checkpoint = state.checkpoints.get(importStateKey(source, sourceFile));
    if (checkpoint) return checkpoint;
    return {
      checkpoint_line: await sourceHighWater(options, source, sourceFile),
      context: {},
    };
  }
  return importCheckpoint(options.dbPath, source, sourceFile);
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

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function readSessionRecords(file, options = {}) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.jsonl') return readJsonl(file, options);
  if (ext !== '.json') {
    return {
      records: [],
      warnings: [{ code: 'unsupported_format', line: null, message: `Unsupported fallback session file format: ${file}` }],
    };
  }
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    const values = Array.isArray(value) ? value : [value];
    const afterLine = Number(options.afterLine || 0);
    return {
      records: values
        .map((item, index) => ({ line: index + 1, value: item }))
        .filter((record) => record.line > afterLine),
      warnings: [],
    };
  } catch (error) {
    return {
      records: [],
      warnings: [{ code: 'malformed_json', line: null, message: `Malformed JSON session file: ${error.message}` }],
    };
  }
}

function fileStatContext(file) {
  const stat = fs.statSync(file);
  return {
    size: stat.size,
    mtimeMs: Math.trunc(stat.mtimeMs),
  };
}

function vscodeDebugFileForSession(sessionFile, sessionId) {
  if (!sessionId) return null;
  const sessionDir = path.dirname(sessionFile);
  if (path.basename(sessionDir) !== 'chatSessions') return null;
  const workspaceDir = path.dirname(sessionDir);
  const candidates = [
    path.join(workspaceDir, 'GitHub.copilot-chat', 'debug-logs', sessionId, 'main.jsonl'),
    path.join(workspaceDir, 'debug-logs', sessionId, 'main.jsonl'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function vscodeChatRefreshStatContext(file) {
  const sessionId = path.basename(file, path.extname(file));
  const chat = fileStatContext(file);
  const debugFile = vscodeDebugFileForSession(file, sessionId);
  if (!debugFile) return chat;
  const debug = fileStatContext(debugFile);
  return {
    ...chat,
    debugSize: debug.size,
    debugMtimeMs: debug.mtimeMs,
  };
}

function checkpointFileStat(checkpoint) {
  const value = checkpoint?.context?.file_stat;
  if (!value || typeof value !== 'object') return null;
  return {
    size: Number(value.size || 0),
    mtimeMs: Math.trunc(Number(value.mtimeMs || 0)),
  };
}

function sameFileStat(left, right) {
  return Boolean(left && right
    && left.size === right.size
    && left.mtimeMs === right.mtimeMs
    && Number(left.debugSize || 0) === Number(right.debugSize || 0)
    && Number(left.debugMtimeMs || 0) === Number(right.debugMtimeMs || 0));
}

function shouldForceRefreshFile(options, checkpoint, statContext) {
  if (options.forceRefresh !== true) return false;
  if (sameFileStat(checkpointFileStat(checkpoint), statContext)) return false;
  if (Number(checkpoint?.checkpoint_line || 0) <= 0) return true;

  const recentWindowMs = Number(options.refreshChangedSinceMs || 24 * 60 * 60 * 1000);
  if (recentWindowMs <= 0) return false;
  return Date.now() - Number(statContext.mtimeMs || 0) <= recentWindowMs;
}

function pickValue(object, keys) {
  if (!object || typeof object !== 'object') return null;
  for (const key of keys) {
    const value = object[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function tokenNumber(object, keys) {
  const value = pickValue(object, keys);
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function hasAnyKey(object, keys) {
  if (!object || typeof object !== 'object') return false;
  return keys.some((key) => object[key] !== undefined && object[key] !== null && object[key] !== '');
}

function usageCandidate(value) {
  if (!value || typeof value !== 'object') return {};
  return value.usage || value.tokenUsage || value.metrics || value.modelMetrics || value;
}

function requestUsage(request) {
  const candidates = [
    usageCandidate(request),
    usageCandidate(request.result),
    usageCandidate(request.response),
    usageCandidate(request.metadata),
    usageCandidate(request.result && request.result.metadata),
  ];
  const merged = {};
  for (const candidate of candidates) {
    for (const [key, value] of Object.entries(candidate || {})) {
      if (merged[key] === undefined) merged[key] = value;
    }
  }
  const hasCacheRead = candidates.some((candidate) => hasAnyKey(candidate, ['cacheReadTokens', 'cache_read_tokens', 'cachedInputTokens']));
  return {
    input_tokens: tokenNumber(merged, ['inputTokens', 'input_tokens', 'promptTokens', 'prompt_tokens']),
    output_tokens: tokenNumber(merged, ['outputTokens', 'output_tokens', 'completionTokens', 'completion_tokens']),
    cache_read_tokens: tokenNumber(merged, ['cacheReadTokens', 'cache_read_tokens', 'cachedInputTokens']),
    cache_creation_tokens: tokenNumber(merged, ['cacheWriteTokens', 'cacheCreationTokens', 'cache_creation_tokens']),
    reasoning_tokens: tokenNumber(merged, ['reasoningTokens', 'reasoning_tokens']),
    cache_read_status: hasCacheRead
      ? tokenNumber(merged, ['cacheReadTokens', 'cache_read_tokens', 'cachedInputTokens']) > 0 ? 'known' : 'explicit_zero'
      : 'unknown',
  };
}

function detailsText(value) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    return value.map(detailsText).filter(Boolean).join(' ');
  }
  if (value && typeof value === 'object') {
    return detailsText(value.text)
      || detailsText(value.value)
      || detailsText(value.label)
      || detailsText(value.markdown)
      || null;
  }
  return null;
}

function displayedCreditFromText(text) {
  const value = detailsText(text);
  if (!value) return null;
  if (/\b0\s*x\b/i.test(value)) {
    return {
      displayed_ai_credits: 0,
      displayed_credit_text: value,
      displayed_credit_basis: 'vscode_result_details',
      included_or_zero: true,
    };
  }
  const match = value.match(/(?:^|[^\d])(\d+(?:\.\d+)?)\s*credits?\b/i);
  if (!match) return null;
  const credits = Number(match[1]);
  if (!Number.isFinite(credits) || credits < 0) return null;
  return {
    displayed_ai_credits: credits,
    displayed_credit_text: value,
    displayed_credit_basis: 'vscode_result_details',
    included_or_zero: credits === 0,
  };
}

function displayedCreditFromRequest(request) {
  const candidates = [
    request?.details,
    request?.result?.details,
    request?.response?.details,
    request?.metadata?.details,
    request?.result?.metadata?.details,
  ];
  for (const candidate of candidates) {
    const parsed = displayedCreditFromText(candidate);
    if (parsed) return parsed;
  }
  return null;
}

function aiCreditsToUsdPerMillion(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number * 0.01 : null;
}

function pricingMetadataFromModelMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return null;
  const tokenPrices = metadata.billing?.token_prices?.default || metadata.token_prices?.default || metadata.token_prices || {};
  const input = aiCreditsToUsdPerMillion(metadata.inputCost ?? tokenPrices.input_price ?? tokenPrices.inputCost);
  const output = aiCreditsToUsdPerMillion(metadata.outputCost ?? tokenPrices.output_price ?? tokenPrices.outputCost);
  const cache = aiCreditsToUsdPerMillion(metadata.cacheCost ?? tokenPrices.cache_price ?? tokenPrices.cacheCost);
  if (input === null || output === null) return null;
  return {
    source: 'session',
    token_prices: {
      input_usd_per_million: input,
      output_usd_per_million: output,
      cache_read_usd_per_million: cache,
    },
    priceCategory: metadata.priceCategory || null,
    pricing: metadata.pricing || null,
  };
}

function modelMetadataFromRequest(request) {
  return request?.inputState?.selectedModel?.metadata
    || request?.selectedModel?.metadata
    || request?.metadata?.selectedModel?.metadata
    || request?.metadata?.modelMetadata
    || request?.result?.metadata?.selectedModel?.metadata
    || null;
}

function diagnosticsFromRequest(request) {
  const diagnostics = [];
  const metadata = request?.metadata || request?.result?.metadata || {};
  if (metadata.cacheKey || request?.cacheKey) diagnostics.push('cache_key_present');
  if (metadata.cacheType || request?.cacheType) diagnostics.push('cache_type_present');
  if (Array.isArray(metadata.renderedUserMessage)) {
    for (const item of metadata.renderedUserMessage) {
      if (item && typeof item === 'object' && item.cacheType) diagnostics.push(`cache_type:${item.cacheType}`);
    }
  }
  const modelMetadata = modelMetadataFromRequest(request) || metadata;
  if (String(modelMetadata.pricing || '').includes('0x')) diagnostics.push('included_or_zero');
  const multiplier = modelMetadata.multiplierNumeric ?? metadata.multiplierNumeric;
  if (multiplier !== null && multiplier !== undefined && multiplier !== '' && Number(multiplier) === 0) diagnostics.push('included_or_zero');
  return Array.from(new Set(diagnostics));
}

function includedOrZeroFromRequest(request) {
  return diagnosticsFromRequest(request).includes('included_or_zero');
}

function requestModel(request) {
  return pickValue(request, ['resolvedModel', 'model', 'modelId', 'modelName'])
    || pickValue(request.result, ['resolvedModel', 'model', 'modelId', 'modelName'])
    || pickValue(request.metadata, ['resolvedModel', 'model', 'modelId', 'modelName'])
    || pickValue(request.result && request.result.metadata, ['resolvedModel', 'model', 'modelId', 'modelName']);
}

function mergeFallbackRequest(current, request, sessionId, rawLine, defaultPricingMetadata = null, defaultDiagnostics = [], defaultIncludedOrZero = false) {
  current.sessionId = chatSessionId(request) || sessionId || current.sessionId;
  current.responseId = responseId(request) || current.responseId;
  current.model = requestModel(request) || current.model;
  current.timestamp = pickValue(request, ['timestamp', 'createdAt', 'startedAt'])
    || pickValue(request.result, ['timestamp', 'createdAt', 'completedAt'])
    || current.timestamp;
  current.repo = pickValue(request, ['repo', 'repository']) || pickValue(request.metadata, ['repo', 'repository']) || current.repo;
  current.branch = pickValue(request, ['branch', 'gitBranch']) || pickValue(request.metadata, ['branch', 'gitBranch']) || current.branch;
  current.cwd = pickValue(request, ['cwd', 'workingDirectory']) || pickValue(request.metadata, ['cwd', 'workingDirectory']) || current.cwd;
  current.task_hint = pickValue(request, ['task_hint', 'taskHint', 'title']) || pickValue(request.metadata, ['task_hint', 'taskHint', 'title']) || current.task_hint;
  current.rawLine = rawLine || current.rawLine;
  const usage = requestUsage(request);
  for (const [key, value] of Object.entries(usage)) {
    if (key === 'cache_read_status') {
      current.cache_read_status = value;
    } else if (value > 0) {
      current[key] = value;
    }
  }
  current.pricing_metadata = pricingMetadataFromModelMetadata(modelMetadataFromRequest(request)) || defaultPricingMetadata || current.pricing_metadata;
  const displayedCredit = displayedCreditFromRequest(request);
  if (displayedCredit) {
    current.displayed_ai_credits = displayedCredit.displayed_ai_credits;
    current.displayed_credit_text = displayedCredit.displayed_credit_text;
    current.displayed_credit_basis = displayedCredit.displayed_credit_basis;
  }
  current.included_or_zero = displayedCredit?.included_or_zero || includedOrZeroFromRequest(request) || defaultIncludedOrZero || current.included_or_zero || false;
  current.pricing_diagnostics = Array.from(new Set([...(current.pricing_diagnostics || []), ...defaultDiagnostics, ...diagnosticsFromRequest(request)]));
  pushPromptCandidates(current.texts, request);
}

function normalizeVscodeFallbackUsage(records) {
  const requests = new Map();
  let defaultSessionId = null;
  let defaultPricingMetadata = null;
  let defaultDiagnostics = [];
  let defaultIncludedOrZero = false;

  function entry(index) {
    const key = String(index);
    if (!requests.has(key)) requests.set(key, { texts: [] });
    return requests.get(key);
  }

  for (const record of records) {
    const value = record.value;
    if (!value || typeof value !== 'object') continue;
    const root = value.v && typeof value.v === 'object' ? value.v : value;
    defaultSessionId = root.sessionId || root.sessionID || defaultSessionId;
    defaultPricingMetadata = pricingMetadataFromModelMetadata(root.inputState?.selectedModel?.metadata)
      || pricingMetadataFromModelMetadata(root.selectedModel?.metadata)
      || defaultPricingMetadata;
    defaultDiagnostics = Array.from(new Set([
      ...defaultDiagnostics,
      ...diagnosticsFromRequest({ metadata: root.inputState?.selectedModel?.metadata || root.selectedModel?.metadata || {} }),
    ]));
    defaultIncludedOrZero = defaultDiagnostics.includes('included_or_zero') || defaultIncludedOrZero;
    const rootDisplayedCredit = displayedCreditFromRequest(root);
    if (rootDisplayedCredit) {
      defaultIncludedOrZero = rootDisplayedCredit.included_or_zero || defaultIncludedOrZero;
      defaultDiagnostics = Array.from(new Set([...defaultDiagnostics, 'displayed_credit_root']));
    }

    if (Array.isArray(root.requests)) {
      root.requests.forEach((request, index) => mergeFallbackRequest(entry(index), request, defaultSessionId, record.line, defaultPricingMetadata, defaultDiagnostics, defaultIncludedOrZero));
    }

    const key = Array.isArray(value.k) ? value.k : Array.isArray(value.key) ? value.key : [];
    if (key.length === 1 && key[0] === 'requests' && Array.isArray(value.v)) {
      const startIndex = requests.size;
      value.v.forEach((request, offset) => mergeFallbackRequest(entry(startIndex + offset), request, defaultSessionId, record.line, defaultPricingMetadata, defaultDiagnostics, defaultIncludedOrZero));
    }

    const index = chatRequestIndex(value);
    if (index !== null) {
      const patch = value.v;
      if (patch && typeof patch === 'object') {
        mergeFallbackRequest(entry(index), patch, defaultSessionId, record.line, defaultPricingMetadata, defaultDiagnostics, defaultIncludedOrZero);
      } else {
        pushText(entry(index).texts, patch);
      }
    }
  }

  return Array.from(requests.values())
    .filter((request) => (request.input_tokens || request.output_tokens || request.cache_read_tokens || request.cache_creation_tokens || request.reasoning_tokens) > 0)
    .map((request) => ({
      raw_line: request.rawLine || 1,
      span_id: request.responseId || null,
      trace_id: request.sessionId || defaultSessionId || null,
      parent_span_id: null,
      timestamp: request.timestamp || null,
      surface: 'vscode-chat-session',
      conversation_id: null,
      session_id: request.sessionId || defaultSessionId || null,
      requested_model: request.model || null,
      resolved_model: request.model || null,
      repo: request.repo || null,
      branch: request.branch || null,
      cwd: request.cwd || null,
      commit_sha: null,
      task_hint: request.task_hint || null,
      prompt: request.texts,
      input_tokens: request.input_tokens || 0,
      output_tokens: request.output_tokens || 0,
      cache_read_tokens: request.cache_read_tokens || 0,
      cache_creation_tokens: request.cache_creation_tokens || 0,
      reasoning_tokens: request.reasoning_tokens || 0,
      cache_read_status: request.cache_read_status || 'unknown',
      pricing_metadata: request.pricing_metadata || null,
      displayed_ai_credits: request.displayed_ai_credits ?? null,
      displayed_credit_text: request.displayed_credit_text || null,
      displayed_credit_basis: request.displayed_credit_basis || null,
      included_or_zero: request.included_or_zero || false,
      pricing_diagnostics: request.pricing_diagnostics || [],
      warnings: request.model ? [] : ['missing_model'],
    }));
}

function readVscodeDebugCachedTokens(sessionFile, sessionId) {
  if (!sessionId) return null;
  const sessionDir = path.dirname(sessionFile);
  if (path.basename(sessionDir) !== 'chatSessions') return null;
  const debugFile = vscodeDebugFileForSession(sessionFile, sessionId);
  if (!debugFile) return null;
  const parsed = readJsonl(debugFile);
  let cachedTokens = 0;
  let seen = false;
  for (const record of parsed.records) {
    const value = record.value;
    if (!value || typeof value !== 'object') continue;
    const eventName = value.type || value.event || value.name;
    const attrs = value.attrs || value.attributes || value.data?.attrs || value.data?.attributes || {};
    if (eventName !== 'llm_request' && !attrs.cachedTokens) continue;
    const number = Number(attrs.cachedTokens ?? attrs.cacheReadTokens ?? attrs.cache_read_tokens);
    if (Number.isFinite(number)) {
      cachedTokens += number;
      seen = true;
    }
  }
  return seen ? { file: debugFile, cachedTokens } : null;
}

function applyVscodeDebugCachedTokens(usageRecords, sourceFile) {
  return usageRecords.map((usage) => {
    if (usage.cache_read_status !== 'unknown') return usage;
    const debug = readVscodeDebugCachedTokens(sourceFile, usage.session_id);
    if (!debug) return usage;
    return {
      ...usage,
      cache_read_tokens: debug.cachedTokens,
      cache_read_status: debug.cachedTokens > 0 ? 'known' : 'explicit_zero',
      pricing_diagnostics: Array.from(new Set([...(usage.pricing_diagnostics || []), 'vscode_debug_cached_tokens'])),
    };
  });
}

function redactedSessionRecord(record) {
  const value = record.value || {};
  return {
    ...record,
    value: {
      type: value.type || value.kind || null,
      id: value.id || null,
      parentId: value.parentId || null,
      timestamp: value.timestamp || null,
      checkpoint: true,
    },
  };
}

const LABEL_RE = /\b[A-Z][A-Z0-9]+-\d+\b/g;

function collectSafeLabels(value, labels = new Set()) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(LABEL_RE)) labels.add(match[0]);
    return labels;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectSafeLabels(item, labels);
    return labels;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectSafeLabels(item, labels);
  }
  return labels;
}

function updateCopilotSessionContext(previous, records) {
  const context = {
    labels: Array.isArray(previous.labels) ? previous.labels : [],
    id: previous.id || null,
    cwd: previous.cwd || null,
    repo: previous.repo || null,
    branch: previous.branch || null,
    commit: previous.commit || null,
    conversationId: previous.conversationId || null,
  };
  const labels = new Set(context.labels);

  for (const record of records) {
    const event = record.value;
    if (!event || typeof event !== 'object') continue;
    if (event.type === 'session.start') {
      const data = event.data || {};
      const sessionContext = data.context || {};
      context.id = data.sessionId || context.id;
      context.cwd = sessionContext.cwd || context.cwd;
      context.repo = sessionContext.gitRoot || sessionContext.repository || context.repo;
      context.branch = sessionContext.branch || context.branch;
      context.commit = sessionContext.headCommit || context.commit;
      collectSafeLabels(sessionContext, labels);
    }
    if (event.type === 'hook.start') {
      collectSafeLabels(event.data && event.data.input, labels);
    }
    if (event.type === 'assistant.message') {
      const data = event.data || {};
      context.conversationId = data.interactionId || context.conversationId;
      collectSafeLabels(data.content, labels);
    }
  }

  context.labels = Array.from(labels).sort();
  return context;
}

function syntheticCopilotContextRecords(context) {
  if (!context || Object.keys(context).length === 0) return [];
  return [{
    line: 0,
    value: {
      type: 'session.start',
      data: {
        sessionId: context.id,
        context: {
          cwd: context.cwd,
          gitRoot: context.repo,
          branch: context.branch,
          headCommit: context.commit,
          labels: context.labels,
        },
      },
    },
  }, {
    line: 0,
    value: {
      type: 'assistant.message',
      data: {
        interactionId: context.conversationId,
        content: Array.isArray(context.labels) ? context.labels.join(' ') : '',
      },
    },
  }];
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
  const checkpoint = await sourceCheckpoint(options, 'vscode-chat', sourceFile);
  const statContext = vscodeChatRefreshStatContext(sourceFile);
  const forceRead = shouldForceRefreshFile(options, checkpoint, statContext);
  const highWaterLine = forceRead
    ? 0
    : Math.max(Number(checkpoint.checkpoint_line || 0), await sourceHighWater(options, 'vscode-chat', sourceFile));
  const parsed = readSessionRecords(sourceFile, { afterLine: highWaterLine });
  if (parsed.records.length === 0 && parsed.warnings.length === 0) {
    if (!sameFileStat(checkpointFileStat(checkpoint), statContext)) {
      await upsertImportCheckpoint(dbPath, 'vscode-chat', sourceFile, highWaterLine, { file_stat: statContext });
    }
    return {
      source: 'vscode-chat',
      file,
      dbPath,
      raw_records: 0,
      new_raw_records: 0,
      skipped_existing_records: highWaterLine,
      usage_records: 0,
      duplicate_usage_records: 0,
      repaired_duplicate_usage_records: 0,
      hook_events: 0,
      label_evidence: 0,
      warnings: [],
      estimate_label: `estimate:${PRICING_VERSION}`,
    };
  }
  const allRecords = parsed.records.map((record) => ({
    ...record,
    raw_fingerprint: rawFingerprint('vscode-chat', sourceFile, record),
  }));
  const existing = await existingRawFingerprints(
    dbPath,
    'vscode-chat',
    sourceFile,
    allRecords.map((record) => record.raw_fingerprint),
  );
  const newRecords = forceRead
    ? allRecords
    : allRecords.filter((record) => !existing.has(record.raw_fingerprint));
  const fallbackUsage = attachUsageLabelEvidence(
    enrichCosts(applyVscodeDebugCachedTokens(normalizeVscodeFallbackUsage(newRecords), sourceFile)),
    { extractors: options.extractors || [] },
  );
  const mappings = normalizeVscodeChatSession(parsed.records, options.extractors || []);
  const attached = await attachVscodeChatLabelEvidence(dbPath, mappings);
  const warnings = [...parsed.warnings];
  if (parsed.records.length > 0 && fallbackUsage.length === 0) {
    warnings.push({
      code: mappings.length > 0 ? 'content_only_session' : 'no_token_metrics',
      line: null,
      message: `${file} did not contain token-bearing VS Code fallback usage records.`,
    });
  }
  for (const usage of fallbackUsage) {
    for (const warning of usage.warnings) {
      warnings.push({ code: warning.split(':')[0], line: usage.raw_line, message: warning });
    }
  }
  let importResult = null;
  let repairedDuplicateUsageRecords = 0;
  await runImportMutationBatch(dbPath, async () => {
    if (newRecords.length > 0 || fallbackUsage.length > 0 || warnings.length > 0) {
      const redactedRawRecords = newRecords.map((record) => ({
        ...record,
        value: {
          fallback_session: true,
          responseId: responseId(record.value) || null,
          sessionId: chatSessionId(record.value) || null,
        },
      }));
      importResult = await insertImport(dbPath, 'vscode-chat', sourceFile, redactedRawRecords, fallbackUsage, [], warnings);
      const nextLine = newRecords.reduce((max, record) => Math.max(max, Number(record.line || 0)), highWaterLine);
      await upsertImportCheckpoint(dbPath, 'vscode-chat', sourceFile, nextLine, { file_stat: statContext });
    }
    repairedDuplicateUsageRecords = await repairDuplicateVscodeUsageRecords(dbPath);
  });
  return {
    source: 'vscode-chat',
    file,
    dbPath,
    raw_records: allRecords.length,
    new_raw_records: newRecords.length,
    skipped_existing_records: highWaterLine,
    usage_records: Math.max(0, (importResult?.inserted_usage_records || 0) + attached.matched_usage_records - repairedDuplicateUsageRecords),
    duplicate_usage_records: importResult?.duplicate_usage_records || 0,
    repaired_duplicate_usage_records: repairedDuplicateUsageRecords,
    hook_events: 0,
    label_evidence: fallbackUsage.reduce((sum, usage) => sum + (usage.label_evidence || []).length, 0) + attached.label_evidence,
    warnings,
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
  await initStore(dbPath);
  const rows = await queryRows(dbPath, `
    SELECT id, requested_model, resolved_model, input_tokens, output_tokens,
      cache_read_tokens, cache_creation_tokens, reasoning_tokens, cache_read_status,
      displayed_ai_credits, displayed_credit_text, displayed_credit_basis,
      pricing_metadata_json, pricing_diagnostics_json, warnings_json
    FROM usage_records
    WHERE estimated_ai_credits IS NULL
      OR estimated_ai_credits = 0
      OR selected_pricing_basis IS NULL
      OR warnings_json LIKE '%unknown_model:%'
      OR warnings_json LIKE '%missing_model%'
  `);
  const updates = [];
  for (const row of rows) {
    let pricingMetadata = {};
    let pricingDiagnostics = [];
    try {
      pricingMetadata = JSON.parse(row.pricing_metadata_json || '{}');
    } catch {
      pricingMetadata = {};
    }
    try {
      const parsed = JSON.parse(row.pricing_diagnostics_json || '[]');
      pricingDiagnostics = Array.isArray(parsed) ? parsed : [];
    } catch {
      pricingDiagnostics = [];
    }
    const estimate = classifyPricing({
      ...row,
      pricing_metadata: pricingMetadata,
      pricing_diagnostics: pricingDiagnostics,
    });
    if (estimate.warnings.some((warning) => String(warning).startsWith('unknown_model:') || warning === 'missing_model')) continue;
    const warnings = parseWarningsJson(row.warnings_json)
      .filter((warning) => !String(warning).startsWith('unknown_model:') && warning !== 'missing_model');
    updates.push({
      id: row.id,
      estimated_usd: estimate.estimated_usd,
      estimated_ai_credits: estimate.estimated_ai_credits,
      upper_bound_usd: estimate.upper_bound_usd,
      upper_bound_ai_credits: estimate.upper_bound_ai_credits,
      displayed_ai_credits: estimate.displayed_ai_credits,
      displayed_usd: estimate.displayed_usd,
      displayed_credit_text: estimate.displayed_credit_text,
      displayed_credit_basis: estimate.displayed_credit_basis,
      inferred_cache_read_tokens: estimate.inferred_cache_read_tokens,
      inferred_cache_read_reason: estimate.inferred_cache_read_reason,
      selected_ai_credits: estimate.selected_ai_credits,
      selected_usd: estimate.selected_usd,
      selected_pricing_basis: estimate.selected_pricing_basis,
      selected_confidence: estimate.selected_confidence,
      selected_source: estimate.selected_source,
      pricing_basis: estimate.pricing_basis,
      estimate_confidence: estimate.estimate_confidence,
      cache_read_status: estimate.cache_read_status,
      pricing_source: estimate.pricing_source,
      pricing_metadata: pricingMetadata,
      pricing_diagnostics: estimate.pricing_diagnostics,
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
  const checkpoint = await sourceCheckpoint(options, source, sourceFile);
  const statContext = fileStatContext(sourceFile);
  const checkpointStat = checkpointFileStat(checkpoint);
  const unchangedFile = sameFileStat(checkpointStat, statContext) && Number(checkpoint?.checkpoint_line || 0) > 0;
  const forceRead = options.forceRefresh === true && !unchangedFile;
  const highWaterLine = forceRead ? 0 : await sourceHighWater(options, source, sourceFile);
  const checkpointLine = forceRead ? 0 : Math.max(Number(checkpoint.checkpoint_line || 0), highWaterLine);
  if (unchangedFile && backfilledUsageRecords === 0) {
    return {
      source,
      file,
      dbPath,
      raw_records: 0,
      new_raw_records: 0,
      skipped_existing_records: checkpointLine,
      usage_records: 0,
      duplicate_usage_records: 0,
      repaired_duplicate_usage_records: 0,
      hook_events: 0,
      backfilled_usage_records: 0,
      repaired_cost_records: 0,
      label_evidence: 0,
      warnings: [],
      estimate_label: `estimate:${PRICING_VERSION}`,
      skipped: true,
      reason: 'unchanged_file',
    };
  }
  const parsed = readJsonl(file, { afterLine: checkpointLine });
  const warnings = [...parsed.warnings];
  if (parsed.records.length === 0 && warnings.length === 0) {
    if (!sameFileStat(checkpointStat, statContext)) {
      await upsertImportCheckpoint(dbPath, source, sourceFile, checkpointLine, {
        ...(checkpoint?.context || {}),
        file_stat: statContext,
      });
    }
    return {
      source,
      file,
      dbPath,
      raw_records: 0,
      new_raw_records: 0,
      skipped_existing_records: checkpointLine,
      usage_records: 0,
      duplicate_usage_records: 0,
      repaired_duplicate_usage_records: 0,
      hook_events: 0,
      backfilled_usage_records: backfilledUsageRecords,
      repaired_cost_records: 0,
      label_evidence: 0,
      warnings: [],
      estimate_label: `estimate:${PRICING_VERSION}`,
    };
  }
  const parsedRecords = parsed.records.map((record) => ({
    ...record,
    raw_fingerprint: rawFingerprint(source, sourceFile, record),
  }));
  const importableRecords = source === 'copilot-session' ? parsedRecords : parsedRecords;
  const existing = await existingRawFingerprints(
    dbPath,
    source,
    sourceFile,
    importableRecords.map((record) => record.raw_fingerprint),
  );
  const newRecords = options.forceRefresh
    ? importableRecords
    : importableRecords.filter((record) => !existing.has(record.raw_fingerprint));
  const usageRecords = [];
  const hookEvents = [];

  if (source === 'copilot-session') {
    const context = updateCopilotSessionContext(checkpoint?.context || {}, newRecords);
    usageRecords.push(...normalizeCopilotSessionEvents(
      newRecords.filter(isCopilotSessionUsageRecord),
      syntheticCopilotContextRecords(context).concat(newRecords),
    ));
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

  const rawRecordsToInsert = source === 'copilot-session' ? newRecords.map(redactedSessionRecord) : newRecords;
  let importResult = { inserted_usage_records: 0, duplicate_usage_records: 0 };
  let repairedCostRecords = 0;
  let repairedDuplicateUsageRecords = 0;
  await runImportMutationBatch(dbPath, async () => {
    if (rawRecordsToInsert.length > 0 || enrichedUsage.length > 0 || enrichedHooks.length > 0 || warnings.length > 0) {
      importResult = await insertImport(dbPath, source, sourceFile, rawRecordsToInsert, enrichedUsage, enrichedHooks, warnings);
    }
    if (source === 'copilot-session') {
      const nextLine = newRecords.reduce((max, record) => Math.max(max, Number(record.line || 0)), checkpointLine);
      const context = {
        ...updateCopilotSessionContext(checkpoint?.context || {}, newRecords),
        file_stat: statContext,
      };
      if (newRecords.length > 0 || nextLine > checkpointLine) {
        await upsertImportCheckpoint(dbPath, source, sourceFile, nextLine, context);
      }
    } else if (parsedRecords.length > 0 || warnings.length > 0 || !sameFileStat(checkpointStat, statContext)) {
      const nextLine = parsedRecords.reduce((max, record) => Math.max(max, Number(record.line || 0)), checkpointLine);
      await upsertImportCheckpoint(dbPath, source, sourceFile, nextLine, {
        ...(checkpoint?.context || {}),
        file_stat: statContext,
      });
    }
    repairedCostRecords = options.repairCostEstimates === false ? 0 : await repairUsageCostEstimates(dbPath);
    repairedDuplicateUsageRecords = ['vscode', 'copilot-session'].includes(source) ? await repairDuplicateVscodeUsageRecords(dbPath) : 0;
  });

  return {
    source,
    file,
    dbPath,
    raw_records: importableRecords.length,
    new_raw_records: newRecords.length,
    skipped_existing_records: checkpointLine,
    usage_records: importResult.inserted_usage_records,
    duplicate_usage_records: importResult.duplicate_usage_records,
    repaired_duplicate_usage_records: repairedDuplicateUsageRecords,
    hook_events: enrichedHooks.length,
    backfilled_usage_records: backfilledUsageRecords,
    repaired_cost_records: repairedCostRecords,
    label_evidence: enrichedUsage.reduce((sum, usage) => sum + (usage.label_evidence || []).length, 0)
      + enrichedHooks.reduce((sum, event) => sum + (event.label_evidence || []).length, 0),
    warnings,
    estimate_label: `estimate:${PRICING_VERSION}`,
  };
}

function discoverSourceFilesFromEntries(entries, source, diagnostics, options = {}) {
  const files = [];
  for (const entry of asArray(entries)) {
    const resolved = path.resolve(entry);
    let stat;
    try {
      stat = fs.statSync(resolved);
    } catch (error) {
      diagnostics.push({ source, file: resolved, code: 'missing_path', message: `Fallback source path is missing: ${resolved}` });
      continue;
    }
    if (stat.isFile()) {
      if (options.extensions && !options.extensions.includes(path.extname(resolved).toLowerCase())) {
        diagnostics.push({ source, file: resolved, code: 'unsupported_format', message: `Unsupported fallback source format: ${resolved}` });
        continue;
      }
      files.push(resolved);
      continue;
    }
    if (!stat.isDirectory()) continue;
    files.push(...discoverFilesInDirectory(resolved, source, diagnostics, options));
  }
  return files;
}

function discoverFilesInDirectory(dir, source, diagnostics, options = {}) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    diagnostics.push({ source, file: dir, code: 'unreadable_path', message: `Fallback source path is unreadable: ${dir}` });
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && (!options.extensions || options.extensions.includes(path.extname(entry.name).toLowerCase()))) {
      files.push(full);
    }
    if (entry.isDirectory() && options.workspaceStorage === true) {
      files.push(...listSessionFiles(path.join(full, 'chatSessions'), source, diagnostics, options));
    }
  }
  return files;
}

function listSessionFiles(dir, source, diagnostics, options = {}) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && (!options.extensions || options.extensions.includes(path.extname(entry.name).toLowerCase())))
    .map((entry) => path.join(dir, entry.name));
}

function configuredSourceEntries(paths, config = {}) {
  const sourceConfig = config.sources || {};
  const telemetryConfig = config.telemetry || {};
  const diagnostics = [];
  const vscodeChatSessions = [
    ...asArray(sourceConfig.vscode?.chatSessions || paths.vscodeChatSessionDirs),
    ...asArray(sourceConfig.vscode?.additionalChatSessions),
  ];
  const copilotSessions = [
    sourceConfig.copilotCli?.sessions || paths.copilotSessionStateDir,
    ...asArray(sourceConfig.copilotCli?.additionalSessions),
  ];
  const files = [
    { source: 'vscode', file: sourceConfig.vscode?.telemetry || telemetryConfig.vscode || paths.vscodeOtelJsonl },
    ...discoverVscodeChatSessionFiles(vscodeChatSessions, diagnostics),
    { source: 'hooks', file: sourceConfig.vscode?.hooks || paths.hookEventsJsonl },
    { source: 'copilot-cli', file: sourceConfig.copilotCli?.telemetry || telemetryConfig.copilotCli || paths.copilotCliOtelJsonl },
    { source: 'hooks', file: sourceConfig.copilotCli?.hooks || paths.hookEventsJsonl },
    ...discoverCopilotSessionFiles(copilotSessions, diagnostics),
  ];
  const seen = new Set();
  return {
    diagnostics,
    files: files
    .filter((entry) => entry.file)
    .map((entry) => ({ source: entry.source, file: path.resolve(entry.file) }))
    .filter((entry) => {
      const key = `${entry.source}\0${entry.file}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  };
}

function configuredSourceFiles(paths, config = {}) {
  return configuredSourceEntries(paths, config).files;
}

function discoverVscodeChatSessionFiles(configured, diagnostics = []) {
  const files = discoverSourceFilesFromEntries(configured, 'vscode-chat', diagnostics, {
    extensions: ['.jsonl', '.json'],
    workspaceStorage: true,
  });

  return files
    .sort()
    .map((file) => ({ source: 'vscode-chat', file }));
}

function discoverCopilotSessionFiles(sessionStateDir, diagnostics = []) {
  const files = [];
  for (const dir of asArray(sessionStateDir)) {
    const resolved = path.resolve(dir);
    let entries;
    try {
      entries = fs.readdirSync(resolved, { withFileTypes: true });
    } catch {
      diagnostics.push({ source: 'copilot-session', file: resolved, code: 'missing_path', message: `Fallback source path is missing: ${resolved}` });
      continue;
    }
    files.push(...entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(resolved, entry.name, 'events.jsonl'))
      .filter((file) => fs.existsSync(file)));
  }
  return files
    .map((file) => ({ source: 'copilot-session', file }));
}

function readConfig(configJson) {
  if (!fs.existsSync(configJson)) return {};
  return JSON.parse(fs.readFileSync(configJson, 'utf8'));
}

async function autoImportConfiguredSources(paths, options = {}) {
  const config = readConfig(paths.configJson);
  const extractors = options.extractors || loadConfiguredExtractors(paths.configJson, options.cwd || process.cwd());
  if (typeof options.onProgress === 'function') {
    options.onProgress({ phase: 'discover' });
  }
  const sourceEntries = configuredSourceEntries(paths, config);
  const importState = await loadImportState(paths.usageDb);
  if (typeof options.onProgress === 'function') {
    options.onProgress({ phase: 'start', total: sourceEntries.files.length });
  }
  const results = sourceEntries.diagnostics.map((diagnostic) => ({
    ...diagnostic,
    skipped: true,
    reason: diagnostic.code,
    diagnostic: true,
  }));
  await runImportMutationBatch(paths.usageDb, async () => {
    for (const [index, entry] of sourceEntries.files.entries()) {
      if (typeof options.onProgress === 'function') {
        options.onProgress({
          phase: 'source',
          current: index + 1,
          total: sourceEntries.files.length,
          source: entry.source,
          file: entry.file,
        });
      }
      if (!fs.existsSync(entry.file)) {
        results.push({ ...entry, skipped: true, reason: 'missing_file' });
        if (typeof options.onProgress === 'function') {
          options.onProgress({ phase: 'done', current: index + 1, total: sourceEntries.files.length, result: results[results.length - 1] });
        }
        continue;
      }
      try {
        results.push(await ingestFile({
          dbPath: paths.usageDb,
          file: entry.file,
          source: entry.source,
          extractors,
          importState,
          repairCostEstimates: false,
          forceRefresh: options.forceRefresh === true,
        }));
      } catch (error) {
        results.push({
          ...entry,
          skipped: true,
          reason: 'import_error',
          warnings: [{
            code: 'import_error',
            line: null,
            message: `Could not import ${entry.source} fallback source ${entry.file}: ${error && error.message ? error.message : error && error.name ? error.name : String(error)}`,
          }],
        });
      }
      if (typeof options.onProgress === 'function') {
        options.onProgress({ phase: 'done', current: index + 1, total: sourceEntries.files.length, result: results[results.length - 1] });
      }
    }
  });
  if (typeof options.onProgress === 'function') {
    options.onProgress({ phase: 'finish', total: sourceEntries.files.length });
  }
  let repairedCostRecords = 0;
  let repairedDuplicateUsageRecords = 0;
  await runImportMutationBatch(paths.usageDb, async () => {
    repairedCostRecords = await repairUsageCostEstimates(paths.usageDb);
    repairedDuplicateUsageRecords = await repairDuplicateVscodeUsageRecords(paths.usageDb);
  });
  if (repairedCostRecords > 0) {
    results.push({
      source: 'store',
      file: paths.usageDb,
      dbPath: paths.usageDb,
      raw_records: 0,
      new_raw_records: 0,
      skipped_existing_records: 0,
      usage_records: 0,
      duplicate_usage_records: 0,
      repaired_duplicate_usage_records: 0,
      hook_events: 0,
      repaired_cost_records: repairedCostRecords,
      label_evidence: 0,
      warnings: [],
      estimate_label: `estimate:${PRICING_VERSION}`,
    });
  }
  if (repairedDuplicateUsageRecords > 0) {
    results.push({
      source: 'store',
      file: paths.usageDb,
      dbPath: paths.usageDb,
      raw_records: 0,
      new_raw_records: 0,
      skipped_existing_records: 0,
      usage_records: 0,
      duplicate_usage_records: 0,
      repaired_duplicate_usage_records: repairedDuplicateUsageRecords,
      hook_events: 0,
      repaired_cost_records: 0,
      label_evidence: 0,
      warnings: [],
      estimate_label: `estimate:${PRICING_VERSION}`,
    });
  }
  return results;
}

module.exports = {
  autoImportConfiguredSources,
  configuredSourceEntries,
  configuredSourceFiles,
  discoverCopilotSessionFiles,
  discoverVscodeChatSessionFiles,
  backfillVscodeUsageResponseIds,
  ingestFile,
  applyVscodeDebugCachedTokens,
  normalizeVscodeFallbackUsage,
  normalizeVscodeChatSession,
  repairUsageCostEstimates,
  repairDuplicateVscodeUsageRecords,
};
