'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');

const root = path.resolve(__dirname, '../../..');
const currentPaths = require(path.join(root, 'src/paths')).resolvePaths({ cwd: root });
const betterSqlite = require('better-sqlite3');
const initSqlJs = require(path.join(root, 'node_modules/sql.js'));

const LABEL_EVIDENCE_USAGE_SQL = `
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
ORDER BY le.session_id, le.usage_record_id, le.hook_event_id, le.label, le.source_type, le.source_field`;

const LABEL_EVIDENCE_ROWS_SQL = `
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
ORDER BY session_id, usage_record_id, hook_event_id, label, source_type, source_field, source_value`;

const MANUAL_LABEL_USAGE_SQL = `
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
ORDER BY mla.session_id, mla.label, ur.id`;

const MODEL_REPORT_SQL = `
SELECT
  COALESCE(resolved_model, requested_model, 'unknown') AS model,
  COUNT(*) AS usage_records,
  SUM(input_tokens) AS input_tokens,
  SUM(output_tokens) AS output_tokens,
  SUM(COALESCE(selected_ai_credits, 0)) AS selected_ai_credits,
  SUM(COALESCE(selected_usd, 0)) AS selected_usd
FROM usage_records
GROUP BY COALESCE(resolved_model, requested_model, 'unknown')
ORDER BY selected_ai_credits DESC, model`;

function ms(start) {
  return Number((performance.now() - start).toFixed(2));
}

function copyIfExists(from, to) {
  if (!fs.existsSync(from)) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return true;
}

function prepareHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-perf-'));
  copyIfExists(currentPaths.configJson, path.join(home, 'config.json'));
  copyIfExists(currentPaths.usageDb, path.join(home, 'store/copilot-metrics.sqlite'));
  fs.mkdirSync(path.join(home, 'telemetry'), { recursive: true });
  fs.mkdirSync(path.join(home, 'hooks'), { recursive: true });
  fs.rmSync(`${path.join(home, 'store/copilot-metrics.sqlite')}.lock`, { recursive: true, force: true });
  return home;
}

function command(args, home) {
  const started = performance.now();
  const result = spawnSync(process.execPath, [path.join(root, 'bin/copilot-metrics.js'), ...args], {
    cwd: root,
    env: { ...process.env, COPILOT_METRICS_HOME: home },
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  return {
    args,
    ms: ms(started),
    status: result.status,
    stdoutBytes: Buffer.byteLength(result.stdout || ''),
    stderrBytes: Buffer.byteLength(result.stderr || ''),
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function parseJson(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function sqlJsExecRows(db, sql) {
  const result = db.exec(sql);
  if (!result.length) return [];
  const [{ columns, values }] = result;
  return values.map((row) => Object.fromEntries(row.map((value, index) => [columns[index], value])));
}

async function sqlJsQueries(dbPath) {
  const SQL = await initSqlJs();
  const queries = [
    ['labelEvidenceUsageRows', LABEL_EVIDENCE_USAGE_SQL],
    ['manualLabelUsageRows', MANUAL_LABEL_USAGE_SQL],
    ['labelEvidenceRows', LABEL_EVIDENCE_ROWS_SQL],
    ['activeManualLabelAssignments', 'SELECT session_id, label, created_at, updated_at FROM manual_label_assignments ORDER BY session_id, label'],
    ['modelReportSubset', MODEL_REPORT_SQL],
  ];
  const timings = [];
  for (const [name, sql] of queries) {
    const started = performance.now();
    const db = new SQL.Database(fs.readFileSync(dbPath));
    const openMs = ms(started);
    const queryStart = performance.now();
    const rows = sqlJsExecRows(db, sql);
    const queryMs = ms(queryStart);
    db.close();
    timings.push({ name, rows: rows.length, open_ms: openMs, query_ms: queryMs, total_ms: Number((openMs + queryMs).toFixed(2)) });
  }
  return timings;
}

function betterSqliteQueries(dbPath) {
  const openStart = performance.now();
  const db = betterSqlite(dbPath, { readonly: true, fileMustExist: true });
  const openMs = ms(openStart);
  const queries = [
    ['labelEvidenceUsageRows', LABEL_EVIDENCE_USAGE_SQL],
    ['manualLabelUsageRows', MANUAL_LABEL_USAGE_SQL],
    ['labelEvidenceRows', LABEL_EVIDENCE_ROWS_SQL],
    ['activeManualLabelAssignments', 'SELECT session_id, label, created_at, updated_at FROM manual_label_assignments ORDER BY session_id, label'],
    ['modelReportSubset', MODEL_REPORT_SQL],
  ];
  const timings = [];
  try {
    for (const [name, sql] of queries) {
      const started = performance.now();
      const rows = db.prepare(sql).all();
      const queryMs = ms(started);
      const queryOpenMs = name === queries[0][0] ? openMs : 0;
      timings.push({ name, rows: rows.length, open_ms: queryOpenMs, query_ms: queryMs, total_ms: Number((queryOpenMs + queryMs).toFixed(2)) });
    }
  } finally {
    db.close();
  }
  return timings;
}

function storeStats(dbPath) {
  const db = betterSqlite(dbPath, { readonly: true, fileMustExist: true });
  try {
    const tables = ['raw_records', 'usage_records', 'hook_events', 'label_evidence', 'manual_label_assignments', 'import_checkpoints', 'import_warnings'];
    const counts = Object.fromEntries(tables.map((table) => [table, db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count]));
    const sizeBytes = fs.statSync(dbPath).size;
    return { db_path: dbPath, size_bytes: sizeBytes, counts };
  } finally {
    db.close();
  }
}

async function main() {
  if (!fs.existsSync(currentPaths.usageDb)) {
    throw new Error(`No existing store at ${currentPaths.usageDb}. Run copilot-metrics setup/import first.`);
  }

  const home = prepareHome();
  const dbPath = path.join(home, 'store/copilot-metrics.sqlite');
  const results = {
    generated_at: new Date().toISOString(),
    root,
    source_home: currentPaths.home,
    benchmark_home: home,
    store_before: storeStats(dbPath),
    cli: [],
    microbench: {},
  };

  const labelsCold = command(['report', 'labels', '--json'], home);
  results.cli.push(summarizeCommand(labelsCold));
  const labelsPayload = parseJson(labelsCold.stdout);
  const topLabel = labelsPayload?.labels?.[0]?.label || null;

  const labelsWarm = command(['report', 'labels', '--json'], home);
  results.cli.push(summarizeCommand(labelsWarm));

  if (topLabel) {
    const detail = command(['report', 'label', topLabel, '--detail', '--session-detail', '--json'], home);
    results.cli.push(summarizeCommand(detail));
  }

  const refresh = command(['report', 'labels', '--refresh', '--json'], home);
  results.cli.push(summarizeCommand(refresh));

  results.store_after = storeStats(dbPath);
  results.microbench.sql_js = await sqlJsQueries(dbPath);
  results.microbench.better_sqlite3 = betterSqliteQueries(dbPath);

  const outPath = path.join(__dirname, 'benchmark-results.json');
  fs.writeFileSync(outPath, `${JSON.stringify(results, null, 2)}\n`);
  console.log(`Wrote ${outPath}`);
  console.log(JSON.stringify({
    top_label: topLabel,
    cli: results.cli.map((item) => ({ args: item.args.join(' '), ms: item.ms, status: item.status })),
    microbench: results.microbench,
  }, null, 2));
}

function summarizeCommand(result) {
  return {
    args: result.args,
    ms: result.ms,
    status: result.status,
    stdout_bytes: result.stdoutBytes,
    stderr_bytes: result.stderrBytes,
    stderr_excerpt: result.stderr.slice(0, 4000),
  };
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
