#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const pkg = require('../package.json');
const { resolvePaths } = require('../src/paths');
const {
  initStore,
  queryRows,
  runImportMutationBatch,
  upsertImportCheckpoint,
} = require('../src/sqlite-store');

async function main() {
  const operations = Number(process.argv[2] || 1000);
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-storage-bench-'));
  const dbPath = resolvePaths({ env: { COPILOT_METRICS_HOME: home }, cwd: process.cwd() }).usageDb;
  await initStore(dbPath);

  const started = performance.now();
  await runImportMutationBatch(dbPath, async () => {
    for (let index = 0; index < operations; index += 1) {
      await upsertImportCheckpoint(dbPath, 'benchmark', `/tmp/source-${index}.jsonl`, index, {
        file_stat: { size: index, mtimeMs: index },
      });
    }
  });
  const elapsed_ms = Number((performance.now() - started).toFixed(3));
  const rows = await queryRows(dbPath, 'SELECT COUNT(*) AS count FROM import_checkpoints WHERE source = ?', ['benchmark']);

  process.stdout.write(`${JSON.stringify({
    backend: 'better-sqlite3',
    package: pkg.name,
    version: pkg.version,
    node: process.version,
    operations,
    rows: rows[0]?.count || 0,
    elapsed_ms,
    spike_baseline_ms: {
      sqljs_helper_checkpoint_writes: 46341.27,
      better_sqlite_transaction: 1.38,
    },
  }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
