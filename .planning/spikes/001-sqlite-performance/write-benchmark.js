'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const root = path.resolve(__dirname, '../../..');
const { resolvePaths } = require(path.join(root, 'src/paths'));
const { upsertImportCheckpoint } = require(path.join(root, 'src/sqlite-store'));
const betterSqlite = require('better-sqlite3');

const currentPaths = resolvePaths({ cwd: root });

function copyStore(suffix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `copilot-metrics-write-${suffix}-`));
  const dbPath = path.join(dir, 'copilot-metrics.sqlite');
  fs.copyFileSync(currentPaths.usageDb, dbPath);
  return dbPath;
}

function ms(start) {
  return Number((performance.now() - start).toFixed(2));
}

async function sqlJsCheckpointWrites(count) {
  const dbPath = copyStore('sqljs');
  const started = performance.now();
  for (let index = 0; index < count; index += 1) {
    await upsertImportCheckpoint(dbPath, 'spike-sqljs', `/tmp/source-${index}.jsonl`, index, {
      file_stat: { size: index, mtimeMs: index },
    });
  }
  return { backend: 'sql.js current helper', count, ms: ms(started), db_path: dbPath };
}

function betterCheckpointWrites(count) {
  const dbPath = copyStore('better');
  const db = betterSqlite(dbPath);
  const started = performance.now();
  try {
    const statement = db.prepare(`
      INSERT INTO import_checkpoints (source, source_file, checkpoint_line, context_json, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(source, source_file) DO UPDATE SET
        checkpoint_line = excluded.checkpoint_line,
        context_json = excluded.context_json,
        updated_at = excluded.updated_at
    `);
    const tx = db.transaction(() => {
      for (let index = 0; index < count; index += 1) {
        statement.run('spike-better', `/tmp/source-${index}.jsonl`, index, JSON.stringify({
          file_stat: { size: index, mtimeMs: index },
        }), new Date().toISOString());
      }
    });
    tx();
  } finally {
    db.close();
  }
  return { backend: 'better-sqlite3 transaction', count, ms: ms(started), db_path: dbPath };
}

async function main() {
  const count = Number(process.argv[2] || 350);
  const results = {
    generated_at: new Date().toISOString(),
    store_size_bytes: fs.statSync(currentPaths.usageDb).size,
    writes: [
      await sqlJsCheckpointWrites(count),
      betterCheckpointWrites(count),
    ],
  };
  const outPath = path.join(__dirname, 'write-benchmark-results.json');
  fs.writeFileSync(outPath, `${JSON.stringify(results, null, 2)}\n`);
  console.log(`Wrote ${outPath}`);
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
