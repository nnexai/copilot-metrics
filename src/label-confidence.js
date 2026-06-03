'use strict';

const { canonicalLabel } = require('./label-extractors');

const SCORING_VERSION = 'label-confidence:v1';

const SOURCE_WEIGHTS = {
  labels: 0.95,
  branch: 0.9,
  cwd: 0.9,
  folder: 0.9,
  path: 0.9,
  vscode_chat_response: 0.75,
  task_hint: 0.7,
  session_id: 0.65,
  conversation_id: 0.65,
  metadata: 0.65,
  context: 0.65,
  repo: 0.55,
  tool: 0.35,
  tool_call: 0.35,
  prompt: 0.25,
  prompt_preview: 0.25,
  message: 0.25,
  input: 0.25,
  response: 0.25,
  custom: 0.5,
};

function evidenceSessionKey(row) {
  if (row.session_id) return `session:${row.session_id}`;
  if (row.usage_record_id) return `usage:${row.usage_record_id}`;
  if (row.hook_event_id) return `hook:${row.hook_event_id}`;
  return `evidence:${row.id}`;
}

function evidenceKey(row) {
  return [
    canonicalLabel(row.label),
    row.source_type || '',
    row.source_field || '',
    row.source_value || '',
    row.usage_record_id || '',
    row.hook_event_id || '',
    row.session_id || '',
  ].join('\0');
}

function sourceWeight(row) {
  const field = String(row.source_field || '').toLowerCase();
  const explicit = Number(row.confidence);
  const defaultWeight = SOURCE_WEIGHTS[field] ?? (Number.isFinite(explicit) && explicit > 0 ? explicit : 0.5);
  return Math.max(0, Math.min(1, defaultWeight));
}

function summarizeEvidence(evidence) {
  const bySource = new Map();
  for (const row of evidence) {
    const key = row.source_field || row.source_type || 'unknown';
    bySource.set(key, (bySource.get(key) || 0) + 1);
  }
  return Array.from(bySource.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 6)
    .map(([source, count]) => ({ source, count }));
}

function scoreEvidence(evidence) {
  const distinct = [];
  const seen = new Set();
  for (const row of evidence) {
    const key = evidenceKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    distinct.push({ ...row, weight: sourceWeight(row) });
  }
  distinct.sort((left, right) => right.weight - left.weight || String(left.source_field).localeCompare(String(right.source_field)));

  let score = 0;
  distinct.forEach((row, index) => {
    const accumulation = index === 0 ? 1 : 0.6 / Math.sqrt(index + 1);
    score += row.weight * accumulation;
  });

  return {
    score: Number(score.toFixed(6)),
    strongest_weight: Number((distinct[0]?.weight || 0).toFixed(6)),
    distinct_evidence_count: distinct.length,
    evidence_count: evidence.length,
    source_summary: summarizeEvidence(distinct),
    evidence: distinct.map((row) => ({
      label: canonicalLabel(row.label),
      source_type: row.source_type,
      source_field: row.source_field,
      source_value: row.source_value,
      confidence: Number(row.confidence || 0),
      weight: row.weight,
      usage_record_id: row.usage_record_id || null,
      hook_event_id: row.hook_event_id || null,
      session_id: row.session_id || null,
    })),
  };
}

function rankSessionEvidence(evidenceRows) {
  const bySession = new Map();
  for (const row of evidenceRows) {
    const sessionKey = evidenceSessionKey(row);
    if (!bySession.has(sessionKey)) bySession.set(sessionKey, []);
    bySession.get(sessionKey).push(row);
  }

  const sessions = [];
  for (const [session_key, rows] of bySession.entries()) {
    const byLabel = new Map();
    for (const row of rows) {
      const label = canonicalLabel(row.label);
      if (!byLabel.has(label)) byLabel.set(label, []);
      byLabel.get(label).push(row);
    }

    const rankings = Array.from(byLabel.entries()).map(([label, evidence]) => ({
      label,
      scoring_version: SCORING_VERSION,
      ...scoreEvidence(evidence),
      first_seen: evidence
        .map((row) => row.timestamp || row.imported_at || '')
        .filter(Boolean)
        .sort()[0] || null,
    }));

    rankings.sort((left, right) => (
      right.score - left.score
      || right.strongest_weight - left.strongest_weight
      || right.distinct_evidence_count - left.distinct_evidence_count
      || String(left.first_seen || '').localeCompare(String(right.first_seen || ''))
      || left.label.localeCompare(right.label)
    ));

    rankings.forEach((ranking, index) => {
      ranking.rank = index + 1;
      ranking.top_label = rankings[0]?.label || null;
    });

    sessions.push({
      session_key,
      session_id: rows.find((row) => row.session_id)?.session_id || null,
      top_label: rankings[0]?.label || null,
      scoring_version: SCORING_VERSION,
      rankings,
    });
  }

  sessions.sort((left, right) => left.session_key.localeCompare(right.session_key));
  return sessions;
}

function labelConfidenceSummaries(sessionRankings) {
  const summaries = new Map();
  for (const session of sessionRankings) {
    for (const ranking of session.rankings) {
      if (!summaries.has(ranking.label)) {
        summaries.set(ranking.label, {
          label: ranking.label,
          scoring_version: SCORING_VERSION,
          top_ranked_sessions: 0,
          ranked_sessions: 0,
          best_rank: null,
          best_score: 0,
          evidence_count: 0,
          distinct_evidence_count: 0,
          source_summary: [],
        });
      }
      const summary = summaries.get(ranking.label);
      summary.ranked_sessions += 1;
      if (ranking.rank === 1) summary.top_ranked_sessions += 1;
      summary.best_rank = summary.best_rank === null ? ranking.rank : Math.min(summary.best_rank, ranking.rank);
      summary.best_score = Math.max(summary.best_score, ranking.score);
      summary.evidence_count += ranking.evidence_count;
      summary.distinct_evidence_count += ranking.distinct_evidence_count;
      for (const item of ranking.source_summary) {
        const existing = summary.source_summary.find((source) => source.source === item.source);
        if (existing) existing.count += item.count;
        else summary.source_summary.push({ ...item });
      }
    }
  }

  return Array.from(summaries.values()).map((summary) => ({
    ...summary,
    best_score: Number(summary.best_score.toFixed(6)),
    source_summary: summary.source_summary
      .sort((left, right) => right.count - left.count || left.source.localeCompare(right.source))
      .slice(0, 6),
  }));
}

module.exports = {
  SCORING_VERSION,
  SOURCE_WEIGHTS,
  evidenceSessionKey,
  evidenceKey,
  rankSessionEvidence,
  labelConfidenceSummaries,
};
