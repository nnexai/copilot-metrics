'use strict';

const { initStore, queryRows } = require('./sqlite-store');
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

function formatTokens(value) {
  const number = n(value);
  if (Math.abs(number) >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M`;
  if (Math.abs(number) >= 10_000) return `${(number / 1_000).toFixed(1)}K`;
  return formatNumber(number);
}

function formatCredits(value) {
  return n(value).toFixed(2);
}

function selectedCredits(row) {
  return row.selected_ai_credits === undefined || row.selected_ai_credits === null
    ? row.estimated_ai_credits
    : row.selected_ai_credits;
}

function selectedUsd(row) {
  return row.selected_usd === undefined || row.selected_usd === null
    ? row.estimated_usd
    : row.selected_usd;
}

function formatDollars(value, fallbackCredits = 0) {
  const dollars = value === undefined || value === null ? n(fallbackCredits) * 0.01 : n(value);
  return `$${dollars.toFixed(2)}`;
}

function formatDate(value) {
  return typeof value === 'string' ? value.slice(0, 10) : '';
}

function usageStatus(row) {
  return n(row.usage_records) > 0 ? 'usage' : 'evidence-only';
}

function pricingBasis(row) {
  if (n(row.actual_usage_records) > 0) return 'actual';
  if (n(row.displayed_credit_usage_records) > 0) return 'display*';
  if (n(row.upper_bound_usage_records) > 0) return 'upper';
  if (row.selected_pricing_basis === 'displayed_credit') return 'display*';
  if (row.selected_pricing_basis) return row.selected_pricing_basis;
  if (row.pricing_basis === 'displayed_credit') return 'display*';
  return row.pricing_basis || 'est';
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
  await initStore(dbPath);
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
  COALESCE((SELECT SUM(COALESCE(estimated_usd, 0)) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS estimated_usd,
  COALESCE((SELECT SUM(COALESCE(actual_ai_credits, 0)) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS actual_ai_credits,
  COALESCE((SELECT SUM(COALESCE(actual_usd, 0)) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS actual_usd,
  COALESCE((SELECT SUM(COALESCE(displayed_ai_credits, 0)) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS displayed_ai_credits,
  COALESCE((SELECT SUM(COALESCE(displayed_usd, 0)) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS displayed_usd,
  COALESCE((SELECT SUM(COALESCE(inferred_cache_read_tokens, 0)) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS inferred_cache_read_tokens,
  COALESCE((SELECT SUM(COALESCE(upper_bound_ai_credits, 0)) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS upper_bound_ai_credits,
  COALESCE((SELECT SUM(COALESCE(upper_bound_usd, 0)) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS upper_bound_usd,
  COALESCE((SELECT SUM(COALESCE(selected_ai_credits, 0)) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS selected_ai_credits,
  COALESCE((SELECT SUM(COALESCE(selected_usd, 0)) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS selected_usd,
  (SELECT COUNT(*) FROM usage_records WHERE pricing_basis = 'actual' AND id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)) AS actual_usage_records,
  (SELECT COUNT(*) FROM usage_records WHERE pricing_basis = 'displayed_credit' AND id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)) AS displayed_credit_usage_records,
  (SELECT COUNT(*) FROM usage_records WHERE pricing_basis = 'upper_bound' AND id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)) AS upper_bound_usage_records,
  CASE
    WHEN (SELECT COUNT(DISTINCT usage_record_id) FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL) = 0 THEN 'hook-only'
    ELSE 'token-bearing'
  END AS token_status,
  CASE
    WHEN (SELECT COUNT(DISTINCT usage_record_id) FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL) = 0 THEN 'evidence-only'
    ELSE 'usage'
  END AS usage_status,
  (SELECT MIN(COALESCE(ur.timestamp, le.timestamp, le.imported_at)) FROM label_evidence le LEFT JOIN usage_records ur ON ur.id = le.usage_record_id WHERE le.label = labels.label) AS first_seen,
  (SELECT MAX(COALESCE(ur.timestamp, le.timestamp, le.imported_at)) FROM label_evidence le LEFT JOIN usage_records ur ON ur.id = le.usage_record_id WHERE le.label = labels.label) AS last_seen,
  (SELECT MAX(estimate_label) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)) AS estimate_label
  ,(SELECT MAX(pricing_basis) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)) AS pricing_basis
  ,(SELECT MAX(estimate_confidence) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)) AS estimate_confidence
  ,(SELECT MAX(selected_pricing_basis) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)) AS selected_pricing_basis
  ,(SELECT MAX(selected_confidence) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)) AS selected_confidence
  ,(SELECT MAX(selected_source) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)) AS selected_source
FROM (SELECT DISTINCT label FROM label_evidence) labels
ORDER BY selected_ai_credits DESC, labels.label`);
}

async function labelSummary(dbPath, label) {
  await initStore(dbPath);
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
  COALESCE((SELECT SUM(COALESCE(estimated_usd, 0)) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS estimated_usd,
  COALESCE((SELECT SUM(COALESCE(actual_ai_credits, 0)) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS actual_ai_credits,
  COALESCE((SELECT SUM(COALESCE(actual_usd, 0)) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS actual_usd,
  COALESCE((SELECT SUM(COALESCE(displayed_ai_credits, 0)) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS displayed_ai_credits,
  COALESCE((SELECT SUM(COALESCE(displayed_usd, 0)) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS displayed_usd,
  COALESCE((SELECT SUM(COALESCE(inferred_cache_read_tokens, 0)) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS inferred_cache_read_tokens,
  COALESCE((SELECT SUM(COALESCE(upper_bound_ai_credits, 0)) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS upper_bound_ai_credits,
  COALESCE((SELECT SUM(COALESCE(upper_bound_usd, 0)) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS upper_bound_usd,
  COALESCE((SELECT SUM(COALESCE(selected_ai_credits, 0)) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS selected_ai_credits,
  COALESCE((SELECT SUM(COALESCE(selected_usd, 0)) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)), 0) AS selected_usd,
  (SELECT COUNT(*) FROM usage_records WHERE pricing_basis = 'actual' AND id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)) AS actual_usage_records,
  (SELECT COUNT(*) FROM usage_records WHERE pricing_basis = 'displayed_credit' AND id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)) AS displayed_credit_usage_records,
  (SELECT COUNT(*) FROM usage_records WHERE pricing_basis = 'upper_bound' AND id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)) AS upper_bound_usage_records,
  CASE
    WHEN (SELECT COUNT(DISTINCT usage_record_id) FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL) = 0 THEN 'hook-only'
    ELSE 'token-bearing'
  END AS token_status,
  CASE
    WHEN (SELECT COUNT(DISTINCT usage_record_id) FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL) = 0 THEN 'evidence-only'
    ELSE 'usage'
  END AS usage_status,
  (SELECT MIN(COALESCE(ur.timestamp, le.timestamp, le.imported_at)) FROM label_evidence le LEFT JOIN usage_records ur ON ur.id = le.usage_record_id WHERE le.label = labels.label) AS first_seen,
  (SELECT MAX(COALESCE(ur.timestamp, le.timestamp, le.imported_at)) FROM label_evidence le LEFT JOIN usage_records ur ON ur.id = le.usage_record_id WHERE le.label = labels.label) AS last_seen,
  (SELECT MAX(estimate_label) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)) AS estimate_label
  ,(SELECT MAX(pricing_basis) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)) AS pricing_basis
  ,(SELECT MAX(estimate_confidence) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)) AS estimate_confidence
  ,(SELECT MAX(selected_pricing_basis) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)) AS selected_pricing_basis
  ,(SELECT MAX(selected_confidence) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)) AS selected_confidence
  ,(SELECT MAX(selected_source) FROM usage_records WHERE id IN (SELECT DISTINCT usage_record_id FROM label_evidence WHERE label = labels.label AND usage_record_id IS NOT NULL)) AS selected_source
FROM (SELECT DISTINCT label FROM label_evidence WHERE label = ?) labels`, [canonicalLabel(label)]);
  return rows[0] || null;
}

async function labelModelBreakdown(dbPath, label) {
  await initStore(dbPath);
  return queryRows(dbPath, `
SELECT
  COALESCE(ur.resolved_model, ur.requested_model, 'unknown') AS model,
  COUNT(DISTINCT ur.id) AS usage_records,
  COUNT(DISTINCT ur.session_id) AS sessions,
  SUM(ur.input_tokens) AS input_tokens,
  SUM(ur.output_tokens) AS output_tokens,
  SUM(ur.cache_read_tokens) AS cache_read_tokens,
  SUM(ur.cache_creation_tokens) AS cache_creation_tokens,
  SUM(ur.reasoning_tokens) AS reasoning_tokens,
  SUM(COALESCE(ur.estimated_ai_credits, 0)) AS estimated_ai_credits,
  SUM(COALESCE(ur.estimated_usd, 0)) AS estimated_usd,
  SUM(COALESCE(ur.actual_ai_credits, 0)) AS actual_ai_credits,
  SUM(COALESCE(ur.actual_usd, 0)) AS actual_usd,
  SUM(COALESCE(ur.displayed_ai_credits, 0)) AS displayed_ai_credits,
  SUM(COALESCE(ur.displayed_usd, 0)) AS displayed_usd,
  SUM(COALESCE(ur.inferred_cache_read_tokens, 0)) AS inferred_cache_read_tokens,
  SUM(COALESCE(ur.upper_bound_ai_credits, 0)) AS upper_bound_ai_credits,
  SUM(COALESCE(ur.upper_bound_usd, 0)) AS upper_bound_usd,
  SUM(COALESCE(ur.selected_ai_credits, 0)) AS selected_ai_credits,
  SUM(COALESCE(ur.selected_usd, 0)) AS selected_usd,
  SUM(CASE WHEN ur.pricing_basis = 'actual' THEN 1 ELSE 0 END) AS actual_usage_records,
  SUM(CASE WHEN ur.pricing_basis = 'displayed_credit' THEN 1 ELSE 0 END) AS displayed_credit_usage_records,
  SUM(CASE WHEN ur.pricing_basis = 'upper_bound' THEN 1 ELSE 0 END) AS upper_bound_usage_records,
  MAX(ur.pricing_basis) AS pricing_basis,
  MAX(ur.estimate_confidence) AS estimate_confidence,
  MAX(ur.selected_pricing_basis) AS selected_pricing_basis,
  MAX(ur.selected_confidence) AS selected_confidence,
  MAX(ur.selected_source) AS selected_source,
  MAX(ur.estimate_label) AS estimate_label
FROM usage_records ur
WHERE ur.id IN (
  SELECT DISTINCT usage_record_id
  FROM label_evidence
  WHERE label = ? AND usage_record_id IS NOT NULL
)
GROUP BY COALESCE(ur.resolved_model, ur.requested_model, 'unknown')
ORDER BY selected_ai_credits DESC, model`, [canonicalLabel(label)]);
}

async function labelDetails(dbPath, label) {
  await initStore(dbPath);
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
  ur.cache_read_tokens,
  ur.cache_creation_tokens,
  ur.reasoning_tokens,
  ur.estimated_ai_credits,
  ur.estimated_usd,
  ur.actual_charge_nano_aiu,
  ur.actual_ai_credits,
  ur.actual_usd,
  ur.actual_basis,
  ur.displayed_ai_credits,
  ur.displayed_usd,
  ur.displayed_credit_text,
  ur.displayed_credit_basis,
  ur.inferred_cache_read_tokens,
  ur.inferred_cache_read_reason,
  ur.upper_bound_ai_credits,
  ur.upper_bound_usd,
  ur.selected_ai_credits,
  ur.selected_usd,
  ur.selected_pricing_basis,
  ur.selected_confidence,
  ur.selected_source,
  ur.pricing_basis,
  ur.estimate_confidence,
  ur.cache_read_status,
  ur.pricing_source,
  ur.pricing_metadata_json,
  ur.pricing_diagnostics_json,
  ur.estimate_label,
  COALESCE(ur.timestamp, le.timestamp, le.imported_at) AS timestamp
FROM label_evidence le
LEFT JOIN usage_records ur ON ur.id = le.usage_record_id
WHERE le.label = ?
ORDER BY timestamp, le.source_type, le.source_field`, [canonicalLabel(label)]);
}

async function modelReport(dbPath) {
  await initStore(dbPath);
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
  SUM(COALESCE(estimated_usd, 0)) AS estimated_usd,
  SUM(COALESCE(actual_ai_credits, 0)) AS actual_ai_credits,
  SUM(COALESCE(actual_usd, 0)) AS actual_usd,
  SUM(COALESCE(displayed_ai_credits, 0)) AS displayed_ai_credits,
  SUM(COALESCE(displayed_usd, 0)) AS displayed_usd,
  SUM(COALESCE(inferred_cache_read_tokens, 0)) AS inferred_cache_read_tokens,
  SUM(COALESCE(upper_bound_ai_credits, 0)) AS upper_bound_ai_credits,
  SUM(COALESCE(upper_bound_usd, 0)) AS upper_bound_usd,
  SUM(COALESCE(selected_ai_credits, 0)) AS selected_ai_credits,
  SUM(COALESCE(selected_usd, 0)) AS selected_usd,
  SUM(CASE WHEN pricing_basis = 'actual' THEN 1 ELSE 0 END) AS actual_usage_records,
  SUM(CASE WHEN pricing_basis = 'displayed_credit' THEN 1 ELSE 0 END) AS displayed_credit_usage_records,
  SUM(CASE WHEN pricing_basis = 'upper_bound' THEN 1 ELSE 0 END) AS upper_bound_usage_records,
  MAX(pricing_basis) AS pricing_basis,
  MAX(estimate_confidence) AS estimate_confidence,
  MAX(selected_pricing_basis) AS selected_pricing_basis,
  MAX(selected_confidence) AS selected_confidence,
  MAX(selected_source) AS selected_source,
  MAX(estimate_label) AS estimate_label
FROM usage_records
GROUP BY COALESCE(resolved_model, requested_model, 'unknown')
ORDER BY selected_ai_credits DESC, model`);
}

async function repoReport(dbPath) {
  await initStore(dbPath);
  return queryRows(dbPath, `
SELECT
  COALESCE(repo, 'unknown') AS repo,
  COALESCE(cwd, '') AS cwd,
  COUNT(*) AS usage_records,
  COUNT(DISTINCT session_id) AS sessions,
  SUM(input_tokens) AS input_tokens,
  SUM(output_tokens) AS output_tokens,
  SUM(COALESCE(estimated_ai_credits, 0)) AS estimated_ai_credits,
  SUM(COALESCE(estimated_usd, 0)) AS estimated_usd,
  SUM(COALESCE(actual_ai_credits, 0)) AS actual_ai_credits,
  SUM(COALESCE(actual_usd, 0)) AS actual_usd,
  SUM(COALESCE(displayed_ai_credits, 0)) AS displayed_ai_credits,
  SUM(COALESCE(displayed_usd, 0)) AS displayed_usd,
  SUM(COALESCE(inferred_cache_read_tokens, 0)) AS inferred_cache_read_tokens,
  SUM(COALESCE(upper_bound_ai_credits, 0)) AS upper_bound_ai_credits,
  SUM(COALESCE(upper_bound_usd, 0)) AS upper_bound_usd,
  SUM(COALESCE(selected_ai_credits, 0)) AS selected_ai_credits,
  SUM(COALESCE(selected_usd, 0)) AS selected_usd,
  SUM(CASE WHEN pricing_basis = 'actual' THEN 1 ELSE 0 END) AS actual_usage_records,
  SUM(CASE WHEN pricing_basis = 'displayed_credit' THEN 1 ELSE 0 END) AS displayed_credit_usage_records,
  SUM(CASE WHEN pricing_basis = 'upper_bound' THEN 1 ELSE 0 END) AS upper_bound_usage_records,
  MAX(pricing_basis) AS pricing_basis,
  MAX(estimate_confidence) AS estimate_confidence,
  MAX(selected_pricing_basis) AS selected_pricing_basis,
  MAX(selected_confidence) AS selected_confidence,
  MAX(selected_source) AS selected_source,
  MAX(estimate_label) AS estimate_label
FROM usage_records
GROUP BY COALESCE(repo, 'unknown'), COALESCE(cwd, '')
ORDER BY selected_ai_credits DESC, repo, cwd`);
}

async function unattributedReport(dbPath) {
  await initStore(dbPath);
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
  ur.estimated_usd,
  ur.actual_ai_credits,
  ur.actual_usd,
  ur.displayed_ai_credits,
  ur.displayed_usd,
  ur.displayed_credit_text,
  ur.displayed_credit_basis,
  ur.inferred_cache_read_tokens,
  ur.inferred_cache_read_reason,
  ur.upper_bound_ai_credits,
  ur.upper_bound_usd,
  ur.selected_ai_credits,
  ur.selected_usd,
  ur.selected_pricing_basis,
  ur.selected_confidence,
  ur.selected_source,
  ur.pricing_basis,
  ur.estimate_confidence,
  ur.cache_read_status,
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
      ['Label', 'Sess', 'Use', 'Input', 'Output', 'C read', 'C write', 'Think', 'Cr sel.', '$ sel.', 'Basis', 'Status', 'Ev', 'Last'],
      rows.map((row) => [
        row.label,
        row.sessions,
        row.usage_records,
        formatTokens(row.input_tokens),
        formatTokens(row.output_tokens),
        formatTokens(row.cache_read_tokens),
        formatTokens(row.cache_creation_tokens),
        formatTokens(row.reasoning_tokens),
        formatCredits(selectedCredits(row)),
        formatDollars(selectedUsd(row), selectedCredits(row)),
        pricingBasis(row),
        usageStatus(row),
        row.evidence_count,
        formatDate(row.last_seen),
      ]),
    ),
    '',
    `AI Credits are estimates (${estimateLabel(rows)}). Pricing basis: actual = trusted local charge evidence, display* = VS Code displayed credits, upper = upper-bound estimate, est = token-price estimate. * marks inferred/display evidence. 1 AI Credit is treated as $0.01 locally.`,
  ].join('\n');
}

function formatLabelSummary(summary) {
  if (!summary) return 'No usage found for label.';
  return table(
      ['Label', 'Sess', 'Use', 'Input', 'Output', 'C read', 'C write', 'Think', 'Cr sel.', '$ sel.', 'Basis', 'Status', 'Ev'],
    [[
      summary.label,
      summary.sessions,
      summary.usage_records,
      formatTokens(summary.input_tokens),
      formatTokens(summary.output_tokens),
      formatTokens(summary.cache_read_tokens),
      formatTokens(summary.cache_creation_tokens),
      formatTokens(summary.reasoning_tokens),
      formatCredits(selectedCredits(summary)),
      formatDollars(selectedUsd(summary), selectedCredits(summary)),
      pricingBasis(summary),
      usageStatus(summary),
      summary.evidence_count,
    ]],
  );
}

function formatLabelReport(summary, models, details = null) {
  const output = [formatLabelSummary(summary)];
  if (models && models.length > 0) {
    output.push('', table(
      ['Model', 'Sess', 'Use', 'Input', 'Output', 'C read', 'C write', 'Think', 'Cr sel.', '$ sel.', 'Basis'],
      models.map((row) => [
        row.model,
        row.sessions,
        row.usage_records,
        formatTokens(row.input_tokens),
        formatTokens(row.output_tokens),
        formatTokens(row.cache_read_tokens),
        formatTokens(row.cache_creation_tokens),
        formatTokens(row.reasoning_tokens),
        formatCredits(selectedCredits(row)),
        formatDollars(selectedUsd(row), selectedCredits(row)),
        pricingBasis(row),
      ]),
    ));
  }
  if (details) {
    output.push('', table(
      ['Src', 'Field', 'Session', 'Model', 'Input', 'Output', 'C read', 'C write', 'Think', 'Cr sel.', '$ sel.', 'Basis', 'Value'],
      details.map((row) => [
        row.source_type,
        row.source_field,
        row.session_id || '',
        row.resolved_model || '',
        formatTokens(row.input_tokens),
        formatTokens(row.output_tokens),
        formatTokens(row.cache_read_tokens),
        formatTokens(row.cache_creation_tokens),
        formatTokens(row.reasoning_tokens),
        formatCredits(selectedCredits(row)),
        formatDollars(selectedUsd(row), selectedCredits(row)),
        row.selected_pricing_basis || row.pricing_basis || '',
        row.source_value || '',
      ]),
    ));
  }
  output.push('', `AI Credits are estimates (${summary?.estimate_label || estimateLabel(models || [])}). Pricing basis: actual = trusted local charge evidence, display* = VS Code displayed credits, upper = upper-bound estimate, est = token-price estimate.`);
  return output.join('\n');
}

function formatModels(rows) {
  return [
    table(
      ['Model', 'Records', 'Input', 'Output', 'Cr sel.', '$ sel.', 'Basis'],
      rows.map((row) => [
        row.model,
        row.usage_records,
        formatTokens(row.input_tokens),
        formatTokens(row.output_tokens),
        formatCredits(selectedCredits(row)),
        formatDollars(selectedUsd(row), selectedCredits(row)),
        pricingBasis(row),
      ]),
    ),
    '',
    `AI Credits are estimates (${estimateLabel(rows)}). Pricing basis: actual = trusted local charge evidence, display* = VS Code displayed credits, upper = upper-bound estimate, est = token-price estimate.`,
  ].join('\n');
}

function formatRepos(rows) {
  return [
    table(
      ['Repo', 'CWD', 'Sess', 'Input', 'Output', 'Cr sel.', '$ sel.', 'Basis'],
      rows.map((row) => [
        row.repo,
        row.cwd,
        row.sessions,
        formatTokens(row.input_tokens),
        formatTokens(row.output_tokens),
        formatCredits(selectedCredits(row)),
        formatDollars(selectedUsd(row), selectedCredits(row)),
        pricingBasis(row),
      ]),
    ),
    '',
    `AI Credits are estimates (${estimateLabel(rows)}). Pricing basis: actual = trusted local charge evidence, display* = VS Code displayed credits, upper = upper-bound estimate, est = token-price estimate.`,
  ].join('\n');
}

function formatUnattributed(rows) {
  return [
    table(
      ['ID', 'Src', 'Session', 'Repo', 'Branch', 'CWD', 'Model', 'Cr sel.', '$ sel.', 'Basis'],
      rows.map((row) => [
        row.id,
        row.source,
        row.session_id || '',
        row.repo || '',
        row.branch || '',
        row.cwd || '',
        row.resolved_model || '',
        formatCredits(selectedCredits(row)),
        formatDollars(selectedUsd(row), selectedCredits(row)),
        row.selected_pricing_basis || row.pricing_basis || '',
      ]),
    ),
    '',
    `AI Credits are estimates (${estimateLabel(rows)}). Pricing basis: actual = trusted local charge evidence, display* = VS Code displayed credits, upper = upper-bound estimate, est = token-price estimate.`,
  ].join('\n');
}

module.exports = {
  labelOverview,
  labelSummary,
  labelModelBreakdown,
  labelDetails,
  modelReport,
  repoReport,
  unattributedReport,
  formatLabels,
  formatLabelSummary,
  formatLabelReport,
  formatModels,
  formatRepos,
  formatUnattributed,
};
