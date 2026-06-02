'use strict';

const path = require('node:path');

const JIRA_LABEL_RE = /\b([A-Z][A-Z0-9]+-\d+)\b/gi;
const DEFAULT_LABEL_PATTERNS = [JIRA_LABEL_RE];

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

function ensureGlobalFlags(flags = '') {
  const unique = Array.from(new Set(String(flags).split('').filter(Boolean))).join('');
  return unique.includes('g') ? unique : `${unique}g`;
}

function parseRegexLiteral(value) {
  const match = String(value).match(/^\/(.+)\/([a-z]*)$/i);
  return match ? { pattern: match[1], flags: match[2] } : null;
}

function compileLabelPattern(entry) {
  if (entry instanceof RegExp) {
    return new RegExp(entry.source, ensureGlobalFlags(entry.flags));
  }

  if (typeof entry === 'string') {
    const literal = parseRegexLiteral(entry);
    if (literal) return new RegExp(literal.pattern, ensureGlobalFlags(literal.flags));
    return new RegExp(entry, 'gi');
  }

  if (entry && typeof entry.pattern === 'string') {
    return new RegExp(entry.pattern, ensureGlobalFlags(entry.flags || 'i'));
  }

  throw new Error('Configured label pattern must be a regex string or an object with a pattern field.');
}

function configuredLabelPatterns(config = {}) {
  const patterns = [];
  if (config.labelPattern) patterns.push(config.labelPattern);
  if (config.labelRegex) patterns.push(config.labelRegex);
  if (Array.isArray(config.labelPatterns)) patterns.push(...config.labelPatterns);
  return patterns.map(compileLabelPattern);
}

function matchLabelPatterns(text, patterns) {
  const labels = [];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (const match of String(text).matchAll(pattern)) {
      labels.push(canonicalLabel(match[1] || match[0]));
    }
  }
  return labels;
}

function extractLabelsWithPatterns(sourceType, sourceData = {}, patterns = DEFAULT_LABEL_PATTERNS) {
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
      for (const label of matchLabelPatterns(item, patterns)) {
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

function extractJiraLabels(sourceType, sourceData = {}) {
  return extractLabelsWithPatterns(sourceType, sourceData, DEFAULT_LABEL_PATTERNS);
}

function createPatternExtractor(patterns) {
  const compiled = patterns.map(compileLabelPattern);
  return (sourceType, sourceData) => extractLabelsWithPatterns(sourceType, sourceData, compiled);
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
  const extractors = customExtractors.length > 0 ? customExtractors : [extractJiraLabels];
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

function loadConfiguredExtractors(configPath, cwd = process.cwd()) {
  let config;
  try {
    config = require(configPath);
  } catch {
    return [];
  }

  const configured = Array.isArray(config.labelExtractors) ? config.labelExtractors : [];
  if (configured.length === 0) {
    const patterns = configuredLabelPatterns(config);
    return patterns.length > 0 ? [createPatternExtractor(patterns)] : [];
  }

  return configured.map((entry) => {
    const modulePath = typeof entry === 'string' ? entry : entry && entry.path;
    if (!modulePath) return null;
    const resolved = path.isAbsolute(modulePath) ? modulePath : path.resolve(cwd, modulePath);
    const mod = require(resolved);
    if (typeof mod === 'function') return mod;
    if (typeof mod.extractLabels === 'function') return mod.extractLabels;
    throw new Error(`Configured label extractor does not export a function: ${modulePath}`);
  }).filter(Boolean);
}

module.exports = {
  DEFAULT_LABEL_PATTERNS,
  JIRA_LABEL_RE,
  canonicalLabel,
  configuredLabelPatterns,
  createPatternExtractor,
  extractJiraLabels,
  loadConfiguredExtractors,
  runLabelExtractors,
};
