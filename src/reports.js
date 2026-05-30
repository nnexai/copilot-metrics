'use strict';

const { queryRows } = require('./sqlite-store');
const { canonicalLabel } = require('./label-extractors');

function n(value) {
  return Number(value || 0);
}

function estimateLabel(rows) {
  return rows.find((row) => row.estimate_label)?.estimate_label || 'estimate:unknown';
}

function formatNumber(value) {
  return n(value).toLocaleString('en-US');
}

function formatCredits(value) {
  return n(value).toFixed(6);
}

function table(headers, rows) {
  const widths = headers.map((header, index) => Math.max(
    header.length,
    ...rows.map((row) => String(row[index] ?? '').length),
  ));
  const line = headers.map((header, index) => header.padEnd(widths[index])).join('  ');
  const sep = widths.map((width) => '-'.repeat(width)).join('  ');
  const body = rows.map((row) => row.map((cell, index) => String(cell ?? '').padEnd(widths[index])).join('  '));
  return [line, sep, ...body].join('\n');
}

async function labelOverview(dbPath) {
  return queryRows(dbPath, `
SELECT
  labels.label,
  (SELECT COUNT(DISTINCT session_id) FROM label_evidence WHERE label = labels.label) AS sessions,
  (SELECT COUNT(*) FROM label_evidence WHERE label = labels.label) AS evidence_count,
  (SELECT COUNT(DISTINCT usage_record_id) FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL) AS usage_records,
  COALESCE((SELECT SUM(input_tokens) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS input_tokens,
  COALESCE((SELECT SUM(output_tokens) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS output_tokens,
  COALESCE((SELECT SUM(cache_read_tokens) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS cache_read_tokens,
  COALESCE((SELECT SUM(cache_creation_tokens) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS cache_creation_tokens,
  COALESCE((SELECT SUM(reasoning_tokens) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS reasoning_tokens,
  COALESCE((SELECT SUM(COALESCE(estimated_ai_credits, 0)) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS estimated_ai_credits,
  (SELECT MIN(COALESCE(ur.timestamp, le.timestamp, le.imported_at)) FROM label_evidence le LEFT JOIN usage_records ur ON ur.id = le.usage_record_id WHERE le.label = labels.label) AS first_seen,
  (SELECT MAX(COALESCE(ur.timestamp, le.timestamp, le.imported_at)) FROM label_evidence le LEFT JOIN usage_records ur ON ur.id = le.usage_record_id WHERE le.label = labels.label) AS last_seen,
  (SELECT MAX(estimate_label) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)) AS estimate_label
FROM (SELECT DISTINCT label FROM label_evidence) labels
ORDER BY estimated_ai_credits DESC, labels.label`);
}

async function labelSummary(dbPath, label) {
  const rows = await queryRows(dbPath, `
SELECT
  labels.label,
  (SELECT COUNT(DISTINCT session_id) FROM label_evidence WHERE label = labels.label) AS sessions,
  (SELECT COUNT(*) FROM label_evidence WHERE label = labels.label) AS evidence_count,
  (SELECT COUNT(DISTINCT usage_record_id) FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL) AS usage_records,
  COALESCE((SELECT SUM(input_tokens) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS input_tokens,
  COALESCE((SELECT SUM(output_tokens) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS output_tokens,
  COALESCE((SELECT SUM(cache_read_tokens) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS cache_read_tokens,
  COALESCE((SELECT SUM(cache_creation_tokens) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS cache_creation_tokens,
  COALESCE((SELECT SUM(reasoning_tokens) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS reasoning_tokens,
  COALESCE((SELECT SUM(COALESCE(estimated_ai_credits, 0)) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS estimated_ai_credits,
  (SELECT MIN(COALESCE(ur.timestamp, le.timestamp, le.imported_at)) FROM label_evidence le LEFT JOIN usage_records ur ON ur.id = le.usage_record_id WHERE le.label = labels.label) AS first_seen,
  (SELECT MAX(COALESCE(ur.timestamp, le.timestamp, le.imported_at)) FROM label_evidence le LEFT JOIN usage_records ur ON ur.id = le.usage_record_id WHERE le.label = labels.label) AS last_seen,
  (SELECT MAX(estimate_label) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)) AS estimate_label
FROM (SELECT DISTINCT label FROM label_evidence WHERE label = ?) labels`, [canonicalLabel(label)]);
  return rows[0] || null;
}

async function labelDetails(dbPath, label) {
  return queryRows(dbPath, `
SELECT
  le.label,
  le.source_type,
  le.source_field,
  le.source_value,
  le.confidence,
  le.session_id,
  le.repo,
  le.branch,
  le.cwd,
  ur.id AS usage_record_id,
  ur.surface,
  ur.resolved_model,
  ur.input_tokens,
  ur.output_tokens,
  ur.estimated_ai_credits,
  ur.estimate_label,
  COALESCE(ur.timestamp, le.timestamp, le.imported_at) AS timestamp
FROM label_evidence le
LEFT JOIN usage_records ur ON ur.id = le.usage_record_id
WHERE le.label = ?
ORDER BY timestamp, le.source_type, le.source_field`, [canonicalLabel(label)]);
}

async function modelReport(dbPath) {
  return queryRows(dbPath, `
SELECT
  COALESCE(resolved_model, requested_model, 'unknown') AS model,
  COUNT(*) AS usage_records,
  SUM(input_tokens) AS input_tokens,
  SUM(output_tokens) AS output_tokens,
  SUM(cache_read_tokens) AS cache_read_tokens,
  SUM(cache_creation_tokens) AS cache_creation_tokens,
  SUM(reasoning_tokens) AS reasoning_tokens,
  SUM(COALESCE(estimated_ai_credits, 0)) AS estimated_ai_credits,
  MAX(estimate_label) AS estimate_label
FROM usage_records
GROUP BY COALESCE(resolved_model, requested_model, 'unknown')
ORDER BY estimated_ai_credits DESC, model`);
}

async function repoReport(dbPath) {
  return queryRows(dbPath, `
SELECT
  COALESCE(repo, 'unknown') AS repo,
  COALESCE(cwd, '') AS cwd,
  COUNT(*) AS usage_records,
  COUNT(DISTINCT session_id) AS sessions,
  SUM(input_tokens) AS input_tokens,
  SUM(output_tokens) AS output_tokens,
  SUM(COALESCE(estimated_ai_credits, 0)) AS estimated_ai_credits,
  MAX(estimate_label) AS estimate_label
FROM usage_records
GROUP BY COALESCE(repo, 'unknown'), COALESCE(cwd, '')
ORDER BY estimated_ai_credits DESC, repo, cwd`);
}

async function unattributedReport(dbPath) {
  return queryRows(dbPath, `
SELECT
  ur.id,
  ur.source,
  ur.surface,
  ur.session_id,
  ur.conversation_id,
  ur.repo,
  ur.branch,
  ur.cwd,
  ur.resolved_model,
  ur.input_tokens,
  ur.output_tokens,
  ur.estimated_ai_credits,
  ur.estimate_label,
  ur.timestamp
FROM usage_records ur
WHERE NOT EXISTS (
  SELECT 1 FROM label_evidence le WHERE le.usage_record_id = ur.id
)
ORDER BY ur.timestamp, ur.id`);
}

function formatLabels(rows) {
  return [
    table(
      ['Label', 'Sessions', 'Input', 'Output', 'Credits', 'Evidence', 'Last seen'],
      rows.map((row) => [
        row.label,
        row.sessions,
        formatNumber(row.input_tokens),
        formatNumber(row.output_tokens),
        formatCredits(row.estimated_ai_credits),
        row.evidence_count,
        row.last_seen || '',
      ]),
    ),
    '',
    `Costs are estimates (${estimateLabel(rows)}).`,
  ].join('\n');
}

function formatLabelSummary(summary, details = null) {
  if (!summary) return 'No usage found for label.';
  const lines = [
    table(
      ['Label', 'Sessions', 'Input', 'Output', 'Credits', 'Evidence'],
      [[summary.label, summary.sessions, formatNumber(summary.input_tokens), formatNumber(summary.output_tokens), formatCredits(summary.estimated_ai_credits), summary.evidence_count]],
    ),
  ];
  if (details) {
    lines.push('', table(
      ['Source', 'Field', 'Session', 'Model', 'Credits', 'Value'],
      details.map((row) => [
        row.source_type,
        row.source_field,
        row.session_id || '',
        row.resolved_model || '',
        formatCredits(row.estimated_ai_credits),
        row.source_value || '',
      ]),
    ));
  }
  lines.push('', `Costs are estimates (${summary.estimate_label || 'estimate:unknown'}).`);
  return lines.join('\n');
}

function formatModels(rows) {
  return [
    table(
      ['Model', 'Records', 'Input', 'Output', 'Credits'],
      rows.map((row) => [row.model, row.usage_records, formatNumber(row.input_tokens), formatNumber(row.output_tokens), formatCredits(row.estimated_ai_credits)]),
    ),
    '',
    `Costs are estimates (${estimateLabel(rows)}).`,
  ].join('\n');
}

function formatRepos(rows) {
  return [
    table(
      ['Repo', 'CWD', 'Sessions', 'Input', 'Output', 'Credits'],
      rows.map((row) => [row.repo, row.cwd, row.sessions, formatNumber(row.input_tokens), formatNumber(row.output_tokens), formatCredits(row.estimated_ai_credits)]),
    ),
    '',
    `Costs are estimates (${estimateLabel(rows)}).`,
  ].join('\n');
}

function formatUnattributed(rows) {
  return [
    table(
      ['ID', 'Source', 'Session', 'Repo', 'Branch', 'CWD', 'Model', 'Credits'],
      rows.map((row) => [row.id, row.source, row.session_id || '', row.repo || '', row.branch || '', row.cwd || '', row.resolved_model || '', formatCredits(row.estimated_ai_credits)]),
    ),
    '',
    `Costs are estimates (${estimateLabel(rows)}).`,
  ].join('\n');
}

module.exports = {
  labelOverview,
  labelSummary,
  labelDetails,
  modelReport,
  repoReport,
  unattributedReport,
  formatLabels,
  formatLabelSummary,
  formatModels,
  formatRepos,
  formatUnattributed,
};
