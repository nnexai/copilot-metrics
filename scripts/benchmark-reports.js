#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const pkg = require('../package.json');
const { ingestFile } = require('../src/ingest');
const { resolvePaths } = require('../src/paths');
const {
  createLabelReportContext, formatLabelReport, formatLabels, labelDetails,
  labelModelBreakdown, labelOverview, labelSessionDetails, labelSummary,
} = require('../src/reports');
const { insertImport, setManualLabels } = require('../src/sqlite-store');

async function measure(fn) {
  const started = performance.now();
  const value = await fn();
  return { elapsed_ms: Number((performance.now() - started).toFixed(3)), value };
}

async function seedStore(dbPath, fixtures) {
  for (const [source, file] of [['vscode', 'vscode-otel.jsonl'], ['copilot-cli', 'copilot-cli-otel.jsonl'], ['hooks', 'hook-events.jsonl']]) {
    await ingestFile({ dbPath, source, file: path.join(fixtures, file) });
  }
  await setManualLabels(dbPath, 'session-cli', ['DEMO-901', 'DEMO-902']);
  const historical = {
    raw_line: 90, span_id: 'benchmark-history', trace_id: 'benchmark-history', timestamp: '2026-07-20T10:00:00.000Z',
    surface: 'benchmark', session_id: 'benchmark-history', requested_model: 'gpt-5-mini', resolved_model: 'gpt-5-mini',
    input_tokens: 100, output_tokens: 10, cache_read_tokens: 20, cache_creation_tokens: 0, reasoning_tokens: 0,
    estimated_usd: 0.01, estimated_ai_credits: 1, selected_ai_credits: 1, selected_usd: 0.01,
    selected_pricing_basis: 'estimated', selected_confidence: 'high', pricing_basis: 'estimated', estimate_confidence: 'high',
    cache_read_status: 'known', estimate_label: 'estimate:benchmark', pricing_metadata: {}, pricing_diagnostics: [], warnings: [], label_evidence: [],
  };
  await insertImport(dbPath, 'benchmark', 'history.jsonl', [], [
    { ...historical, usage_identity: 'span:benchmark-history|model:gpt-5-mini|tokens:100:10:20:0:0' },
    { ...historical, raw_line: 91, usage_identity: 'span:benchmark-history|model:gpt-5-mini' },
  ], [], []);
  await setManualLabels(dbPath, 'benchmark-history', ['DEMO-990']);
}

async function publicMatrix(dbPath, context = null) {
  const matrix = {};
  for (const [name, options] of [['default', {}], ['top_k', { topK: 2 }], ['all_match', { allMatches: true }]]) {
    const applied = context ? { ...options, context } : options;
    matrix[name] = {
      overview: await labelOverview(dbPath, context ? { context } : {}),
      summary: await labelSummary(dbPath, 'DEMO-902', applied),
      models: await labelModelBreakdown(dbPath, 'DEMO-902', applied),
      details: await labelDetails(dbPath, 'DEMO-902', applied),
      session_details: await labelSessionDetails(dbPath, 'DEMO-902', applied),
      manual_only_historical: await labelSummary(dbPath, 'DEMO-990', applied),
    };
  }
  matrix.human = {
    overview: formatLabels(matrix.default.overview),
    label: formatLabelReport(matrix.top_k.summary, matrix.top_k.models, matrix.top_k.details, matrix.top_k.session_details),
  };
  matrix.json = JSON.stringify(matrix);
  return matrix;
}

async function main() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-report-bench-'));
  try {
    const dbPath = resolvePaths({ env: { COPILOT_METRICS_HOME: home }, cwd: process.cwd() }).usageDb;
    await seedStore(dbPath, path.join(__dirname, '..', 'test', 'fixtures'));
    const standalone = await measure(() => publicMatrix(dbPath));
    const contextBuild = await measure(() => createLabelReportContext(dbPath));
    const contextBacked = await measure(() => publicMatrix(dbPath, contextBuild.value));
    assert.deepStrictEqual(contextBacked.value, standalone.value);
    assert.equal(contextBacked.value.default.manual_only_historical.usage_records, 1);
    assert.equal(contextBacked.value.default.manual_only_historical.input_tokens, 100);

    process.stdout.write(`${JSON.stringify({
      package: pkg.name, version: pkg.version, node: process.version,
      inputs: { modes: ['default', 'top-k', 'all-match'], manual_only: true, historical_deduplication: true },
      equivalence: { deep_public_outputs: true, human: true, json: true },
      timings: {
        standalone_ms: standalone.elapsed_ms,
        context_build_ms: contextBuild.elapsed_ms,
        repeated_context_backed_ms: contextBacked.elapsed_ms,
        context_backed_speedup: Number((standalone.elapsed_ms / Math.max(contextBacked.elapsed_ms, 0.001)).toFixed(2)),
      },
      output_counts: {
        labels: contextBacked.value.default.overview.length,
        details: contextBacked.value.top_k.details.length,
        sessions: contextBacked.value.top_k.session_details.length,
      },
    }, null, 2)}\n`);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error?.stack || error); process.exit(1); });
