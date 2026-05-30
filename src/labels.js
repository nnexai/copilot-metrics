'use strict';

const { runLabelExtractors } = require('./label-extractors');

function usageSourceData(usage) {
  return {
    labels: usage.labels || [],
    repo: usage.repo,
    branch: usage.branch,
    cwd: usage.cwd,
    session_id: usage.session_id,
    conversation_id: usage.conversation_id,
    task_hint: usage.task_hint,
    prompt: usage.prompt,
    prompt_preview: usage.prompt_preview,
    message: usage.message,
    input: usage.input,
  };
}

function hookSourceData(event) {
  const payload = event.payload || {};
  return {
    labels: event.labels || payload.labels || [],
    repo: event.repo || payload.repo,
    branch: event.branch || payload.branch,
    cwd: event.cwd || payload.cwd,
    session_id: event.session_id || payload.session_id,
    task_hint: event.task_hint || payload.task_hint || payload.taskHint,
    prompt: payload.prompt,
    prompt_preview: payload.prompt_preview,
    message: payload.message,
    input: payload.input,
  };
}

function attachUsageLabelEvidence(usageRecords, options = {}) {
  return usageRecords.map((usage) => ({
    ...usage,
    label_evidence: runLabelExtractors('usage', usageSourceData(usage), options.extractors),
  }));
}

function attachHookLabelEvidence(hookEvents, options = {}) {
  return hookEvents.map((event) => ({
    ...event,
    label_evidence: runLabelExtractors('hook', hookSourceData(event), options.extractors),
  }));
}

module.exports = {
  usageSourceData,
  hookSourceData,
  attachUsageLabelEvidence,
  attachHookLabelEvidence,
};
