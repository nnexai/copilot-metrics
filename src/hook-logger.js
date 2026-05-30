'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { resolvePaths } = require('./paths');

const LABEL_RE = /\b[A-Z][A-Z0-9]+-\d+\b/g;

function extractLabelsFromValue(value, labels = new Set()) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(LABEL_RE)) labels.add(match[0]);
    return labels;
  }
  if (Array.isArray(value)) {
    for (const item of value) extractLabelsFromValue(item, labels);
    return labels;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) extractLabelsFromValue(item, labels);
  }
  return labels;
}

function firstString(payload, keys) {
  for (const key of keys) {
    const value = payload && payload[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

function redactHookPayload(payload, options = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    payload = {};
  }
  const includePromptPreview = options.includePromptPreview === true;
  const labels = Array.from(extractLabelsFromValue(payload)).sort();
  const prompt = firstString(payload, ['prompt', 'userPrompt', 'message', 'input']);

  return {
    captured_at: new Date().toISOString(),
    event: options.event || payload.event || null,
    session_id: firstString(payload, ['session_id', 'sessionId', 'conversationId']),
    cwd: firstString(payload, ['cwd', 'workingDirectory']),
    repo: firstString(payload, ['repo', 'repository']),
    branch: firstString(payload, ['branch', 'gitBranch']),
    transcript_path: firstString(payload, ['transcript_path', 'transcriptPath']),
    task_hint: firstString(payload, ['task_hint', 'taskHint', 'title']),
    tool_name: firstString(payload, ['tool_name', 'toolName', 'name']),
    labels,
    prompt_preview: includePromptPreview && prompt ? prompt.slice(0, 160) : undefined,
    raw_prompt_stored: false,
  };
}

function appendHookEvent(payload, options = {}) {
  const paths = resolvePaths(options);
  const record = redactHookPayload(payload, options);
  fs.mkdirSync(path.dirname(paths.hookEventsJsonl), { recursive: true, mode: 0o700 });
  fs.appendFileSync(paths.hookEventsJsonl, `${JSON.stringify(record)}\n`, { mode: 0o600 });
  return { path: paths.hookEventsJsonl, record };
}

async function readJsonFromStream(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  return JSON.parse(text);
}

module.exports = {
  LABEL_RE,
  extractLabelsFromValue,
  redactHookPayload,
  appendHookEvent,
  readJsonFromStream,
};
