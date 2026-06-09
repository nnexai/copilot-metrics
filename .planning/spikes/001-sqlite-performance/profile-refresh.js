'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const root = path.resolve(__dirname, '../../..');
const { resolvePaths } = require(path.join(root, 'src/paths'));
const { autoImportConfiguredSources, configuredSourceEntries } = require(path.join(root, 'src/ingest'));
const { loadConfiguredExtractors } = require(path.join(root, 'src/label-extractors'));

const currentPaths = resolvePaths({ cwd: root });

function copyIfExists(from, to) {
  if (!fs.existsSync(from)) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return true;
}

function prepareHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-refresh-profile-'));
  copyIfExists(currentPaths.configJson, path.join(home, 'config.json'));
  copyIfExists(currentPaths.usageDb, path.join(home, 'store/copilot-metrics.sqlite'));
  fs.mkdirSync(path.join(home, 'telemetry'), { recursive: true });
  fs.mkdirSync(path.join(home, 'hooks'), { recursive: true });
  fs.rmSync(`${path.join(home, 'store/copilot-metrics.sqlite')}.lock`, { recursive: true, force: true });
  return home;
}

function readJson(file) {
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function fileMeta(file) {
  try {
    const stat = fs.statSync(file);
    return { size_bytes: stat.size, mtime_ms: Math.trunc(stat.mtimeMs) };
  } catch {
    return { size_bytes: null, mtime_ms: null };
  }
}

async function main() {
  const home = prepareHome();
  const paths = resolvePaths({ cwd: root, env: { ...process.env, COPILOT_METRICS_HOME: home } });
  const entries = configuredSourceEntries(paths, readJson(paths.configJson)).files;
  const byIndex = new Map(entries.map((entry, index) => [index + 1, { ...entry, ...fileMeta(entry.file) }]));
  const sourceTimings = [];
  const started = performance.now();
  let current = null;

  const results = await autoImportConfiguredSources(paths, {
    cwd: root,
    extractors: loadConfiguredExtractors(paths.configJson, root),
    forceRefresh: true,
    onProgress(event) {
      if (event.phase === 'source') {
        current = {
          ...byIndex.get(event.current),
          index: event.current,
          total: event.total,
          started_at_ms: performance.now() - started,
        };
      }
      if (event.phase === 'done' && current) {
        sourceTimings.push({
          ...current,
          duration_ms: Number((performance.now() - started - current.started_at_ms).toFixed(2)),
          result: event.result,
        });
        current = null;
      }
    },
  });

  const summary = {
    generated_at: new Date().toISOString(),
    source_home: currentPaths.home,
    profile_home: home,
    total_ms: Number((performance.now() - started).toFixed(2)),
    source_count: entries.length,
    diagnostics_count: results.filter((result) => result.diagnostic).length,
    totals: results.reduce((acc, result) => {
      acc.raw_records += Number(result.raw_records || 0);
      acc.new_raw_records += Number(result.new_raw_records || 0);
      acc.usage_records += Number(result.usage_records || 0);
      acc.duplicate_usage_records += Number(result.duplicate_usage_records || 0);
      acc.repaired_duplicate_usage_records += Number(result.repaired_duplicate_usage_records || 0);
      acc.repaired_cost_records += Number(result.repaired_cost_records || 0);
      acc.label_evidence += Number(result.label_evidence || 0);
      acc.warnings += Array.isArray(result.warnings) ? result.warnings.length : 0;
      return acc;
    }, {
      raw_records: 0,
      new_raw_records: 0,
      usage_records: 0,
      duplicate_usage_records: 0,
      repaired_duplicate_usage_records: 0,
      repaired_cost_records: 0,
      label_evidence: 0,
      warnings: 0,
    }),
    slowest_sources: sourceTimings
      .slice()
      .sort((left, right) => right.duration_ms - left.duration_ms)
      .slice(0, 25),
    by_source: Object.values(sourceTimings.reduce((acc, item) => {
      const key = item.source;
      if (!acc[key]) acc[key] = { source: key, count: 0, duration_ms: 0, size_bytes: 0, raw_records: 0, new_raw_records: 0, warnings: 0 };
      acc[key].count += 1;
      acc[key].duration_ms += item.duration_ms;
      acc[key].size_bytes += Number(item.size_bytes || 0);
      acc[key].raw_records += Number(item.result?.raw_records || 0);
      acc[key].new_raw_records += Number(item.result?.new_raw_records || 0);
      acc[key].warnings += Array.isArray(item.result?.warnings) ? item.result.warnings.length : 0;
      return acc;
    }, {})).map((item) => ({ ...item, duration_ms: Number(item.duration_ms.toFixed(2)) })),
  };

  const outPath = path.join(__dirname, 'refresh-profile.json');
  fs.writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`Wrote ${outPath}`);
  console.log(JSON.stringify({
    total_ms: summary.total_ms,
    source_count: summary.source_count,
    totals: summary.totals,
    by_source: summary.by_source,
    slowest_sources: summary.slowest_sources.slice(0, 10).map((item) => ({
      source: item.source,
      duration_ms: item.duration_ms,
      size_bytes: item.size_bytes,
      raw_records: item.result?.raw_records,
      new_raw_records: item.result?.new_raw_records,
      warnings: item.result?.warnings?.length || 0,
      file: item.file,
    })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
