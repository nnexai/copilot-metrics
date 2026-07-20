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
const { queryOne } = require('../src/sqlite-store');

function positiveInteger(value, fallback, name) {
  const parsed = Number(value || fallback);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function usageLine(index) {
  const label = `DEMO-${10000 + (index % 250)}`;
  return JSON.stringify({
    name: 'copilot cli chat',
    spanId: `benchmark-span-${index}`,
    traceId: `benchmark-trace-${Math.floor(index / 4)}`,
    timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
    attributes: {
      'gen_ai.operation.name': 'chat',
      'gen_ai.request.model': 'gpt-5-mini',
      'session.id': `benchmark-session-${Math.floor(index / 4)}`,
      cwd: `/work/${label}`,
      'git.branch': `feature/${label}`,
      'gen_ai.usage.input_tokens': 100 + (index % 50),
      'gen_ai.usage.output_tokens': 20 + (index % 10),
    },
  });
}

function payload(start, count) {
  return `${Array.from({ length: count }, (_, offset) => usageLine(start + offset)).join('\n')}\n`;
}

async function snapshot(dbPath) {
  return {
    usage: await queryOne(dbPath, `
      SELECT span_id, trace_id, session_id, resolved_model, input_tokens, output_tokens,
             cache_read_tokens, selected_ai_credits, selected_pricing_basis,
             pricing_diagnostics_json, usage_identity
      FROM usage_records
      ORDER BY span_id
    `),
    evidence: await queryOne(dbPath, `
      SELECT label, source_type, source_field, source_value, confidence
      FROM label_evidence
      ORDER BY label, source_type, source_field, source_value, confidence
    `),
    warnings: await queryOne(dbPath, `
      SELECT line, code, message
      FROM import_warnings
      ORDER BY line, code, message
    `),
    raw_records: Number((await queryOne(dbPath, 'SELECT COUNT(*) AS count FROM raw_records'))[0]?.count || 0),
  };
}

async function measuredImport(options) {
  let bytesRead = 0;
  const started = performance.now();
  const result = await ingestFile({
    ...options,
    jsonlReadOptions: {
      onRead(read) {
        if (read.purpose === 'payload') bytesRead += read.length;
      },
    },
  });
  return {
    result,
    bytesRead,
    elapsedMs: Number((performance.now() - started).toFixed(3)),
  };
}

async function main() {
  const historyRecords = positiveInteger(process.argv[2], 2000, 'history records');
  const appendedRecords = positiveInteger(process.argv[3], 10, 'appended records');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-incremental-bench-'));
  const incrementalFile = path.join(tempRoot, 'incremental.jsonl');
  const completeFile = path.join(tempRoot, 'complete.jsonl');
  const incrementalDb = resolvePaths({
    env: { COPILOT_METRICS_HOME: path.join(tempRoot, 'incremental-home') },
    cwd: process.cwd(),
  }).usageDb;
  const completeDb = resolvePaths({
    env: { COPILOT_METRICS_HOME: path.join(tempRoot, 'complete-home') },
    cwd: process.cwd(),
  }).usageDb;
  const historyPayload = payload(0, historyRecords);
  const appendedPayload = payload(historyRecords, appendedRecords);

  fs.writeFileSync(incrementalFile, historyPayload);
  await ingestFile({ dbPath: incrementalDb, file: incrementalFile, source: 'copilot-cli' });
  fs.appendFileSync(incrementalFile, appendedPayload);
  const incremental = await measuredImport({
    dbPath: incrementalDb,
    file: incrementalFile,
    source: 'copilot-cli',
  });

  fs.writeFileSync(completeFile, `${historyPayload}${appendedPayload}`);
  const complete = await measuredImport({
    dbPath: completeDb,
    file: completeFile,
    source: 'copilot-cli',
  });

  const incrementalSnapshot = await snapshot(incrementalDb);
  const completeSnapshot = await snapshot(completeDb);
  assert.deepEqual(incrementalSnapshot, completeSnapshot, 'incremental and complete imports diverged');
  assert.equal(incremental.result.usage_records, appendedRecords);
  assert.equal(complete.result.usage_records, historyRecords + appendedRecords);

  process.stdout.write(`${JSON.stringify({
    package: pkg.name,
    version: pkg.version,
    node: process.version,
    history_records: historyRecords,
    appended_records: appendedRecords,
    history_bytes: Buffer.byteLength(historyPayload),
    appended_bytes: Buffer.byteLength(appendedPayload),
    final_bytes: Buffer.byteLength(historyPayload) + Buffer.byteLength(appendedPayload),
    incremental_elapsed_ms: incremental.elapsedMs,
    complete_elapsed_ms: complete.elapsedMs,
    incremental_bytes_read: incremental.bytesRead,
    complete_bytes_read: complete.bytesRead,
    speedup: Number((complete.elapsedMs / Math.max(incremental.elapsedMs, 0.001)).toFixed(3)),
    result_counts: {
      usage: incrementalSnapshot.usage.length,
      evidence: incrementalSnapshot.evidence.length,
      warnings: incrementalSnapshot.warnings.length,
      raw_records: incrementalSnapshot.raw_records,
    },
    semantic_equivalence: true,
  }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
