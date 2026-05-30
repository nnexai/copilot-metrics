'use strict';

const JIRA_LABEL_RE = /\b([A-Z][A-Z0-9]+-\d+)\b/gi;

function canonicalLabel(label) {
  return String(label || '').trim().toUpperCase();
}

function fieldConfidence(field) {
  if (field === 'labels') return 1;
  if (field === 'branch') return 0.85;
  if (field === 'cwd') return 0.75;
  if (field === 'task_hint') return 0.7;
  if (field === 'repo') return 0.35;
  return 0.5;
}

function sourceValue(field, value, label) {
  if (['prompt', 'message', 'input', 'prompt_preview', 'task_hint'].includes(field)) return label;
  if (typeof value === 'string') return value.slice(0, 240);
  if (Array.isArray(value)) return value.map((item) => String(item).slice(0, 120)).join(',');
  return label;
}

function extractJiraLabels(sourceType, sourceData = {}) {
  const evidence = [];
  const fields = {
    labels: sourceData.labels,
    branch: sourceData.branch,
    cwd: sourceData.cwd,
    repo: sourceData.repo,
    task_hint: sourceData.task_hint,
    prompt: sourceData.prompt,
    prompt_preview: sourceData.prompt_preview,
    message: sourceData.message,
    input: sourceData.input,
  };

  for (const [field, value] of Object.entries(fields)) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item === undefined || item === null) continue;
      const text = String(item);
      for (const match of text.matchAll(JIRA_LABEL_RE)) {
        const label = canonicalLabel(match[1]);
        evidence.push({
          label,
          source_type: sourceType,
          source_field: field,
          source_value: sourceValue(field, item, label),
          confidence: fieldConfidence(field),
        });
      }
    }
  }

  return evidence;
}

function normalizeExtractorResult(result, sourceType) {
  const items = Array.isArray(result) ? result : [];
  return items
    .map((item) => (typeof item === 'string' ? { label: item } : item))
    .filter((item) => item && item.label)
    .map((item) => ({
      label: canonicalLabel(item.label),
      source_type: item.source_type || sourceType,
      source_field: item.source_field || item.field || 'custom',
      source_value: item.source_value || item.value || canonicalLabel(item.label),
      confidence: Number.isFinite(Number(item.confidence)) ? Number(item.confidence) : 0.5,
    }));
}

function runLabelExtractors(sourceType, sourceData, customExtractors = []) {
  const extractors = [extractJiraLabels, ...customExtractors];
  const seen = new Set();
  const evidence = [];

  for (const extractor of extractors) {
    const results = normalizeExtractorResult(extractor(sourceType, sourceData), sourceType);
    for (const item of results) {
      const key = `${item.label}\0${item.source_type}\0${item.source_field}\0${item.source_value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      evidence.push(item);
    }
  }

  return evidence;
}

module.exports = {
  JIRA_LABEL_RE,
  canonicalLabel,
  extractJiraLabels,
  runLabelExtractors,
};
