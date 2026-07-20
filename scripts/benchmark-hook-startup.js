#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');

const projectRoot = path.join(__dirname, '..');
const payload = {
  sessionId: 'benchmark-session',
  cwd: '/work/BENCH-123',
  prompt: 'Sensitive benchmark prompt for BENCH-123',
};

function percentile(samples, fraction) {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

function rounded(value) {
  return Number(value.toFixed(3));
}

function readRecords(home) {
  const file = path.join(home, 'hooks', 'copilot-hooks.jsonl');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

function comparable(record) {
  const { captured_at: _capturedAt, ...value } = record;
  return value;
}

function invoke(command, home) {
  const beforeCount = readRecords(home).length;
  const started = performance.now();
  const result = spawnSync(process.execPath, command, {
    cwd: projectRoot,
    env: { ...process.env, COPILOT_METRICS_HOME: home },
    input: JSON.stringify(payload),
    encoding: 'utf8',
  });
  const elapsed = performance.now() - started;
  if (result.status !== 0) {
    throw new Error(`Hook process failed (${result.status}): ${result.stderr.trim()}`);
  }
  const records = readRecords(home);
  if (records.length !== beforeCount + 1) {
    throw new Error(`Expected exactly one appended record, found ${records.length - beforeCount}`);
  }
  const record = records.at(-1);
  if (record.raw_prompt_stored !== false || record.prompt_preview !== undefined || !record.labels.includes('BENCH-123')) {
    throw new Error('Hook process did not write the expected redacted benchmark record');
  }
  return { elapsed, record };
}

function measure(command, home, samples) {
  invoke(command, home); // Explicit warm-up, excluded from measurements.
  const timings = [];
  const records = [];
  for (let index = 0; index < samples; index += 1) {
    const result = invoke(command, home);
    timings.push(result.elapsed);
    records.push(result.record);
  }
  return {
    timings,
    records,
    median_ms: rounded(percentile(timings, 0.5)),
    p95_ms: rounded(percentile(timings, 0.95)),
  };
}

function main() {
  const samples = Number(process.argv[2] || 20);
  if (!Number.isInteger(samples) || samples < 1) throw new Error('Sample count must be a positive integer');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-hook-bench-'));
  try {
    const legacy = measure(
      [path.join('bin', 'copilot-metrics.js'), 'hook-log', '--event', 'userPromptSubmitted', '--quiet'],
      path.join(tmp, 'legacy'),
      samples,
    );
    const lightweight = measure(
      [path.join('bin', 'copilot-metrics-hook.js'), '--event', 'userPromptSubmitted', '--quiet'],
      path.join(tmp, 'lightweight'),
      samples,
    );
    const expected = comparable(legacy.records[0]);
    const outputEquivalent = legacy.records.every((record) => JSON.stringify(comparable(record)) === JSON.stringify(expected))
      && lightweight.records.every((record) => JSON.stringify(comparable(record)) === JSON.stringify(expected));
    if (!outputEquivalent) throw new Error('Legacy and lightweight hook records differ');

    process.stdout.write(`${JSON.stringify({
      samples,
      warmups_per_command: 1,
      output_equivalent: true,
      legacy: { median_ms: legacy.median_ms, p95_ms: legacy.p95_ms },
      lightweight: { median_ms: lightweight.median_ms, p95_ms: lightweight.p95_ms },
      speedup: rounded(legacy.median_ms / lightweight.median_ms),
    }, null, 2)}\n`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
  process.exitCode = 1;
}
