'use strict';

function attrsToObject(attrs) {
  if (!attrs) return {};
  if (!Array.isArray(attrs)) return attrs;
  const out = {};
  for (const attr of attrs) {
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

function classifySpan(span) {
  const attrs = attrsToObject(span.attributes);
  const operation = String(pick(attrs, ['gen_ai.operation.name', 'llm.operation']) || '').toLowerCase();
  const name = String(span.name || '').toLowerCase();
  const hasTokens = number(attrs, [
    'gen_ai.usage.input_tokens',
    'llm.usage.prompt_tokens',
    'gen_ai.usage.output_tokens',
    'llm.usage.completion_tokens',
  ]) > 0;

  if (operation.includes('agent') || operation.includes('tool') || name.includes('agent') || name.includes('tool')) {
    return 'non_billable';
  }
  if (hasTokens || operation.includes('chat') || operation.includes('completion') || operation.includes('generate')) {
    return 'llm';
  }
  return 'other';
}

function normalizeSpan(span, source, rawLine) {
  const attrs = attrsToObject(span.attributes);
  const resourceAttrs = attrsToObject(span.resourceAttributes);
  const type = classifySpan(span);
  if (type !== 'llm') return null;

  return {
    raw_line: rawLine,
    span_id: span.spanId || span.span_id || null,
    trace_id: span.traceId || span.trace_id || null,
    parent_span_id: span.parentSpanId || span.parent_span_id || null,
    timestamp: span.startTimeUnixNano || span.start_time || attrs['timestamp'] || null,
    surface: source,
    conversation_id: pick(attrs, ['gen_ai.conversation.id', 'conversation.id', 'copilot.conversation.id']),
    session_id: pick(attrs, ['session.id', 'copilot.session.id']),
    requested_model: pick(attrs, ['gen_ai.request.model', 'llm.request.model', 'llm.model_name']),
    resolved_model: pick(attrs, ['gen_ai.response.model', 'llm.response.model', 'model']),
    repo: pick(attrs, ['vcs.repository.name', 'git.repository', 'repo']) || pick(resourceAttrs, ['vcs.repository.name', 'service.name']),
    branch: pick(attrs, ['vcs.branch.name', 'git.branch', 'branch']),
    cwd: pick(attrs, ['process.command_line.cwd', 'cwd', 'working_directory']),
    commit_sha: pick(attrs, ['vcs.revision', 'git.commit', 'commit']),
    input_tokens: number(attrs, ['gen_ai.usage.input_tokens', 'llm.usage.prompt_tokens', 'input_tokens', 'prompt_tokens']),
    output_tokens: number(attrs, ['gen_ai.usage.output_tokens', 'llm.usage.completion_tokens', 'output_tokens', 'completion_tokens']),
    cache_read_tokens: number(attrs, ['gen_ai.usage.cache_read_input_tokens', 'gen_ai.usage.cached_input_tokens', 'cache_read_tokens']),
    cache_creation_tokens: number(attrs, ['gen_ai.usage.cache_creation_input_tokens', 'gen_ai.usage.cache_write_input_tokens', 'cache_creation_tokens']),
    reasoning_tokens: number(attrs, ['gen_ai.usage.reasoning_tokens', 'reasoning_tokens']),
    warnings: [],
  };
}

function normalizePayload(payload, source, rawLine) {
  return flattenSpans(payload)
    .map((span) => normalizeSpan(span, source, rawLine))
    .filter(Boolean);
}

function normalizeHookEvent(payload, source, rawLine) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  return {
    raw_line: rawLine,
    event: payload.event || null,
    session_id: payload.session_id || payload.sessionId || null,
    cwd: payload.cwd || null,
    repo: payload.repo || payload.repository || null,
    branch: payload.branch || payload.gitBranch || null,
    labels: Array.isArray(payload.labels) ? payload.labels : [],
    payload,
  };
}

module.exports = {
  attrsToObject,
  flattenSpans,
  classifySpan,
  normalizePayload,
  normalizeHookEvent,
};
