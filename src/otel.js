'use strict';

function attrsToObject(attrs) {
  if (!attrs) return {};
  if (attrs && typeof attrs === 'object' && Array.isArray(attrs._rawAttributes)) {
    return Object.fromEntries(attrs._rawAttributes);
  }
  if (!Array.isArray(attrs)) return attrs;
  const out = {};
  for (const attr of attrs) {
    if (Array.isArray(attr) && attr.length >= 2) {
      out[attr[0]] = attr[1];
      continue;
    }
    const value = attr.value;
    if (value && typeof value === 'object') {
      out[attr.key] = value.stringValue ?? value.intValue ?? value.doubleValue ?? value.boolValue ?? value.arrayValue;
    } else {
      out[attr.key] = value;
    }
  }
  return out;
}

function pick(attrs, keys) {
  for (const key of keys) {
    const value = attrs[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function number(attrs, keys) {
  const value = pick(attrs, keys);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberOrNull(attrs, keys) {
  const value = pick(attrs, keys);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const LABEL_RE = /\b[A-Z][A-Z0-9]+-\d+\b/g;

function collectLabels(value, labels = new Set()) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(LABEL_RE)) labels.add(match[0]);
    return labels;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectLabels(item, labels);
    return labels;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectLabels(item, labels);
  }
  return labels;
}

function flattenSpans(payload) {
  if (!payload || typeof payload !== 'object') return [];
  if (payload.name || payload.attributes || payload.spanId) return [payload];
  const spans = [];
  for (const resourceSpan of payload.resourceSpans || []) {
    const resourceAttrs = attrsToObject(resourceSpan.resource && resourceSpan.resource.attributes);
    for (const scopeSpan of resourceSpan.scopeSpans || []) {
      for (const span of scopeSpan.spans || []) {
        spans.push({ ...span, resourceAttributes: resourceAttrs });
      }
    }
  }
  return spans;
}

function timestampValue(value) {
  if (!value) return null;
  if (Array.isArray(value) && value.length >= 2) {
    const millis = (Number(value[0]) * 1000) + (Number(value[1]) / 1e6);
    return Number.isFinite(millis) ? new Date(millis).toISOString() : null;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    const millis = numeric > 1e15 ? numeric / 1e6 : numeric;
    return new Date(millis).toISOString();
  }
  if (typeof value === 'number') {
    const millis = value > 1e15 ? value / 1e6 : value;
    return new Date(millis).toISOString();
  }
  return value;
}

function classifySpan(span) {
  const attrs = attrsToObject(span.attributes);
  const eventName = String(pick(attrs, ['event.name']) || '').toLowerCase();
  const operation = String(pick(attrs, ['gen_ai.operation.name', 'llm.operation']) || '').toLowerCase();
  const name = String(span.name || '').toLowerCase();
  const hasTokens = number(attrs, [
    'gen_ai.usage.input_tokens',
    'llm.usage.prompt_tokens',
    'gen_ai.usage.output_tokens',
    'llm.usage.completion_tokens',
  ]) > 0;

  if (
    eventName.includes('agent')
    || eventName.includes('tool')
    || operation.includes('agent')
    || operation.includes('tool')
    || name.includes('agent')
    || name.includes('tool')
  ) {
    return 'non_billable';
  }
  if (hasTokens || operation.includes('chat') || operation.includes('completion') || operation.includes('generate')) {
    return 'llm';
  }
  return 'other';
}

function normalizeSpan(span, source, rawLine) {
  const attrs = attrsToObject(span.attributes);
  const resourceAttrs = attrsToObject(span.resourceAttributes || span.resource);
  const type = classifySpan(span);
  if (type !== 'llm') return null;

  const cacheReadTokens = numberOrNull(attrs, ['gen_ai.usage.cache_read_input_tokens', 'gen_ai.usage.cached_input_tokens', 'cache_read_tokens']);
  const pricingMetadata = pricingMetadataFromAttributes(attrs);
  return {
    raw_line: rawLine,
    span_id: span.spanId || span.span_id || pick(attrs, ['gen_ai.response.id']) || null,
    trace_id: span.traceId || span.trace_id || null,
    parent_span_id: span.parentSpanId || span.parent_span_id || null,
    timestamp: timestampValue(span.startTimeUnixNano || span.start_time || span.hrTime || attrs.timestamp),
    surface: source,
    conversation_id: pick(attrs, ['gen_ai.conversation.id', 'conversation.id', 'copilot.conversation.id']),
    session_id: pick(attrs, ['session.id', 'copilot.session.id']) || pick(resourceAttrs, ['session.id', 'copilot.session.id']),
    requested_model: pick(attrs, ['gen_ai.request.model', 'llm.request.model', 'llm.model_name']),
    resolved_model: pick(attrs, ['gen_ai.response.model', 'llm.response.model', 'model']),
    repo: pick(attrs, ['vcs.repository.name', 'git.repository', 'repo']) || pick(resourceAttrs, ['vcs.repository.name', 'service.name']),
    branch: pick(attrs, ['vcs.branch.name', 'git.branch', 'branch']),
    cwd: pick(attrs, ['process.command_line.cwd', 'cwd', 'working_directory']),
    commit_sha: pick(attrs, ['vcs.revision', 'git.commit', 'commit']),
    task_hint: pick(attrs, ['task_hint', 'task.hint', 'copilot.task.hint', 'title']),
    prompt_preview: pick(attrs, ['prompt_preview', 'prompt.preview']),
    input_tokens: number(attrs, ['gen_ai.usage.input_tokens', 'llm.usage.prompt_tokens', 'input_tokens', 'prompt_tokens']),
    output_tokens: number(attrs, ['gen_ai.usage.output_tokens', 'llm.usage.completion_tokens', 'output_tokens', 'completion_tokens']),
    cache_read_tokens: cacheReadTokens || 0,
    cache_creation_tokens: number(attrs, ['gen_ai.usage.cache_creation_input_tokens', 'gen_ai.usage.cache_write_input_tokens', 'cache_creation_tokens']),
    reasoning_tokens: number(attrs, ['gen_ai.usage.reasoning_tokens', 'reasoning_tokens']),
    cache_read_status: cacheReadTokens === null ? 'unknown' : cacheReadTokens > 0 ? 'known' : 'explicit_zero',
    pricing_metadata: pricingMetadata,
    included_or_zero: includedOrZeroFromAttributes(attrs),
    pricing_diagnostics: diagnosticsFromAttributes(attrs),
    warnings: [],
  };
}

function aiCreditsToUsdPerMillion(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number * 0.01 : null;
}

function pricingMetadataFromAttributes(attrs) {
  const input = aiCreditsToUsdPerMillion(pick(attrs, ['inputCost', 'billing.token_prices.default.input_price']));
  const output = aiCreditsToUsdPerMillion(pick(attrs, ['outputCost', 'billing.token_prices.default.output_price']));
  const cache = aiCreditsToUsdPerMillion(pick(attrs, ['cacheCost', 'billing.token_prices.default.cache_price']));
  if (input === null || output === null) return null;
  return {
    source: 'session',
    token_prices: {
      input_usd_per_million: input,
      output_usd_per_million: output,
      cache_read_usd_per_million: cache,
    },
  };
}

function includedOrZeroFromAttributes(attrs) {
  const multiplier = pick(attrs, ['multiplierNumeric']);
  return String(pick(attrs, ['pricing']) || '').includes('0x')
    || (multiplier !== null && multiplier !== undefined && multiplier !== '' && Number(multiplier) === 0)
    || String(pick(attrs, ['copilot.token.sku', 'sku']) || '').includes('quota');
}

function diagnosticsFromAttributes(attrs) {
  const diagnostics = [];
  if (pick(attrs, ['cacheKey'])) diagnostics.push('cache_key_present');
  if (pick(attrs, ['cacheType'])) diagnostics.push('cache_type_present');
  if (includedOrZeroFromAttributes(attrs)) diagnostics.push('included_or_zero');
  return diagnostics;
}

function normalizePayload(payload, source, rawLine) {
  return flattenSpans(payload)
    .map((span) => normalizeSpan(span, source, rawLine))
    .filter(Boolean);
}

function normalizeCopilotSessionEvents(newRecords, allRecords) {
  const session = {
    labels: new Set(),
    id: null,
    cwd: null,
    repo: null,
    branch: null,
    commit: null,
    conversationId: null,
  };

  for (const record of allRecords) {
    const event = record.value;
    if (!event || typeof event !== 'object') continue;
    if (event.type === 'session.start') {
      const data = event.data || {};
      const context = data.context || {};
      session.id = data.sessionId || session.id;
      session.cwd = context.cwd || session.cwd;
      session.repo = context.gitRoot || context.repository || session.repo;
      session.branch = context.branch || session.branch;
      session.commit = context.headCommit || session.commit;
      collectLabels(context, session.labels);
    }
    if (event.type === 'hook.start') {
      collectLabels(event.data && event.data.input, session.labels);
    }
    if (event.type === 'assistant.message') {
      const data = event.data || {};
      session.conversationId = data.interactionId || session.conversationId;
      collectLabels(data.content, session.labels);
    }
  }

  const records = [];
  for (const record of newRecords) {
    const event = record.value;
    if (!event || event.type !== 'session.shutdown') continue;
    const data = event.data || {};
    const modelMetrics = data.modelMetrics || {};
    for (const [model, metrics] of Object.entries(modelMetrics)) {
      const usage = metrics.usage || {};
      const cacheReadTokens = Number(usage.cacheReadTokens || 0);
      const diagnostics = [];
      const requestsCost = metrics.requests && Number(metrics.requests.cost);
      const totalPremiumRequests = Number(data.totalPremiumRequests);
      if (Number.isFinite(requestsCost) && requestsCost === 0) diagnostics.push('requests_cost_zero');
      if (Number.isFinite(totalPremiumRequests) && totalPremiumRequests === 0) diagnostics.push('total_premium_requests_zero');
      records.push({
        raw_line: record.line,
        span_id: event.id || null,
        trace_id: session.id || null,
        parent_span_id: event.parentId || null,
        timestamp: event.timestamp || null,
        surface: 'copilot-cli-session',
        conversation_id: session.conversationId,
        session_id: session.id,
        requested_model: model,
        resolved_model: model,
        repo: session.repo,
        branch: session.branch,
        cwd: session.cwd,
        commit_sha: session.commit,
        labels: Array.from(session.labels).sort(),
        input_tokens: Number(usage.inputTokens || 0),
        output_tokens: Number(usage.outputTokens || 0),
        cache_read_tokens: cacheReadTokens,
        cache_creation_tokens: Number(usage.cacheWriteTokens || 0),
        reasoning_tokens: Number(usage.reasoningTokens || 0),
        cache_read_status: cacheReadTokens > 0 ? 'known' : 'explicit_zero',
        actual_charge_nano_aiu: Number.isFinite(Number(metrics.totalNanoAiu)) ? Number(metrics.totalNanoAiu) : null,
        included_or_zero: (Number.isFinite(requestsCost) && requestsCost === 0)
          || (Number.isFinite(totalPremiumRequests) && totalPremiumRequests === 0),
        pricing_metadata: {
          source: 'copilot-session',
          requests: metrics.requests || null,
          totalPremiumRequests: Number.isFinite(totalPremiumRequests) ? totalPremiumRequests : null,
        },
        pricing_diagnostics: diagnostics,
        warnings: [],
      });
    }
  }
  return records;
}

function normalizeHookEvent(payload, source, rawLine) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  return {
    raw_line: rawLine,
    event: payload.event || null,
    timestamp: payload.captured_at || payload.timestamp || null,
    session_id: payload.session_id || payload.sessionId || null,
    cwd: payload.cwd || null,
    repo: payload.repo || payload.repository || null,
    branch: payload.branch || payload.gitBranch || null,
    task_hint: payload.task_hint || payload.taskHint || null,
    labels: Array.isArray(payload.labels) ? payload.labels : [],
    payload,
  };
}

module.exports = {
  attrsToObject,
  flattenSpans,
  classifySpan,
  normalizePayload,
  normalizeCopilotSessionEvents,
  normalizeHookEvent,
};
