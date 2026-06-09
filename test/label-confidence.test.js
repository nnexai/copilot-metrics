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

test('manual labels rank before automatic labels and keep scoring version', () => {
  const [session] = rankSessionEvidence([
    row({ id: 1, label: 'DEMO-300', source_field: 'branch', source_value: 'feature/DEMO-300' }),
  ], [
    { session_id: 's1', label: 'DEMO-200', created_at: '2026-06-04T08:00:00.000Z', updated_at: '2026-06-04T08:00:00.000Z' },
    { session_id: 's1', label: 'DEMO-100', created_at: '2026-06-04T08:00:00.000Z', updated_at: '2026-06-04T08:00:00.000Z' },
  ]);

  assert.equal(SCORING_VERSION, 'label-confidence:v1');
  assert.deepEqual(session.rankings.map((ranking) => ranking.label), ['DEMO-100', 'DEMO-200', 'DEMO-300']);
  assert.deepEqual(session.rankings.map((ranking) => ranking.rank), [1, 2, 3]);
  assert.ok(session.rankings[0].score > session.rankings[2].score);
  assert.equal(Object.hasOwn(session.rankings[2], 'automatic_rank'), false);
});

test('matching manual and automatic labels merge evidence into one ranking entry', () => {
  const [session] = rankSessionEvidence([
    row({ id: 1, label: 'DEMO-100', source_field: 'branch', source_value: 'feature/DEMO-100' }),
    row({ id: 2, label: 'DEMO-200', source_field: 'prompt', source_value: 'DEMO-200' }),
  ], [
    { session_id: 's1', label: 'DEMO-100', created_at: '2026-06-04T08:00:00.000Z', updated_at: '2026-06-04T09:00:00.000Z' },
  ]);
  const manual = session.rankings.find((ranking) => ranking.label === 'DEMO-100');

  assert.equal(session.rankings.filter((ranking) => ranking.label === 'DEMO-100').length, 1);
  assert.equal(manual.manual, true);
  assert.ok(manual.source_summary.some((item) => item.source === 'manual'));
  assert.ok(manual.source_summary.some((item) => item.source === 'branch'));
  assert.ok(manual.evidence.some((item) => item.source_field === 'manual' && item.created_at));
  assert.ok(manual.evidence.some((item) => item.source_field === 'branch'));
});
