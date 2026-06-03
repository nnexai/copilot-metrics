'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { rankSessionEvidence, labelConfidenceSummaries, SCORING_VERSION } = require('../src/label-confidence');

function row(overrides) {
  return {
    id: overrides.id || Math.floor(Math.random() * 100000),
    imported_at: '2026-06-03T08:00:00.000Z',
    label: 'DEMO-1',
    source_type: 'usage',
    source_field: 'prompt',
    source_value: 'DEMO-1',
    confidence: 0.5,
    usage_record_id: 1,
    hook_event_id: null,
    session_id: 's1',
    timestamp: '2026-06-03T08:00:00.000Z',
    ...overrides,
  };
}

test('branch and folder evidence outrank incidental prompt mentions', () => {
  const [session] = rankSessionEvidence([
    row({ id: 1, label: 'DEMO-1', source_field: 'prompt', source_value: 'DEMO-1 mention 1' }),
    row({ id: 2, label: 'DEMO-1', source_field: 'message', source_value: 'DEMO-1 mention 2' }),
    row({ id: 3, label: 'DEMO-2', source_field: 'branch', source_value: 'feature/DEMO-2' }),
  ]);

  assert.equal(session.top_label, 'DEMO-2');
  assert.equal(session.rankings[0].strongest_weight, 0.9);
});

test('many distinct lower-weight mentions can accumulate', () => {
  const evidence = [row({ id: 1, label: 'DEMO-2', source_field: 'branch', source_value: 'feature/DEMO-2' })];
  for (let index = 0; index < 18; index += 1) {
    evidence.push(row({
      id: index + 2,
      label: 'DEMO-1',
      source_field: 'prompt',
      source_value: `distinct DEMO-1 mention ${index}`,
    }));
  }

  const [session] = rankSessionEvidence(evidence);
  assert.equal(session.top_label, 'DEMO-1');
  assert.ok(session.rankings[0].score > session.rankings[1].score);
});

test('duplicate identical evidence does not inflate score', () => {
  const [session] = rankSessionEvidence([
    row({ id: 1, label: 'DEMO-1', source_field: 'prompt', source_value: 'same DEMO-1' }),
    row({ id: 2, label: 'DEMO-1', source_field: 'prompt', source_value: 'same DEMO-1' }),
  ]);

  assert.equal(session.rankings[0].evidence_count, 2);
  assert.equal(session.rankings[0].distinct_evidence_count, 1);
});

test('equal confidence ties are deterministic by label', () => {
  const [session] = rankSessionEvidence([
    row({ id: 1, label: 'DEMO-2', source_field: 'prompt', source_value: 'DEMO-2' }),
    row({ id: 2, label: 'DEMO-1', source_field: 'prompt', source_value: 'DEMO-1' }),
  ]);

  assert.deepEqual(session.rankings.map((ranking) => ranking.label), ['DEMO-1', 'DEMO-2']);
});

test('label confidence summaries expose scoring basis and evidence summary', () => {
  const rankings = rankSessionEvidence([
    row({ id: 1, label: 'DEMO-1', source_field: 'branch', source_value: 'feature/DEMO-1' }),
    row({ id: 2, label: 'DEMO-2', source_field: 'prompt', source_value: 'DEMO-2' }),
  ]);
  const summaries = labelConfidenceSummaries(rankings);
  const summary = summaries.find((item) => item.label === 'DEMO-1');

  assert.equal(summary.scoring_version, SCORING_VERSION);
  assert.equal(summary.best_rank, 1);
  assert.equal(summary.top_ranked_sessions, 1);
  assert.deepEqual(summary.source_summary, [{ source: 'branch', count: 1 }]);
});
