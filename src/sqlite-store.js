'use strict';

const fs = require('node:fs');
const path = require('node:path');
const initSqlJs = require('sql.js');

let sqlModulePromise;

function getSqlModule() {
  if (!sqlModulePromise) sqlModulePromise = initSqlJs();
  return sqlModulePromise;
}

async function openDatabase(dbPath) {
  const SQL = await getSqlModule();
  if (fs.existsSync(dbPath)) {
    return new SQL.Database(fs.readFileSync(dbPath));
  }
  return new SQL.Database();
}

function persistDatabase(dbPath, db) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(dbPath, Buffer.from(db.export()), { mode: 0o600 });
  try {
    fs.chmodSync(dbPath, 0o600);
  } catch {
    // Best-effort on non-POSIX filesystems.
  }
}

function hasColumn(db, table, column) {
  const result = db.exec(`PRAGMA table_info(${table})`);
  if (!result.length) return false;
  const nameIndex = result[0].columns.indexOf('name');
  return result[0].values.some((row) => row[nameIndex] === column);
}

function addColumnIfMissing(db, table, column, definition) {
  if (!hasColumn(db, table, column)) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function initStore(dbPath) {
  const db = await openDatabase(dbPath);
  db.run(`
CREATE TABLE IF NOT EXISTS raw_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  imported_at TEXT NOT NULL,
  source TEXT NOT NULL,
  source_file TEXT,
  line INTEGER NOT NULL,
  raw_fingerprint TEXT,
  payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS usage_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  imported_at TEXT NOT NULL,
  source TEXT NOT NULL,
  raw_line INTEGER NOT NULL,
  span_id TEXT,
  trace_id TEXT,
  parent_span_id TEXT,
  timestamp TEXT,
  surface TEXT,
  conversation_id TEXT,
  session_id TEXT,
  requested_model TEXT,
  resolved_model TEXT,
  repo TEXT,
  branch TEXT,
  cwd TEXT,
  commit_sha TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_usd REAL,
  estimated_ai_credits REAL,
  estimate_label TEXT NOT NULL,
  warnings_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS hook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  imported_at TEXT NOT NULL,
  source TEXT NOT NULL,
  raw_line INTEGER NOT NULL,
  event TEXT,
  session_id TEXT,
  cwd TEXT,
  repo TEXT,
  branch TEXT,
  labels_json TEXT NOT NULL,
  payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS label_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  imported_at TEXT NOT NULL,
  label TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_field TEXT NOT NULL,
  source_value TEXT,
  confidence REAL NOT NULL DEFAULT 0,
  usage_record_id INTEGER,
  hook_event_id INTEGER,
  session_id TEXT,
  repo TEXT,
  branch TEXT,
  cwd TEXT,
  timestamp TEXT
);
CREATE TABLE IF NOT EXISTS import_warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  imported_at TEXT NOT NULL,
  source TEXT NOT NULL,
  line INTEGER,
  code TEXT NOT NULL,
  message TEXT NOT NULL
);
`);
  addColumnIfMissing(db, 'raw_records', 'source_file', 'TEXT');
  addColumnIfMissing(db, 'raw_records', 'raw_fingerprint', 'TEXT');
  db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_records_fingerprint ON raw_records (source, source_file, raw_fingerprint)');
  persistDatabase(dbPath, db);
}

function runPrepared(db, sql, rows) {
  const statement = db.prepare(sql);
  try {
    for (const row of rows) statement.run(row);
  } finally {
    statement.free();
  }
}

function lastInsertId(db) {
  const result = db.exec('SELECT last_insert_rowid() AS id');
  return result[0].values[0][0];
}

function insertLabelEvidence(db, importedAt, evidenceRows) {
  if (!evidenceRows.length) return;
  runPrepared(
    db,
    `INSERT INTO label_evidence (
      imported_at, label, source_type, source_field, source_value, confidence,
      usage_record_id, hook_event_id, session_id, repo, branch, cwd, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    evidenceRows.map((evidence) => [
      importedAt,
      evidence.label,
      evidence.source_type,
      evidence.source_field,
      evidence.source_value || null,
      evidence.confidence || 0,
      evidence.usage_record_id || null,
      evidence.hook_event_id || null,
      evidence.session_id || null,
      evidence.repo || null,
      evidence.branch || null,
      evidence.cwd || null,
      evidence.timestamp || null,
    ]),
  );
}

async function existingRawFingerprints(dbPath, source, sourceFile, fingerprints) {
  await initStore(dbPath);
  if (!fingerprints.length) return new Set();
  const db = await openDatabase(dbPath);
  const existing = new Set();
  const statement = db.prepare('SELECT 1 FROM raw_records WHERE source = ? AND source_file = ? AND raw_fingerprint = ? LIMIT 1');
  try {
    for (const fingerprint of fingerprints) {
      statement.bind([source, sourceFile, fingerprint]);
      if (statement.step()) existing.add(fingerprint);
      statement.reset();
    }
  } finally {
    statement.free();
  }
  return existing;
}

async function importedLineHighWater(dbPath, source, sourceFile) {
  await initStore(dbPath);
  const rows = await queryRows(
    dbPath,
    'SELECT COALESCE(MAX(line), 0) AS line FROM raw_records WHERE source = ? AND source_file = ?',
    [source, sourceFile],
  );
  return Number(rows[0]?.line || 0);
}

async function insertImport(dbPath, source, sourceFile, rawRecords, usageRecords, hookEvents, warnings) {
  await initStore(dbPath);
  const db = await openDatabase(dbPath);
  const importedAt = new Date().toISOString();

  db.run('BEGIN');
  try {
    runPrepared(
      db,
      'INSERT OR IGNORE INTO raw_records (imported_at, source, source_file, line, raw_fingerprint, payload_json) VALUES (?, ?, ?, ?, ?, ?)',
      rawRecords.map((record) => [importedAt, source, sourceFile, record.line, record.raw_fingerprint || null, JSON.stringify(record.value)]),
    );

    const labelEvidence = [];
    const usageStatement = db.prepare(`INSERT INTO usage_records (
        imported_at, source, raw_line, span_id, trace_id, parent_span_id, timestamp, surface,
        conversation_id, session_id, requested_model, resolved_model, repo, branch, cwd, commit_sha,
        input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, reasoning_tokens,
        estimated_usd, estimated_ai_credits, estimate_label, warnings_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    try {
      for (const usage of usageRecords) {
        usageStatement.run([
          importedAt,
          source,
          usage.raw_line,
          usage.span_id,
          usage.trace_id,
          usage.parent_span_id,
          usage.timestamp,
          usage.surface,
          usage.conversation_id,
          usage.session_id,
          usage.requested_model,
          usage.resolved_model,
          usage.repo,
          usage.branch,
          usage.cwd,
          usage.commit_sha,
          usage.input_tokens,
          usage.output_tokens,
          usage.cache_read_tokens,
          usage.cache_creation_tokens,
          usage.reasoning_tokens,
          usage.estimated_usd,
          usage.estimated_ai_credits,
          usage.estimate_label,
          JSON.stringify(usage.warnings || []),
        ]);
        const usageRecordId = lastInsertId(db);
        for (const evidence of usage.label_evidence || []) {
          labelEvidence.push({
            ...evidence,
            usage_record_id: usageRecordId,
            session_id: usage.session_id,
            repo: usage.repo,
            branch: usage.branch,
            cwd: usage.cwd,
            timestamp: usage.timestamp,
          });
        }
      }
    } finally {
      usageStatement.free();
    }

    const hookStatement = db.prepare('INSERT INTO hook_events (imported_at, source, raw_line, event, session_id, cwd, repo, branch, labels_json, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    try {
      for (const event of hookEvents) {
        hookStatement.run([
          importedAt,
          source,
          event.raw_line,
          event.event,
          event.session_id,
          event.cwd,
          event.repo,
          event.branch,
          JSON.stringify(event.labels || []),
          JSON.stringify(event.payload),
        ]);
        const hookEventId = lastInsertId(db);
        for (const evidence of event.label_evidence || []) {
          labelEvidence.push({
            ...evidence,
            hook_event_id: hookEventId,
            session_id: event.session_id,
            repo: event.repo,
            branch: event.branch,
            cwd: event.cwd,
            timestamp: event.timestamp,
          });
        }
      }
    } finally {
      hookStatement.free();
    }

    insertLabelEvidence(db, importedAt, labelEvidence);

    runPrepared(
      db,
      'INSERT INTO import_warnings (imported_at, source, line, code, message) VALUES (?, ?, ?, ?, ?)',
      warnings.map((warning) => [importedAt, source, warning.line || null, warning.code, warning.message]),
    );

    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }

  persistDatabase(dbPath, db);
}

async function attachVscodeChatLabelEvidence(dbPath, mappings) {
  await initStore(dbPath);
  if (!mappings.length) {
    return { matched_usage_records: 0, label_evidence: 0 };
  }

  const db = await openDatabase(dbPath);
  const importedAt = new Date().toISOString();
  let matchedUsageRecords = 0;
  let labelEvidence = 0;

  const usageStatement = db.prepare(`
    SELECT id, session_id, repo, branch, cwd, timestamp
    FROM usage_records
    WHERE source = 'vscode' AND span_id = ?
  `);
  const existingStatement = db.prepare(`
    SELECT 1
    FROM label_evidence
    WHERE label = ?
      AND source_type = 'usage'
      AND source_field = 'vscode_chat_response'
      AND source_value = ?
      AND usage_record_id = ?
    LIMIT 1
  `);
  const insertStatement = db.prepare(`
    INSERT INTO label_evidence (
      imported_at, label, source_type, source_field, source_value, confidence,
      usage_record_id, hook_event_id, session_id, repo, branch, cwd, timestamp
    ) VALUES (?, ?, 'usage', 'vscode_chat_response', ?, ?, ?, NULL, ?, ?, ?, ?, ?)
  `);

  db.run('BEGIN');
  try {
    for (const mapping of mappings) {
      usageStatement.bind([mapping.responseId]);
      const usageRows = [];
      while (usageStatement.step()) usageRows.push(usageStatement.getAsObject());
      usageStatement.reset();
      matchedUsageRecords += usageRows.length;

      for (const usage of usageRows) {
        for (const evidence of mapping.label_evidence || []) {
          existingStatement.bind([evidence.label, mapping.responseId, usage.id]);
          const exists = existingStatement.step();
          existingStatement.reset();
          if (exists) continue;

          insertStatement.run([
            importedAt,
            evidence.label,
            mapping.responseId,
            evidence.confidence || 0.95,
            usage.id,
            mapping.sessionId || usage.session_id || null,
            usage.repo || null,
            usage.branch || null,
            usage.cwd || null,
            usage.timestamp || null,
          ]);
          labelEvidence += 1;
        }
      }
    }
    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  } finally {
    usageStatement.free();
    existingStatement.free();
    insertStatement.free();
  }

  persistDatabase(dbPath, db);
  return { matched_usage_records: matchedUsageRecords, label_evidence: labelEvidence };
}

async function vscodeRawRecordsNeedingResponseBackfill(dbPath, sourceFile) {
  await initStore(dbPath);
  return queryRows(dbPath, `
    SELECT rr.line, rr.payload_json
    FROM raw_records rr
    WHERE rr.source = 'vscode'
      AND rr.source_file = ?
      AND EXISTS (
        SELECT 1
        FROM usage_records ur
        WHERE ur.source = 'vscode'
          AND ur.raw_line = rr.line
          AND ur.span_id IS NULL
      )
  `, [sourceFile]);
}

async function updateVscodeUsageResponseIds(dbPath, updates) {
  await initStore(dbPath);
  if (!updates.length) return 0;

  const db = await openDatabase(dbPath);
  const statement = db.prepare(`
    UPDATE usage_records
    SET span_id = ?,
        session_id = COALESCE(session_id, ?),
        timestamp = COALESCE(timestamp, ?)
    WHERE source = 'vscode'
      AND raw_line = ?
      AND span_id IS NULL
      AND input_tokens = ?
      AND output_tokens = ?
      AND cache_read_tokens = ?
      AND cache_creation_tokens = ?
      AND reasoning_tokens = ?
      AND COALESCE(resolved_model, requested_model, '') = COALESCE(?, '')
  `);
  let updated = 0;
  db.run('BEGIN');
  try {
    for (const update of updates) {
      statement.run([
        update.span_id,
        update.session_id || null,
        update.timestamp || null,
        update.raw_line,
        update.input_tokens,
        update.output_tokens,
        update.cache_read_tokens,
        update.cache_creation_tokens,
        update.reasoning_tokens,
        update.resolved_model || update.requested_model || '',
      ]);
      updated += typeof db.getRowsModified === 'function' ? db.getRowsModified() : 0;
    }
    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  } finally {
    statement.free();
  }

  persistDatabase(dbPath, db);
  return updated;
}

async function updateUsageCostEstimates(dbPath, updates) {
  await initStore(dbPath);
  if (!updates.length) return 0;

  const db = await openDatabase(dbPath);
  const statement = db.prepare(`
    UPDATE usage_records
    SET estimated_usd = ?,
        estimated_ai_credits = ?,
        warnings_json = ?
    WHERE id = ?
  `);
  let updated = 0;
  db.run('BEGIN');
  try {
    for (const update of updates) {
      statement.run([
        update.estimated_usd,
        update.estimated_ai_credits,
        JSON.stringify(update.warnings || []),
        update.id,
      ]);
      updated += typeof db.getRowsModified === 'function' ? db.getRowsModified() : 0;
    }
    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  } finally {
    statement.free();
  }

  persistDatabase(dbPath, db);
  return updated;
}

async function queryOne(dbPath, sql) {
  const db = await openDatabase(dbPath);
  const result = db.exec(sql);
  if (!result.length) return [];
  const [{ columns, values }] = result;
  return values.map((row) => Object.fromEntries(row.map((value, index) => [columns[index], value])));
}

async function queryRows(dbPath, sql, params = []) {
  const db = await openDatabase(dbPath);
  const statement = db.prepare(sql);
  const rows = [];
  try {
    statement.bind(params);
    while (statement.step()) rows.push(statement.getAsObject());
  } finally {
    statement.free();
  }
  return rows;
}

module.exports = {
  attachVscodeChatLabelEvidence,
  existingRawFingerprints,
  importedLineHighWater,
  initStore,
  insertImport,
  queryOne,
  queryRows,
  updateUsageCostEstimates,
  updateVscodeUsageResponseIds,
  vscodeRawRecordsNeedingResponseBackfill,
};
