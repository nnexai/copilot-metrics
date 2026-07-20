#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const BetterSqlite = require('better-sqlite3');
const pkg = require('../package.json');
const { BENCHMARK_SAMPLE_COUNT, assertRelativeTiming } = require('./benchmark-utils');
const { resolvePaths } = require('../src/paths');
const {
  _benchmarkLegacyMaintenance,
  initStore,
  insertImport,
  queryRows,
} = require('../src/sqlite-store');

function usage(identity, overrides = {}) {
  return {
    raw_line: 1, span_id: identity, trace_id: `trace-${identity}`, timestamp: '2026-07-20T10:00:00.000Z',
    surface: 'benchmark', session_id: `session-${identity}`, requested_model: 'gpt-5-mini', resolved_model: 'gpt-5-mini',
    input_tokens: 10, output_tokens: 2, cache_read_tokens: 0, cache_creation_tokens: 0, reasoning_tokens: 0,
    estimated_usd: 0.001, estimated_ai_credits: 0.1, selected_ai_credits: 0.1, selected_usd: 0.001,
    selected_pricing_basis: 'estimated', selected_confidence: 'high', pricing_basis: 'estimated',
    estimate_confidence: 'high', cache_read_status: 'explicit_zero', estimate_label: 'estimate:benchmark',
    pricing_metadata: {}, pricing_diagnostics: [], warnings: [], usage_identity: identity,
    label_evidence: [{ label: 'BENCH-123', source_type: 'usage', source_field: 'branch', source_value: 'BENCH-123', confidence: 1 }],
    ...overrides,
  };
}

async function snapshot(dbPath) {
  const db = new BetterSqlite(dbPath);
  let schemaVersion;
  try { schemaVersion = db.pragma('user_version', { simple: true }); } finally { db.close(); }
  return {
    schema_version: schemaVersion,
    usage: await queryRows(dbPath, 'SELECT id, usage_identity, pricing_basis, selected_ai_credits FROM usage_records ORDER BY id'),
    evidence: await queryRows(dbPath, 'SELECT label, usage_record_id, source_field, source_value FROM label_evidence ORDER BY label, usage_record_id, source_field, source_value'),
    metadata: await queryRows(dbPath, 'SELECT key, value FROM store_metadata ORDER BY key'),
  };
}

async function timed(fn) {
  const started = performance.now();
  const value = await fn();
  return { elapsed_ms: Number((performance.now() - started).toFixed(3)), value };
}

function median(values) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.floor(ordered.length / 2)];
}

async function timedSamples(fn, count = BENCHMARK_SAMPLE_COUNT) {
  await fn();
  const samples = [];
  for (let index = 0; index < count; index += 1) samples.push((await timed(fn)).elapsed_ms);
  return { samples_ms: samples, median_ms: Number(median(samples).toFixed(3)) };
}

async function measuredSqlWork(fn) {
  const originalPrepare = BetterSqlite.prototype.prepare;
  const originalPragma = BetterSqlite.prototype.pragma;
  let operations = 0;
  BetterSqlite.prototype.prepare = function measuredPrepare(...args) {
    operations += 1;
    return originalPrepare.apply(this, args);
  };
  BetterSqlite.prototype.pragma = function measuredPragma(...args) {
    operations += 1;
    return originalPragma.apply(this, args);
  };
  try {
    await fn();
  } finally {
    BetterSqlite.prototype.prepare = originalPrepare;
    BetterSqlite.prototype.pragma = originalPragma;
  }
  return operations;
}

async function main() {
  const operations = Math.max(10, Number(process.argv[2] || 1000));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-storage-bench-'));
  try {
    const baseDb = resolvePaths({ env: { COPILOT_METRICS_HOME: path.join(home, 'base') }, cwd: process.cwd() }).usageDb;
    await initStore(baseDb);
    await insertImport(baseDb, 'benchmark', 'seed.jsonl', [], [usage('existing-0')], [], []);

    const migrationDb = path.join(home, 'migration.sqlite');
    fs.copyFileSync(baseDb, migrationDb);
    const unversioned = new BetterSqlite(migrationDb);
    try { unversioned.pragma('user_version = 0'); } finally { unversioned.close(); }
    const migration = await timed(() => initStore(migrationDb));

    const optimizedDb = path.join(home, 'optimized.sqlite');
    const legacyDb = path.join(home, 'legacy.sqlite');
    fs.copyFileSync(baseDb, optimizedDb);
    fs.copyFileSync(baseDb, legacyDb);
    const repeats = 10;
    const initializeCurrent = async () => { for (let i = 0; i < repeats; i += 1) await initStore(optimizedDb); };
    const runLegacyMaintenance = async () => { for (let i = 0; i < repeats; i += 1) await _benchmarkLegacyMaintenance(legacyDb); };
    const optimized = await timedSamples(initializeCurrent);
    const legacy = await timedSamples(runLegacyMaintenance);
    const optimizedSqlOperations = await measuredSqlWork(initializeCurrent);
    const legacySqlOperations = await measuredSqlWork(runLegacyMaintenance);
    assert.ok(optimizedSqlOperations < legacySqlOperations, `current initialization SQL work regressed: ${optimizedSqlOperations} >= ${legacySqlOperations}`);
    assert.deepEqual(await snapshot(optimizedDb), await snapshot(legacyDb));
    const repeatedOpenTimingGate = assertRelativeTiming({
      optimizedMedianMs: optimized.median_ms,
      referenceMedianMs: legacy.median_ms,
      label: 'current-store repeated open',
    });

    const importDb = path.join(home, 'import.sqlite');
    fs.copyFileSync(baseDb, importDb);
    const records = Array.from({ length: operations }, (_, index) => usage(
      index % 4 === 0 ? 'existing-0' : `new-${index}`,
      index === operations - 1 ? { pricing_basis: 'actual', selected_pricing_basis: 'actual', selected_ai_credits: 2, selected_usd: 0.02, actual_ai_credits: 2, actual_usd: 0.02 } : {},
    ));
    records.push(usage('within-batch'), usage('within-batch', { pricing_basis: 'actual', selected_pricing_basis: 'actual', selected_ai_credits: 3, selected_usd: 0.03, actual_ai_credits: 3, actual_usd: 0.03 }));
    const batchImport = await timed(() => insertImport(importDb, 'benchmark', 'mixed.jsonl', [], records, [], []));
    const importSnapshot = await snapshot(importDb);
    const expectedInserted = 1 + records.filter((row) => row.usage_identity !== 'existing-0').reduce((set, row) => set.add(row.usage_identity), new Set()).size;
    assert.equal(importSnapshot.usage.length, expectedInserted);
    assert.equal(importSnapshot.schema_version, 2);
    assert.equal(batchImport.value.inserted_usage_records, expectedInserted - 1);
    assert.equal(importSnapshot.usage.find((row) => row.usage_identity === 'within-batch').pricing_basis, 'actual');
    assert.ok(importSnapshot.evidence.every((row) => Number.isInteger(row.usage_record_id)));

    process.stdout.write(`${JSON.stringify({
      backend: 'better-sqlite3', package: pkg.name, version: pkg.version, node: process.version,
      inputs: { operations, repeats }, schema_version: importSnapshot.schema_version,
      equivalence: { migration: true, repeated_maintenance: true, batch_import: true },
      timings: {
        one_time_migration_ms: migration.elapsed_ms,
        repeated_current_store_samples_ms: optimized.samples_ms,
        repeated_current_store_median_ms: optimized.median_ms,
        repeated_legacy_maintenance_samples_ms: legacy.samples_ms,
        repeated_legacy_maintenance_median_ms: legacy.median_ms,
        repeated_open_speedup: Number((legacy.median_ms / Math.max(optimized.median_ms, 0.001)).toFixed(2)),
        mixed_batch_import_ms: batchImport.elapsed_ms,
      },
      structural_work: {
        repeated_current_store_sql_operations: optimizedSqlOperations,
        repeated_legacy_maintenance_sql_operations: legacySqlOperations,
        current_store_uses_less_sql_work: true,
      },
      timing_gates: { repeated_current_store: repeatedOpenTimingGate },
      counts: { usage: importSnapshot.usage.length, evidence: importSnapshot.evidence.length },
    }, null, 2)}\n`);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error?.stack || error); process.exit(1); });
