'use strict';

const { activeManualLabelAssignments, initStore, queryRows } = require('./sqlite-store');
const { canonicalLabel } = require('./label-extractors');
const {
  SCORING_VERSION,
  evidenceSessionKey,
  rankSessionEvidence,
  labelConfidenceSummaries,
} = require('./label-confidence');

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

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function formatLocalDateTime(date) {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-') + ` ${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;
}

function formatDateTime(value) {
  if (value === null || value === undefined) return '';
  const trimmed = String(value).trim();
  if (trimmed === '') return '';
  const dateOnlyMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (dateOnlyMatch) return `${dateOnlyMatch[1]} 00:00`;
  const isoLikeMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/);
  if (isoLikeMatch) {
    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) return formatLocalDateTime(date);
  }
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      const millis = numeric >= 10_000_000_000 ? numeric : numeric * 1000;
      const date = new Date(millis);
      if (!Number.isNaN(date.getTime())) return formatLocalDateTime(date);
    }
  }
  return trimmed;
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

function usageBasisRank(row) {
  const basis = row?.pricing_basis || row?.selected_pricing_basis;
  return {
    unknown_price: 0,
    included_or_zero: 1,
    upper_bound: 2,
    estimated: 3,
    displayed_credit: 4,
    actual: 5,
    conflict: 6,
  }[basis] ?? 0;
}

function usageSemanticKey(row) {
  if (!row || !row.usage_record_id) return null;
  const model = String(row.resolved_model || row.requested_model || '').replace(/-\d{4}-\d{2}-\d{2}$/, '');
  const span = row.span_id || (String(row.usage_identity || '').startsWith('span:')
    ? String(row.usage_identity).slice(5).split('|')[0]
    : '');
  if (span) return `span:${span}|model:${model}`;

  const session = row.session_id || row.trace_id || '';
  const timestamp = row.timestamp || row.seen_at || '';
  const tokens = [
    n(row.input_tokens),
    n(row.output_tokens),
    n(row.cache_read_tokens),
    n(row.cache_creation_tokens),
    n(row.reasoning_tokens),
  ].join(':');
  if (session || timestamp || model || tokens !== '0:0:0:0:0') {
    return `session:${session}|time:${timestamp}|model:${model}|tokens:${tokens}`;
  }
  return `usage:${row.usage_record_id}`;
}

function usageReportKey(row) {
  return usageSemanticKey(row) || (row?.usage_record_id ? `usage:${row.usage_record_id}` : null);
}

function strongerUsageRow(left, right) {
  if (!left) return right;
  if (usageBasisRank(left) !== usageBasisRank(right)) return usageBasisRank(left) > usageBasisRank(right) ? left : right;
  return Number(left.usage_record_id || left.id || 0) <= Number(right.usage_record_id || right.id || 0) ? left : right;
}

function dedupeUsageRows(rows) {
  const keyed = new Map();
  const unkeyed = [];
  for (const row of rows) {
    const key = usageReportKey(row);
    if (!key) {
      unkeyed.push(row);
      continue;
    }
    keyed.set(key, strongerUsageRow(keyed.get(key), row));
  }
  return [...unkeyed, ...keyed.values()];
}

function inclusionTopLabel() {
  return { mode: 'top-label', top_k: 1, overlap: false };
}

function inclusionForOptions(options = {}) {
  if (options.allMatches === true || options.topK === 'all') return { mode: 'all-matches', top_k: 'all', overlap: true };
  const topK = Number(options.topK || 1);
  if (Number.isFinite(topK) && topK > 1) return { mode: 'top-k', top_k: Math.trunc(topK), overlap: true };
  return inclusionTopLabel();
}

function emptyAggregate(label, confidence = null, inclusion = inclusionTopLabel()) {
  return {
    label,
    sessions: 0,
    evidence_count: 0,
    usage_records: 0,
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
    reasoning_tokens: 0,
    estimated_ai_credits: 0,
    estimated_usd: 0,
    actual_ai_credits: 0,
    actual_usd: 0,
    displayed_ai_credits: 0,
    displayed_usd: 0,
    inferred_cache_read_tokens: 0,
    upper_bound_ai_credits: 0,
    upper_bound_usd: 0,
    selected_ai_credits: 0,
    selected_usd: 0,
    actual_usage_records: 0,
    displayed_credit_usage_records: 0,
    upper_bound_usage_records: 0,
    token_status: 'hook-only',
    usage_status: 'evidence-only',
    first_seen: null,
    last_seen: null,
    estimate_label: null,
    pricing_basis: null,
    estimate_confidence: null,
    selected_pricing_basis: null,
    selected_confidence: null,
    selected_source: null,
    inclusion_mode: inclusion.mode,
    overlap: inclusion.overlap,
    confidence: confidence || {
      label,
      scoring_version: SCORING_VERSION,
      top_ranked_sessions: 0,
      ranked_sessions: 0,
      best_rank: null,
      best_score: 0,
      evidence_count: 0,
      distinct_evidence_count: 0,
      source_summary: [],
    },
  };
}

function addUsageToAggregate(aggregate, usage, seenUsage) {
  const usageKey = usageReportKey(usage);
  if (!usage || !usage.usage_record_id || seenUsage.has(usageKey)) return;
  seenUsage.add(usageKey);
  aggregate.usage_records += 1;
  for (const field of [
    'input_tokens',
    'output_tokens',
    'cache_read_tokens',
    'cache_creation_tokens',
    'reasoning_tokens',
    'estimated_ai_credits',
    'estimated_usd',
    'actual_ai_credits',
    'actual_usd',
    'displayed_ai_credits',
    'displayed_usd',
    'inferred_cache_read_tokens',
    'upper_bound_ai_credits',
    'upper_bound_usd',
    'selected_ai_credits',
    'selected_usd',
  ]) {
    aggregate[field] += n(usage[field]);
  }
  if (usage.pricing_basis === 'actual') aggregate.actual_usage_records += 1;
  if (usage.pricing_basis === 'displayed_credit') aggregate.displayed_credit_usage_records += 1;
  if (usage.pricing_basis === 'upper_bound') aggregate.upper_bound_usage_records += 1;
  aggregate.estimate_label = aggregate.estimate_label || usage.estimate_label || null;
  aggregate.pricing_basis = aggregate.pricing_basis || usage.pricing_basis || null;
  aggregate.estimate_confidence = aggregate.estimate_confidence || usage.estimate_confidence || null;
  aggregate.selected_pricing_basis = aggregate.selected_pricing_basis || usage.selected_pricing_basis || null;
  aggregate.selected_confidence = aggregate.selected_confidence || usage.selected_confidence || null;
  aggregate.selected_source = aggregate.selected_source || usage.selected_source || null;
}

function addSeenDate(aggregate, value) {
  if (!value) return;
  aggregate.first_seen = aggregate.first_seen && aggregate.first_seen < value ? aggregate.first_seen : value;
  aggregate.last_seen = aggregate.last_seen && aggregate.last_seen > value ? aggregate.last_seen : value;
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

async function labelOverview(dbPath, options = {}) {
  await initStore(dbPath);
  const context = options.context || await createLabelReportContext(dbPath);
  const rows = await aggregateLabelRows(dbPath, { overview: true, context });
  return rows.sort((left, right) => n(right.selected_ai_credits) - n(left.selected_ai_credits) || left.label.localeCompare(right.label));
}

async function labelSummary(dbPath, label, options = {}) {
  await initStore(dbPath);
  const rows = await aggregateLabelRows(dbPath, { label: canonicalLabel(label), inclusion: inclusionForOptions(options), context: options.context });
  return rows[0] || null;
}

async function labelModelBreakdown(dbPath, label, options = {}) {
  await initStore(dbPath);
  const rows = await includedEvidenceRows(dbPath, canonicalLabel(label), inclusionForOptions(options), options.context);
  const byModel = new Map();
  const seenUsage = new Map();
  const seenSessions = new Map();
  for (const row of rows) {
    if (!row.usage_record_id) continue;
    const model = row.resolved_model || row.requested_model || 'unknown';
    if (!byModel.has(model)) {
      byModel.set(model, { ...emptyAggregate(model), model, sessions: 0 });
      seenUsage.set(model, new Set());
      seenSessions.set(model, new Set());
    }
    const aggregate = byModel.get(model);
    const sessionKey = evidenceSessionKey(row);
    if (!seenSessions.get(model).has(sessionKey)) {
      seenSessions.get(model).add(sessionKey);
      aggregate.sessions += 1;
    }
    addUsageToAggregate(aggregate, row, seenUsage.get(model));
  }
  return Array.from(byModel.values()).sort((left, right) => n(right.selected_ai_credits) - n(left.selected_ai_credits) || left.model.localeCompare(right.model));
}

async function labelDetails(dbPath, label, options = {}) {
  await initStore(dbPath);
  const rows = await queryRows(dbPath, `
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
  ur.span_id,
  ur.trace_id,
  ur.surface,
  ur.resolved_model,
  ur.requested_model,
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
  ur.usage_identity,
  COALESCE(ur.timestamp, le.timestamp, le.imported_at) AS timestamp
FROM label_evidence le
LEFT JOIN usage_records ur ON ur.id = le.usage_record_id
WHERE le.label = ?
ORDER BY timestamp, le.source_type, le.source_field`, [canonicalLabel(label)]);
  const manualRows = (options.context?.manualRows || await manualLabelUsageRows(dbPath)).filter((row) => canonicalLabel(row.label) === canonicalLabel(label));
  return filterRowsByInclusion(dbPath, [...rows, ...manualRows], canonicalLabel(label), inclusionForOptions(options), options.context);
}

async function labelEvidenceUsageRows(dbPath) {
  return queryRows(dbPath, `
SELECT
  le.id,
  le.imported_at,
  le.label,
  le.source_type,
  le.source_field,
  le.source_value,
  le.confidence,
  le.usage_record_id,
  le.hook_event_id,
  le.session_id,
  le.repo,
  le.branch,
  le.cwd,
  le.timestamp,
  ur.span_id,
  ur.trace_id,
  ur.surface,
  ur.resolved_model,
  ur.requested_model,
  ur.input_tokens,
  ur.output_tokens,
  ur.cache_read_tokens,
  ur.cache_creation_tokens,
  ur.reasoning_tokens,
  ur.estimated_ai_credits,
  ur.estimated_usd,
  ur.actual_ai_credits,
  ur.actual_usd,
  ur.displayed_ai_credits,
  ur.displayed_usd,
  ur.inferred_cache_read_tokens,
  ur.upper_bound_ai_credits,
  ur.upper_bound_usd,
  ur.selected_ai_credits,
  ur.selected_usd,
  ur.pricing_basis,
  ur.estimate_confidence,
  ur.selected_pricing_basis,
  ur.selected_confidence,
  ur.selected_source,
  ur.estimate_label,
  ur.usage_identity,
  COALESCE(ur.timestamp, le.timestamp, le.imported_at) AS seen_at
FROM label_evidence le
LEFT JOIN usage_records ur ON ur.id = le.usage_record_id
ORDER BY le.session_id, le.usage_record_id, le.hook_event_id, le.label, le.source_type, le.source_field`);
}

async function rawManualLabelUsageRows(dbPath) {
  return queryRows(dbPath, `
SELECT
  NULL AS id,
  mla.created_at AS imported_at,
  mla.label,
  'manual' AS source_type,
  'manual' AS source_field,
  mla.label AS source_value,
  1 AS confidence,
  ur.id AS usage_record_id,
  ur.span_id,
  ur.trace_id,
  NULL AS hook_event_id,
  mla.session_id,
  ur.repo,
  ur.branch,
  ur.cwd,
  COALESCE(ur.timestamp, mla.updated_at, mla.created_at) AS timestamp,
  mla.created_at,
  mla.updated_at,
  ur.surface,
  ur.resolved_model,
  ur.requested_model,
  ur.input_tokens,
  ur.output_tokens,
  ur.cache_read_tokens,
  ur.cache_creation_tokens,
  ur.reasoning_tokens,
  ur.estimated_ai_credits,
  ur.estimated_usd,
  ur.actual_ai_credits,
  ur.actual_usd,
  ur.displayed_ai_credits,
  ur.displayed_usd,
  ur.inferred_cache_read_tokens,
  ur.upper_bound_ai_credits,
  ur.upper_bound_usd,
  ur.selected_ai_credits,
  ur.selected_usd,
  ur.pricing_basis,
  ur.estimate_confidence,
  ur.selected_pricing_basis,
  ur.selected_confidence,
  ur.selected_source,
  ur.estimate_label,
  ur.usage_identity,
  COALESCE(ur.timestamp, mla.updated_at, mla.created_at) AS seen_at
FROM manual_label_assignments mla
LEFT JOIN usage_records ur ON ur.session_id = mla.session_id
ORDER BY mla.session_id, mla.label, ur.id`);
}

async function manualLabelUsageRows(dbPath) {
  return dedupeUsageRows(await rawManualLabelUsageRows(dbPath));
}

function rankingBySession(sessionRankings) {
  return new Map(sessionRankings.map((session) => [session.session_key, session]));
}

function rankingForLabel(session, label) {
  return session?.rankings.find((ranking) => ranking.label === label) || null;
}

function includeRanking(ranking, inclusion) {
  if (!ranking) return false;
  if (inclusion.mode === 'all-matches') return true;
  if (inclusion.mode === 'top-k') return ranking.rank <= inclusion.top_k;
  return ranking.rank === 1;
}

async function aggregateLabelRows(dbPath, options = {}) {
  const inclusion = options.inclusion || inclusionTopLabel();
  const labelFilter = options.label ? canonicalLabel(options.label) : null;
  const context = options.context || await createLabelReportContext(dbPath);
  const { reportRows, sessions, confidenceSummaries } = context;
  const aggregates = new Map();
  const seenSessions = new Map();
  const seenUsage = new Map();

  for (const row of reportRows) {
    const sessionKey = evidenceSessionKey(row);
    const session = sessions.get(sessionKey);
    const label = labelFilter || session?.top_label || canonicalLabel(row.label);
    const ranking = rankingForLabel(session, label);
    if (labelFilter && !includeRanking(ranking, inclusion)) continue;
    if (!labelFilter && canonicalLabel(row.label) !== label) continue;

    if (!aggregates.has(label)) {
      aggregates.set(label, emptyAggregate(label, confidenceSummaries.get(label), inclusion));
      seenSessions.set(label, new Set());
      seenUsage.set(label, new Set());
    }
    const aggregate = aggregates.get(label);
    const sessionSeen = seenSessions.get(label);
    if (!sessionSeen.has(sessionKey)) {
      sessionSeen.add(sessionKey);
      aggregate.sessions += 1;
    }
    if (canonicalLabel(row.label) === label) aggregate.evidence_count += 1;
    addUsageToAggregate(aggregate, row, seenUsage.get(label));
    addSeenDate(aggregate, row.seen_at || row.timestamp || row.imported_at);
  }

  for (const aggregate of aggregates.values()) {
    aggregate.token_status = aggregate.usage_records > 0 ? 'token-bearing' : 'hook-only';
    aggregate.usage_status = aggregate.usage_records > 0 ? 'usage' : 'evidence-only';
  }

  if (labelFilter && !aggregates.has(labelFilter) && confidenceSummaries.has(labelFilter)) {
    aggregates.set(labelFilter, emptyAggregate(labelFilter, confidenceSummaries.get(labelFilter), inclusion));
  }

  return Array.from(aggregates.values());
}

async function includedEvidenceRows(dbPath, label, inclusion, context = null) {
  const rows = context?.reportRows || [...await labelEvidenceUsageRows(dbPath), ...await manualLabelUsageRows(dbPath)];
  return filterRowsByInclusion(dbPath, rows, canonicalLabel(label), inclusion, context);
}

async function filterRowsByInclusion(dbPath, rows, label, inclusion, context = null) {
  const sessions = context?.sessions || rankingBySession(await labelConfidenceRankings(dbPath));
  return rows.filter((row) => {
    const session = sessions.get(evidenceSessionKey(row));
    return includeRanking(rankingForLabel(session, label), inclusion);
  });
}

async function labelSessionDetails(dbPath, label, options = {}) {
  await initStore(dbPath);
  const inclusion = inclusionForOptions(options);
  const labelId = canonicalLabel(label);
  const rows = await includedEvidenceRows(dbPath, labelId, inclusion, options.context);
  const sessions = options.context?.sessions || rankingBySession(await labelConfidenceRankings(dbPath));
  const bySession = new Map();

  for (const row of rows) {
    const sessionKey = evidenceSessionKey(row);
    const session = sessions.get(sessionKey);
    const ranking = rankingForLabel(session, labelId);
    if (!bySession.has(sessionKey)) {
      bySession.set(sessionKey, {
        session_key: sessionKey,
        session_id: row.session_id || session?.session_id || null,
        top_label: session?.top_label || null,
        requested_label: labelId,
        requested_label_rank: ranking?.rank || null,
        confidence_score: ranking?.score || 0,
        confidence: ranking || null,
        evidence_count: 0,
        distinct_evidence_count: ranking?.distinct_evidence_count || 0,
        evidence_summary: ranking?.source_summary || [],
        usage_records: 0,
        model_count: 0,
        models: [],
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        reasoning_tokens: 0,
        selected_ai_credits: 0,
        selected_usd: 0,
        selected_pricing_basis: null,
        selected_confidence: null,
        pricing_basis: null,
        first_seen: null,
        last_seen: null,
        inclusion_mode: inclusion.mode,
        overlap: inclusion.overlap,
      });
    }
    const detail = bySession.get(sessionKey);
    if (canonicalLabel(row.label) === labelId) detail.evidence_count += 1;
    addSeenDate(detail, row.seen_at || row.timestamp || row.imported_at);
  }

  const seenUsageBySession = new Map();
  for (const row of rows) {
    const sessionKey = evidenceSessionKey(row);
    const detail = bySession.get(sessionKey);
    if (!detail || !row.usage_record_id) continue;
    if (!seenUsageBySession.has(sessionKey)) seenUsageBySession.set(sessionKey, new Set());
    const seenUsage = seenUsageBySession.get(sessionKey);
    const usageKey = usageReportKey(row);
    if (seenUsage.has(usageKey)) continue;
    seenUsage.add(usageKey);
    detail.usage_records += 1;
    for (const field of ['input_tokens', 'output_tokens', 'cache_read_tokens', 'cache_creation_tokens', 'reasoning_tokens', 'selected_ai_credits', 'selected_usd']) {
      detail[field] += n(row[field]);
    }
    const model = row.resolved_model || row.requested_model || 'unknown';
    if (!detail.models.includes(model)) detail.models.push(model);
    detail.selected_pricing_basis = detail.selected_pricing_basis || row.selected_pricing_basis || null;
    detail.selected_confidence = detail.selected_confidence || row.selected_confidence || null;
    detail.pricing_basis = detail.pricing_basis || row.pricing_basis || null;
  }

  return Array.from(bySession.values())
    .map((detail) => ({
      ...detail,
      model_count: detail.models.length,
      models: detail.models.sort(),
    }))
    .sort((left, right) => String(right.last_seen || '').localeCompare(String(left.last_seen || '')) || left.session_key.localeCompare(right.session_key));
}

async function labelEvidenceRows(dbPath) {
  return queryRows(dbPath, `
SELECT
  id,
  imported_at,
  label,
  source_type,
  source_field,
  source_value,
  confidence,
  usage_record_id,
  hook_event_id,
  session_id,
  repo,
  branch,
  cwd,
  timestamp
FROM label_evidence
ORDER BY session_id, usage_record_id, hook_event_id, label, source_type, source_field, source_value`);
}

async function labelConfidenceRankings(dbPath) {
  await initStore(dbPath);
  return rankSessionEvidence(await labelEvidenceRows(dbPath), await activeManualLabelAssignments(dbPath));
}

async function createLabelReportContext(dbPath) {
  await initStore(dbPath);
  const usageRows = await labelEvidenceUsageRows(dbPath);
  const evidenceRows = usageRows.map((row) => ({
    id: row.id,
    imported_at: row.imported_at,
    label: row.label,
    source_type: row.source_type,
    source_field: row.source_field,
    source_value: row.source_value,
    confidence: row.confidence,
    usage_record_id: row.usage_record_id,
    hook_event_id: row.hook_event_id,
    session_id: row.session_id,
    repo: row.repo,
    branch: row.branch,
    cwd: row.cwd,
    timestamp: row.timestamp,
  }));
  const rawManualRows = await rawManualLabelUsageRows(dbPath);
  const manualAssignments = Array.from(new Map(rawManualRows.map((row) => [
    `${row.session_id}\0${row.label}`,
    {
      session_id: row.session_id,
      label: row.label,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
  ])).values());
  const sessionRankings = rankSessionEvidence(evidenceRows, manualAssignments);
  const manualRows = dedupeUsageRows(rawManualRows);
  return {
    evidenceRows,
    manualAssignments,
    sessionRankings,
    usageRows,
    manualRows,
    reportRows: [...usageRows, ...manualRows],
    sessions: rankingBySession(sessionRankings),
    confidenceSummaries: new Map(labelConfidenceSummaries(sessionRankings).map((summary) => [summary.label, summary])),
  };
}

async function withConfidenceSummaries(dbPath, rows) {
  if (!rows.length) return rows;
  const summaries = new Map(labelConfidenceSummaries(await labelConfidenceRankings(dbPath)).map((summary) => [summary.label, summary]));
  return rows.map((row) => ({
    ...row,
    confidence: summaries.get(row.label) || {
      label: row.label,
      scoring_version: SCORING_VERSION,
      top_ranked_sessions: 0,
      ranked_sessions: 0,
      best_rank: null,
      best_score: 0,
      evidence_count: 0,
      distinct_evidence_count: 0,
      source_summary: [],
    },
  }));
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
AND NOT EXISTS (
  SELECT 1 FROM manual_label_assignments mla WHERE mla.session_id = ur.session_id
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
        formatDateTime(row.last_seen),
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

function formatLabelReport(summary, models, details = null, sessionDetails = null) {
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
  if (sessionDetails && sessionDetails.length > 0) {
    output.push('', table(
      ['Session', 'Top', 'Rank', 'Models', 'Use', 'Input', 'Output', 'Cr sel.', '$ sel.', 'Basis', 'Evidence'],
      sessionDetails.map((row) => [
        row.session_id || row.session_key,
        row.top_label || '',
        row.requested_label_rank || '',
        row.models.join(','),
        row.usage_records,
        formatTokens(row.input_tokens),
        formatTokens(row.output_tokens),
        formatCredits(row.selected_ai_credits),
        formatDollars(row.selected_usd, row.selected_ai_credits),
        row.selected_pricing_basis || row.pricing_basis || '',
        (row.evidence_summary || []).map((item) => `${item.source}:${item.count}`).join(','),
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
  labelConfidenceRankings,
  createLabelReportContext,
  labelSessionDetails,
  inclusionForOptions,
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
