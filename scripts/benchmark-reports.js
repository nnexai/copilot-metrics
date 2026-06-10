#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const pkg = require('../package.json');
const { ingestFile } = require('../src/ingest');
const { resolvePaths } = require('../src/paths');
const {
  createLabelReportContext,
  labelDetails,
  labelModelBreakdown,
  labelOverview,
  labelSessionDetails,
  labelSummary,
} = require('../src/reports');
const { setManualLabels } = require('../src/sqlite-store');

async function measure(fn) {
  const started = performance.now();
  const value = await fn();
  return {
    elapsed_ms: Number((performance.now() - started).toFixed(3)),
    value,
  };
}

async function seedStore(dbPath, fixtures) {
  await ingestFile({
    dbPath,
    source: 'vscode',
    file: path.join(fixtures, 'vscode-otel.jsonl'),
  });
  await ingestFile({
    dbPath,
    source: 'copilot-cli',
    file: path.join(fixtures, 'copilot-cli-otel.jsonl'),
  });
  await ingestFile({
    dbPath,
    source: 'hooks',
    file: path.join(fixtures, 'hook-events.jsonl'),
  });
  await setManualLabels(dbPath, 'session-cli', ['DEMO-901', 'DEMO-902']);
}

async function main() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-report-bench-'));
  const dbPath = resolvePaths({ env: { COPILOT_METRICS_HOME: home }, cwd: process.cwd() }).usageDb;
  const fixtures = path.join(__dirname, '..', 'test', 'fixtures');
  const label = process.argv[2] || 'DEMO-12345';
  const options = { topK: 2 };

  await seedStore(dbPath, fixtures);

  const baseline = await measure(async () => ({
    overview: (await labelOverview(dbPath)).length,
    summary: Boolean(await labelSummary(dbPath, label, options)),
    models: (await labelModelBreakdown(dbPath, label, options)).length,
    session_details: (await labelSessionDetails(dbPath, label, options)).length,
    details: (await labelDetails(dbPath, label, options)).length,
  }));

  const optimized = await measure(async () => {
    const context = await createLabelReportContext(dbPath);
    const contextOptions = { ...options, context };
    return {
      overview: (await labelOverview(dbPath, { context })).length,
      summary: Boolean(await labelSummary(dbPath, label, contextOptions)),
      models: (await labelModelBreakdown(dbPath, label, contextOptions)).length,
      session_details: (await labelSessionDetails(dbPath, label, contextOptions)).length,
      details: (await labelDetails(dbPath, label, contextOptions)).length,
    };
  });

  process.stdout.write(`${JSON.stringify({
    package: pkg.name,
    version: pkg.version,
    node: process.version,
    label,
    baseline_ms: baseline.elapsed_ms,
    optimized_ms: optimized.elapsed_ms,
    speedup: Number((baseline.elapsed_ms / Math.max(optimized.elapsed_ms, 0.001)).toFixed(2)),
    output_shape: optimized.value,
    equivalent_shape: JSON.stringify(baseline.value) === JSON.stringify(optimized.value),
  }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
