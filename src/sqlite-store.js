'use strict';

const fs = require('node:fs');
const path = require('node:path');
const initSqlJs = require('sql.js');
const { canonicalLabel } = require('./label-extractors');

let sqlModulePromise;

function getSqlModule() {
  if (!sqlModulePromise) sqlModulePromise = initSqlJs();
  return sqlModulePromise;
}

async function openDatabase(dbPath) {
  const SQL = await getSqlModule();
  if (fs.existsSync(dbPath)) {
    try {
      return new SQL.Database(fs.readFileSync(dbPath));
    } catch (error) {
      const message = error && error.message ? error.message : error && error.name ? error.name : String(error);
      throw new Error(`SQLite store is unreadable at ${dbPath}: ${message}. Move the file aside and re-run setup/report to rebuild from local sources.`);
    }
  }
  return new SQL.Database();
}

function persistDatabase(dbPath, db) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true, mode: 0o700 });
  const tmpPath = `${dbPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, Buffer.from(db.export()), { mode: 0o600 });
  try {
    fs.chmodSync(tmpPath, 0o600);
  } catch {
    // Best-effort on non-POSIX filesystems.
  }
  fs.renameSync(tmpPath, dbPath);
}

function closeDatabase(db) {
  if (db && typeof db.close === 'function') db.close();
}

function rollbackDatabase(db) {
  try {
    db.run('ROLLBACK');
  } catch {
    // Ignore rollback failures when the transaction was already closed.
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
    return true;
  }
  return false;
}

function hasIndex(db, index) {
  const statement = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ? LIMIT 1");
  try {
    statement.bind([index]);
    return statement.step();
  } finally {
    statement.free();
  }
}

function createIndexIfMissing(db, index, sql) {
  if (hasIndex(db, index)) return false;
  db.run(sql);
  return true;
}

async function initStore(dbPath) {
  const isNewStore = !fs.existsSync(dbPath);
  const db = await openDatabase(dbPath);
  try {
    let changed = isNewStore;
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
  actual_charge_nano_aiu REAL,
  actual_ai_credits REAL,
  actual_usd REAL,
  actual_basis TEXT,
  displayed_ai_credits REAL,
  displayed_usd REAL,
  displayed_credit_text TEXT,
  displayed_credit_basis TEXT,
  inferred_cache_read_tokens INTEGER,
  inferred_cache_read_reason TEXT,
  estimated_usd REAL,
  estimated_ai_credits REAL,
  upper_bound_usd REAL,
  upper_bound_ai_credits REAL,
  selected_ai_credits REAL,
  selected_usd REAL,
  selected_pricing_basis TEXT,
  selected_confidence TEXT,
  selected_source TEXT,
  pricing_basis TEXT NOT NULL DEFAULT 'estimated',
  estimate_confidence TEXT NOT NULL DEFAULT 'high',
  cache_read_status TEXT NOT NULL DEFAULT 'explicit_zero',
  pricing_source TEXT,
  estimate_label TEXT NOT NULL,
  pricing_metadata_json TEXT NOT NULL DEFAULT '{}',
  pricing_diagnostics_json TEXT NOT NULL DEFAULT '[]',
  warnings_json TEXT NOT NULL,
  usage_identity TEXT
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
CREATE TABLE IF NOT EXISTS manual_label_assignments (
  session_id TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (session_id, label)
);
CREATE TABLE IF NOT EXISTS import_warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  imported_at TEXT NOT NULL,
  source TEXT NOT NULL,
  line INTEGER,
  code TEXT NOT NULL,
  message TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS import_checkpoints (
  source TEXT NOT NULL,
  source_file TEXT NOT NULL,
  checkpoint_line INTEGER NOT NULL DEFAULT 0,
  context_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (source, source_file)
);
`);
    changed = addColumnIfMissing(db, 'raw_records', 'source_file', 'TEXT') || changed;
    changed = addColumnIfMissing(db, 'raw_records', 'raw_fingerprint', 'TEXT') || changed;
    changed = addColumnIfMissing(db, 'usage_records', 'usage_identity', 'TEXT') || changed;
    changed = addColumnIfMissing(db, 'usage_records', 'actual_charge_nano_aiu', 'REAL') || changed;
    changed = addColumnIfMissing(db, 'usage_records', 'actual_ai_credits', 'REAL') || changed;
    changed = addColumnIfMissing(db, 'usage_records', 'actual_usd', 'REAL') || changed;
    changed = addColumnIfMissing(db, 'usage_records', 'actual_basis', 'TEXT') || changed;
    changed = addColumnIfMissing(db, 'usage_records', 'displayed_ai_credits', 'REAL') || changed;
    changed = addColumnIfMissing(db, 'usage_records', 'displayed_usd', 'REAL') || changed;
    changed = addColumnIfMissing(db, 'usage_records', 'displayed_credit_text', 'TEXT') || changed;
    changed = addColumnIfMissing(db, 'usage_records', 'displayed_credit_basis', 'TEXT') || changed;
    changed = addColumnIfMissing(db, 'usage_records', 'inferred_cache_read_tokens', 'INTEGER') || changed;
    changed = addColumnIfMissing(db, 'usage_records', 'inferred_cache_read_reason', 'TEXT') || changed;
    changed = addColumnIfMissing(db, 'usage_records', 'upper_bound_usd', 'REAL') || changed;
    changed = addColumnIfMissing(db, 'usage_records', 'upper_bound_ai_credits', 'REAL') || changed;
    changed = addColumnIfMissing(db, 'usage_records', 'selected_ai_credits', 'REAL') || changed;
    changed = addColumnIfMissing(db, 'usage_records', 'selected_usd', 'REAL') || changed;
    changed = addColumnIfMissing(db, 'usage_records', 'selected_pricing_basis', 'TEXT') || changed;
    changed = addColumnIfMissing(db, 'usage_records', 'selected_confidence', 'TEXT') || changed;
    changed = addColumnIfMissing(db, 'usage_records', 'selected_source', 'TEXT') || changed;
    changed = addColumnIfMissing(db, 'usage_records', 'pricing_basis', "TEXT NOT NULL DEFAULT 'estimated'") || changed;
    changed = addColumnIfMissing(db, 'usage_records', 'estimate_confidence', "TEXT NOT NULL DEFAULT 'high'") || changed;
    changed = addColumnIfMissing(db, 'usage_records', 'cache_read_status', "TEXT NOT NULL DEFAULT 'explicit_zero'") || changed;
    changed = addColumnIfMissing(db, 'usage_records', 'pricing_source', 'TEXT') || changed;
    changed = addColumnIfMissing(db, 'usage_records', 'pricing_metadata_json', "TEXT NOT NULL DEFAULT '{}'") || changed;
    changed = addColumnIfMissing(db, 'usage_records', 'pricing_diagnostics_json', "TEXT NOT NULL DEFAULT '[]'") || changed;
    changed = createIndexIfMissing(
      db,
      'idx_raw_records_fingerprint',
      'CREATE UNIQUE INDEX idx_raw_records_fingerprint ON raw_records (source, source_file, raw_fingerprint)',
    ) || changed;
    changed = createIndexIfMissing(
      db,
      'idx_usage_records_identity',
      'CREATE UNIQUE INDEX idx_usage_records_identity ON usage_records (usage_identity) WHERE usage_identity IS NOT NULL',
    ) || changed;
    changed = createIndexIfMissing(
      db,
      'idx_manual_label_assignments_session',
      'CREATE INDEX idx_manual_label_assignments_session ON manual_label_assignments (session_id)',
    ) || changed;
    if (changed) persistDatabase(dbPath, db);
  } finally {
    closeDatabase(db);
  }
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
  const exists = db.prepare(`
    SELECT 1
    FROM label_evidence
    WHERE label = ?
      AND source_type = ?
      AND source_field = ?
      AND COALESCE(source_value, '') = COALESCE(?, '')
      AND COALESCE(usage_record_id, 0) = COALESCE(?, 0)
      AND COALESCE(hook_event_id, 0) = COALESCE(?, 0)
      AND COALESCE(session_id, '') = COALESCE(?, '')
    LIMIT 1
  `);
  const insert = db.prepare(`
    INSERT INTO label_evidence (
      imported_at, label, source_type, source_field, source_value, confidence,
      usage_record_id, hook_event_id, session_id, repo, branch, cwd, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  try {
    for (const evidence of evidenceRows) {
      exists.bind([
        evidence.label,
        evidence.source_type,
        evidence.source_field,
        evidence.source_value || null,
        evidence.usage_record_id || null,
        evidence.hook_event_id || null,
        evidence.session_id || null,
      ]);
      const duplicate = exists.step();
      exists.reset();
      if (duplicate) continue;
      insert.run([
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
      ]);
    }
  } finally {
    exists.free();
    insert.free();
  }
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function basisRank(basis) {
  return {
    unknown_price: 0,
    included_or_zero: 1,
    upper_bound: 2,
    estimated: 3,
    displayed_credit: 4,
    actual: 5,
    conflict: 6,
  }[basis] ?? 0;
}

function mergeUsageEvidence(existing, usage) {
  const existingBasis = existing.pricing_basis || 'estimated';
  const incomingBasis = usage.pricing_basis || 'estimated';
  const strongestBasis = basisRank(incomingBasis) > basisRank(existingBasis) ? incomingBasis : existingBasis;
  const diagnostics = new Set([
    ...parseJsonArray(existing.pricing_diagnostics_json),
    ...(usage.pricing_diagnostics || []),
  ]);
  const warnings = new Set([
    ...parseJsonArray(existing.warnings_json),
    ...(usage.warnings || []),
  ]);
  return {
    estimated_usd: usage.estimated_usd ?? null,
    estimated_ai_credits: usage.estimated_ai_credits ?? null,
    actual_charge_nano_aiu: existing.actual_charge_nano_aiu ?? usage.actual_charge_nano_aiu ?? null,
    actual_ai_credits: existing.actual_ai_credits ?? usage.actual_ai_credits ?? null,
    actual_usd: existing.actual_usd ?? usage.actual_usd ?? null,
    actual_basis: existing.actual_basis ?? usage.actual_basis ?? null,
    displayed_ai_credits: existing.displayed_ai_credits ?? usage.displayed_ai_credits ?? null,
    displayed_usd: existing.displayed_usd ?? usage.displayed_usd ?? null,
    displayed_credit_text: existing.displayed_credit_text ?? usage.displayed_credit_text ?? null,
    displayed_credit_basis: existing.displayed_credit_basis ?? usage.displayed_credit_basis ?? null,
    inferred_cache_read_tokens: existing.inferred_cache_read_tokens ?? usage.inferred_cache_read_tokens ?? null,
    inferred_cache_read_reason: existing.inferred_cache_read_reason ?? usage.inferred_cache_read_reason ?? null,
    upper_bound_usd: basisRank(incomingBasis) > basisRank(existingBasis) ? usage.upper_bound_usd ?? null : existing.upper_bound_usd ?? usage.upper_bound_usd ?? null,
    upper_bound_ai_credits: basisRank(incomingBasis) > basisRank(existingBasis) ? usage.upper_bound_ai_credits ?? null : existing.upper_bound_ai_credits ?? usage.upper_bound_ai_credits ?? null,
    selected_ai_credits: basisRank(incomingBasis) > basisRank(existingBasis) ? usage.selected_ai_credits ?? null : existing.selected_ai_credits ?? usage.selected_ai_credits ?? null,
    selected_usd: basisRank(incomingBasis) > basisRank(existingBasis) ? usage.selected_usd ?? null : existing.selected_usd ?? usage.selected_usd ?? null,
    selected_pricing_basis: basisRank(incomingBasis) > basisRank(existingBasis) ? usage.selected_pricing_basis ?? incomingBasis : existing.selected_pricing_basis ?? usage.selected_pricing_basis ?? strongestBasis,
    selected_confidence: basisRank(incomingBasis) > basisRank(existingBasis) ? usage.selected_confidence || usage.estimate_confidence || 'high' : existing.selected_confidence || usage.selected_confidence || existing.estimate_confidence || 'high',
    selected_source: basisRank(incomingBasis) > basisRank(existingBasis) ? usage.selected_source ?? null : existing.selected_source ?? usage.selected_source ?? null,
    pricing_basis: strongestBasis,
    estimate_confidence: basisRank(incomingBasis) > basisRank(existingBasis)
      ? usage.estimate_confidence || existing.estimate_confidence || 'high'
      : existing.estimate_confidence || usage.estimate_confidence || 'high',
    cache_read_status: existing.cache_read_status === 'unknown' ? (usage.cache_read_status || 'unknown') : existing.cache_read_status,
    pricing_source: existing.pricing_source || usage.pricing_source || null,
    pricing_metadata: {
      ...parseJsonObject(existing.pricing_metadata_json),
      ...(usage.pricing_metadata || {}),
    },
    pricing_diagnostics: Array.from(diagnostics),
    warnings: Array.from(warnings),
  };
}

async function existingRawFingerprints(dbPath, source, sourceFile, fingerprints) {
  if (!fingerprints.length) return new Set();
  await initStore(dbPath);
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
    closeDatabase(db);
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

function importStateKey(source, sourceFile) {
  return `${source}\0${sourceFile}`;
}

async function loadImportState(dbPath) {
  await initStore(dbPath);
  const db = await openDatabase(dbPath);
  const highWater = new Map();
  const checkpoints = new Map();
  try {
    const rawResult = db.exec(`
      SELECT source, source_file, COALESCE(MAX(line), 0) AS line
      FROM raw_records
      WHERE source_file IS NOT NULL
      GROUP BY source, source_file
    `);
    if (rawResult.length) {
      const [{ columns, values }] = rawResult;
      const sourceIndex = columns.indexOf('source');
      const fileIndex = columns.indexOf('source_file');
      const lineIndex = columns.indexOf('line');
      for (const row of values) {
        highWater.set(importStateKey(row[sourceIndex], row[fileIndex]), Number(row[lineIndex] || 0));
      }
    }

    const checkpointResult = db.exec('SELECT source, source_file, checkpoint_line, context_json FROM import_checkpoints');
    if (checkpointResult.length) {
      const [{ columns, values }] = checkpointResult;
      const sourceIndex = columns.indexOf('source');
      const fileIndex = columns.indexOf('source_file');
      const lineIndex = columns.indexOf('checkpoint_line');
      const contextIndex = columns.indexOf('context_json');
      for (const row of values) {
        let context = {};
        try {
          context = JSON.parse(row[contextIndex] || '{}');
        } catch {
          context = {};
        }
        checkpoints.set(importStateKey(row[sourceIndex], row[fileIndex]), {
          checkpoint_line: Number(row[lineIndex] || 0),
          context,
        });
      }
    }
  } finally {
    closeDatabase(db);
  }
  return { highWater, checkpoints };
}

async function importCheckpoint(dbPath, source, sourceFile) {
  await initStore(dbPath);
  const rows = await queryRows(
    dbPath,
    'SELECT checkpoint_line, context_json FROM import_checkpoints WHERE source = ? AND source_file = ?',
    [source, sourceFile],
  );
  if (!rows.length) {
    return {
      checkpoint_line: await importedLineHighWater(dbPath, source, sourceFile),
      context: {},
    };
  }
  let context = {};
  try {
    context = JSON.parse(rows[0].context_json || '{}');
  } catch {
    context = {};
  }
  return {
    checkpoint_line: Number(rows[0].checkpoint_line || 0),
    context,
  };
}

async function upsertImportCheckpoint(dbPath, source, sourceFile, checkpointLine, context = {}) {
  await initStore(dbPath);
  const db = await openDatabase(dbPath);
  try {
    db.run(
      `INSERT INTO import_checkpoints (source, source_file, checkpoint_line, context_json, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(source, source_file) DO UPDATE SET
         checkpoint_line = excluded.checkpoint_line,
         context_json = excluded.context_json,
         updated_at = excluded.updated_at`,
      [source, sourceFile, checkpointLine, JSON.stringify(context || {}), new Date().toISOString()],
    );
    persistDatabase(dbPath, db);
  } finally {
    closeDatabase(db);
  }
}

async function clearImportCheckpoint(dbPath, source, sourceFile) {
  await initStore(dbPath);
  const db = await openDatabase(dbPath);
  try {
    db.run('DELETE FROM import_checkpoints WHERE source = ? AND source_file = ?', [source, sourceFile]);
    persistDatabase(dbPath, db);
  } finally {
    closeDatabase(db);
  }
}

async function insertImport(dbPath, source, sourceFile, rawRecords, usageRecords, hookEvents, warnings) {
  await initStore(dbPath);
  const db = await openDatabase(dbPath);
  const importedAt = new Date().toISOString();
  let insertedUsageRecords = 0;
  let duplicateUsageRecords = 0;

  try {
    db.run('BEGIN');
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
        actual_charge_nano_aiu, actual_ai_credits, actual_usd, actual_basis,
        displayed_ai_credits, displayed_usd, displayed_credit_text, displayed_credit_basis,
        inferred_cache_read_tokens, inferred_cache_read_reason,
        estimated_usd, estimated_ai_credits, upper_bound_usd, upper_bound_ai_credits,
        selected_ai_credits, selected_usd, selected_pricing_basis, selected_confidence, selected_source,
        pricing_basis, estimate_confidence, cache_read_status, pricing_source,
        estimate_label, pricing_metadata_json, pricing_diagnostics_json, warnings_json, usage_identity
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const existingUsageStatement = db.prepare(`
      SELECT id, session_id, repo, branch, cwd, timestamp, actual_charge_nano_aiu, actual_ai_credits,
        actual_usd, actual_basis, displayed_ai_credits, displayed_usd, displayed_credit_text,
        displayed_credit_basis, inferred_cache_read_tokens, inferred_cache_read_reason,
        upper_bound_usd, upper_bound_ai_credits, selected_ai_credits, selected_usd,
        selected_pricing_basis, selected_confidence, selected_source, pricing_basis,
        estimate_confidence, cache_read_status, pricing_source, pricing_metadata_json,
        pricing_diagnostics_json, warnings_json
      FROM usage_records
      WHERE usage_identity = ?
      LIMIT 1
    `);
    const mergeUsageStatement = db.prepare(`
      UPDATE usage_records
      SET cache_read_tokens = CASE WHEN cache_read_status = 'unknown' AND ? != 'unknown' THEN ? ELSE cache_read_tokens END,
          estimated_usd = ?,
          estimated_ai_credits = ?,
          actual_charge_nano_aiu = COALESCE(actual_charge_nano_aiu, ?),
          actual_ai_credits = COALESCE(actual_ai_credits, ?),
          actual_usd = COALESCE(actual_usd, ?),
          actual_basis = COALESCE(actual_basis, ?),
          displayed_ai_credits = COALESCE(displayed_ai_credits, ?),
          displayed_usd = COALESCE(displayed_usd, ?),
          displayed_credit_text = COALESCE(displayed_credit_text, ?),
          displayed_credit_basis = COALESCE(displayed_credit_basis, ?),
          inferred_cache_read_tokens = COALESCE(inferred_cache_read_tokens, ?),
          inferred_cache_read_reason = COALESCE(inferred_cache_read_reason, ?),
          upper_bound_usd = ?,
          upper_bound_ai_credits = ?,
          selected_ai_credits = ?,
          selected_usd = ?,
          selected_pricing_basis = ?,
          selected_confidence = ?,
          selected_source = ?,
          pricing_basis = ?,
          estimate_confidence = ?,
          cache_read_status = ?,
          pricing_source = COALESCE(pricing_source, ?),
          pricing_metadata_json = ?,
          pricing_diagnostics_json = ?,
          warnings_json = ?
      WHERE id = ?
    `);
    try {
      for (const usage of usageRecords) {
        let usageRecordId = null;
        let existingUsage = null;
        if (usage.usage_identity) {
          existingUsageStatement.bind([usage.usage_identity]);
          if (existingUsageStatement.step()) existingUsage = existingUsageStatement.getAsObject();
          existingUsageStatement.reset();
        }
        if (existingUsage) {
          usageRecordId = existingUsage.id;
          duplicateUsageRecords += 1;
          const merged = mergeUsageEvidence(existingUsage, usage);
          mergeUsageStatement.run([
            usage.cache_read_status || 'explicit_zero',
            usage.cache_read_tokens || 0,
            merged.estimated_usd,
            merged.estimated_ai_credits,
            merged.actual_charge_nano_aiu,
            merged.actual_ai_credits,
            merged.actual_usd,
            merged.actual_basis,
            merged.displayed_ai_credits,
            merged.displayed_usd,
            merged.displayed_credit_text,
            merged.displayed_credit_basis,
            merged.inferred_cache_read_tokens,
            merged.inferred_cache_read_reason,
            merged.upper_bound_usd,
            merged.upper_bound_ai_credits,
            merged.selected_ai_credits,
            merged.selected_usd,
            merged.selected_pricing_basis,
            merged.selected_confidence,
            merged.selected_source,
            merged.pricing_basis,
            merged.estimate_confidence,
            merged.cache_read_status,
            merged.pricing_source,
            JSON.stringify(merged.pricing_metadata || {}),
            JSON.stringify(merged.pricing_diagnostics || []),
            JSON.stringify(merged.warnings || []),
            usageRecordId,
          ]);
        } else {
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
            usage.actual_charge_nano_aiu,
            usage.actual_ai_credits,
            usage.actual_usd,
            usage.actual_basis,
            usage.displayed_ai_credits,
            usage.displayed_usd,
            usage.displayed_credit_text,
            usage.displayed_credit_basis,
            usage.inferred_cache_read_tokens,
            usage.inferred_cache_read_reason,
            usage.estimated_usd,
            usage.estimated_ai_credits,
            usage.upper_bound_usd,
            usage.upper_bound_ai_credits,
            usage.selected_ai_credits,
            usage.selected_usd,
            usage.selected_pricing_basis,
            usage.selected_confidence,
            usage.selected_source,
            usage.pricing_basis || 'estimated',
            usage.estimate_confidence || 'high',
            usage.cache_read_status || 'explicit_zero',
            usage.pricing_source || null,
            usage.estimate_label,
            JSON.stringify(usage.pricing_metadata || {}),
            JSON.stringify(usage.pricing_diagnostics || []),
            JSON.stringify(usage.warnings || []),
            usage.usage_identity || null,
          ]);
          usageRecordId = lastInsertId(db);
          insertedUsageRecords += 1;
        }
        for (const evidence of usage.label_evidence || []) {
          labelEvidence.push({
            ...evidence,
            usage_record_id: usageRecordId,
            session_id: usage.session_id || existingUsage?.session_id,
            repo: usage.repo || existingUsage?.repo,
            branch: usage.branch || existingUsage?.branch,
            cwd: usage.cwd || existingUsage?.cwd,
            timestamp: usage.timestamp || existingUsage?.timestamp,
          });
        }
      }
    } finally {
      usageStatement.free();
      existingUsageStatement.free();
      mergeUsageStatement.free();
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
    persistDatabase(dbPath, db);
  } catch (error) {
    rollbackDatabase(db);
    throw error;
  } finally {
    closeDatabase(db);
  }

  return {
    inserted_usage_records: insertedUsageRecords,
    duplicate_usage_records: duplicateUsageRecords,
  };
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

  try {
    db.run('BEGIN');
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
    persistDatabase(dbPath, db);
  } catch (error) {
    rollbackDatabase(db);
    throw error;
  } finally {
    usageStatement.free();
    existingStatement.free();
    insertStatement.free();
    closeDatabase(db);
  }

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
  try {
    db.run('BEGIN');
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
    persistDatabase(dbPath, db);
  } catch (error) {
    rollbackDatabase(db);
    throw error;
  } finally {
    statement.free();
    closeDatabase(db);
  }

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
        upper_bound_usd = ?,
        upper_bound_ai_credits = ?,
        displayed_ai_credits = ?,
        displayed_usd = ?,
        displayed_credit_text = ?,
        displayed_credit_basis = ?,
        inferred_cache_read_tokens = ?,
        inferred_cache_read_reason = ?,
        selected_ai_credits = ?,
        selected_usd = ?,
        selected_pricing_basis = ?,
        selected_confidence = ?,
        selected_source = ?,
        pricing_basis = ?,
        estimate_confidence = ?,
        cache_read_status = ?,
        pricing_source = ?,
        pricing_metadata_json = ?,
        pricing_diagnostics_json = ?,
        warnings_json = ?
    WHERE id = ?
  `);
  let updated = 0;
  try {
    db.run('BEGIN');
    for (const update of updates) {
      statement.run([
        update.estimated_usd,
        update.estimated_ai_credits,
        update.upper_bound_usd ?? null,
        update.upper_bound_ai_credits ?? null,
        update.displayed_ai_credits ?? null,
        update.displayed_usd ?? null,
        update.displayed_credit_text ?? null,
        update.displayed_credit_basis ?? null,
        update.inferred_cache_read_tokens ?? null,
        update.inferred_cache_read_reason ?? null,
        update.selected_ai_credits ?? null,
        update.selected_usd ?? null,
        update.selected_pricing_basis || update.pricing_basis || 'estimated',
        update.selected_confidence || update.estimate_confidence || 'high',
        update.selected_source || update.pricing_source || null,
        update.pricing_basis || 'estimated',
        update.estimate_confidence || 'high',
        update.cache_read_status || 'explicit_zero',
        update.pricing_source || null,
        JSON.stringify(update.pricing_metadata || {}),
        JSON.stringify(update.pricing_diagnostics || []),
        JSON.stringify(update.warnings || []),
        update.id,
      ]);
      updated += typeof db.getRowsModified === 'function' ? db.getRowsModified() : 0;
    }
    db.run('COMMIT');
    persistDatabase(dbPath, db);
  } catch (error) {
    rollbackDatabase(db);
    throw error;
  } finally {
    statement.free();
    closeDatabase(db);
  }

  return updated;
}

function vscodeRepairKey(row) {
  const model = String(row.resolved_model || row.requested_model || '').replace(/-\d{4}-\d{2}-\d{2}$/, '');
  if (row.span_id) return `response:${row.span_id}|model:${model}`;
  if (row.usage_identity && row.usage_identity.startsWith('span:')) {
    const span = row.usage_identity.slice(5).split('|')[0];
    if (span) return `response:${span}|model:${model}`;
  }
  const session = row.session_id || row.trace_id || '';
  const timestamp = row.timestamp || '';
  if (session || timestamp) return `session:${session}|time:${timestamp}|model:${model}`;
  return null;
}

function strongerUsageRow(left, right) {
  const leftRank = basisRank(left.pricing_basis || left.selected_pricing_basis);
  const rightRank = basisRank(right.pricing_basis || right.selected_pricing_basis);
  if (leftRank !== rightRank) return leftRank > rightRank ? left : right;
  return Number(left.id) <= Number(right.id) ? left : right;
}

async function repairDuplicateVscodeUsageRecords(dbPath) {
  await initStore(dbPath);
  const rows = await queryRows(dbPath, `
    SELECT id, source, surface, span_id, trace_id, timestamp, session_id,
      requested_model, resolved_model, actual_charge_nano_aiu, actual_ai_credits,
      actual_usd, actual_basis, displayed_ai_credits, displayed_usd,
      displayed_credit_text, displayed_credit_basis, inferred_cache_read_tokens,
      inferred_cache_read_reason, estimated_usd, estimated_ai_credits,
      upper_bound_usd, upper_bound_ai_credits, selected_ai_credits,
      selected_usd, selected_pricing_basis, selected_confidence, selected_source,
      pricing_basis, estimate_confidence, cache_read_status, pricing_source,
      pricing_metadata_json, pricing_diagnostics_json, warnings_json, usage_identity
    FROM usage_records
    WHERE source IN ('vscode', 'vscode-chat')
       OR surface = 'vscode-chat-session'
  `);
  const groups = new Map();
  for (const row of rows) {
    const key = vscodeRepairKey(row);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const duplicateGroups = Array.from(groups.values()).filter((group) => group.length > 1);
  if (!duplicateGroups.length) return 0;

  const db = await openDatabase(dbPath);
  let repaired = 0;
  try {
    db.run('BEGIN');
    for (const group of duplicateGroups) {
      const survivor = group.reduce((best, row) => strongerUsageRow(best, row));
      const duplicates = group.filter((row) => Number(row.id) !== Number(survivor.id));
      let merged = survivor;
      for (const duplicate of duplicates) {
        merged = {
          ...merged,
          ...mergeUsageEvidence(merged, {
            ...duplicate,
            pricing_metadata: parseJsonObject(duplicate.pricing_metadata_json),
            pricing_diagnostics: parseJsonArray(duplicate.pricing_diagnostics_json),
            warnings: parseJsonArray(duplicate.warnings_json),
          }),
        };
      }

      db.run(`
        UPDATE usage_records
        SET actual_charge_nano_aiu = COALESCE(actual_charge_nano_aiu, ?),
            actual_ai_credits = COALESCE(actual_ai_credits, ?),
            actual_usd = COALESCE(actual_usd, ?),
            actual_basis = COALESCE(actual_basis, ?),
            displayed_ai_credits = COALESCE(displayed_ai_credits, ?),
            displayed_usd = COALESCE(displayed_usd, ?),
            displayed_credit_text = COALESCE(displayed_credit_text, ?),
            displayed_credit_basis = COALESCE(displayed_credit_basis, ?),
            inferred_cache_read_tokens = COALESCE(inferred_cache_read_tokens, ?),
            inferred_cache_read_reason = COALESCE(inferred_cache_read_reason, ?),
            estimated_usd = COALESCE(?, estimated_usd),
            estimated_ai_credits = COALESCE(?, estimated_ai_credits),
            upper_bound_usd = COALESCE(?, upper_bound_usd),
            upper_bound_ai_credits = COALESCE(?, upper_bound_ai_credits),
            selected_ai_credits = ?,
            selected_usd = ?,
            selected_pricing_basis = ?,
            selected_confidence = ?,
            selected_source = ?,
            pricing_basis = ?,
            estimate_confidence = ?,
            cache_read_status = ?,
            pricing_source = COALESCE(pricing_source, ?),
            pricing_metadata_json = ?,
            pricing_diagnostics_json = ?,
            warnings_json = ?
        WHERE id = ?
      `, [
        merged.actual_charge_nano_aiu,
        merged.actual_ai_credits,
        merged.actual_usd,
        merged.actual_basis,
        merged.displayed_ai_credits,
        merged.displayed_usd,
        merged.displayed_credit_text,
        merged.displayed_credit_basis,
        merged.inferred_cache_read_tokens,
        merged.inferred_cache_read_reason,
        merged.estimated_usd,
        merged.estimated_ai_credits,
        merged.upper_bound_usd,
        merged.upper_bound_ai_credits,
        merged.selected_ai_credits,
        merged.selected_usd,
        merged.selected_pricing_basis || merged.pricing_basis,
        merged.selected_confidence || merged.estimate_confidence,
        merged.selected_source || merged.pricing_source,
        merged.pricing_basis,
        merged.estimate_confidence,
        merged.cache_read_status,
        merged.pricing_source,
        JSON.stringify(merged.pricing_metadata || parseJsonObject(merged.pricing_metadata_json)),
        JSON.stringify(merged.pricing_diagnostics || parseJsonArray(merged.pricing_diagnostics_json)),
        JSON.stringify(merged.warnings || parseJsonArray(merged.warnings_json)),
        survivor.id,
      ]);

      for (const duplicate of duplicates) {
        db.run('UPDATE label_evidence SET usage_record_id = ? WHERE usage_record_id = ?', [survivor.id, duplicate.id]);
        db.run('DELETE FROM usage_records WHERE id = ?', [duplicate.id]);
        repaired += 1;
      }
    }
    db.run('COMMIT');
    persistDatabase(dbPath, db);
  } catch (error) {
    rollbackDatabase(db);
    throw error;
  } finally {
    closeDatabase(db);
  }
  return repaired;
}

async function queryOne(dbPath, sql) {
  const db = await openDatabase(dbPath);
  try {
    const result = db.exec(sql);
    if (!result.length) return [];
    const [{ columns, values }] = result;
    return values.map((row) => Object.fromEntries(row.map((value, index) => [columns[index], value])));
  } finally {
    closeDatabase(db);
  }
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
    closeDatabase(db);
  }
  return rows;
}

function normalizeManualLabels(labels) {
  return Array.from(new Set((labels || []).map(canonicalLabel).filter(Boolean))).sort();
}

function manualLabelState(sessionId, labels, operation, changed) {
  return {
    session_id: sessionId,
    manual_labels: normalizeManualLabels(labels),
    operation,
    changed: Boolean(changed),
  };
}

function currentManualLabels(db, sessionId) {
  const statement = db.prepare('SELECT label FROM manual_label_assignments WHERE session_id = ? ORDER BY label');
  const labels = [];
  try {
    statement.bind([sessionId]);
    while (statement.step()) labels.push(statement.getAsObject().label);
  } finally {
    statement.free();
  }
  return labels;
}

async function sessionExists(dbPath, sessionId) {
  await initStore(dbPath);
  const rows = await queryRows(dbPath, `
SELECT 1 AS found
WHERE EXISTS (SELECT 1 FROM usage_records WHERE session_id = ?)
   OR EXISTS (SELECT 1 FROM label_evidence WHERE session_id = ?)
   OR EXISTS (SELECT 1 FROM hook_events WHERE session_id = ?)
LIMIT 1`, [sessionId, sessionId, sessionId]);
  return rows.length > 0;
}

async function listManualLabels(dbPath, sessionId) {
  await initStore(dbPath);
  const rows = await queryRows(
    dbPath,
    'SELECT label FROM manual_label_assignments WHERE session_id = ? ORDER BY label',
    [sessionId],
  );
  return manualLabelState(sessionId, rows.map((row) => row.label), 'list', false);
}

async function activeManualLabelAssignments(dbPath) {
  await initStore(dbPath);
  return queryRows(dbPath, `
SELECT session_id, label, created_at, updated_at
FROM manual_label_assignments
ORDER BY session_id, label`);
}

async function addManualLabels(dbPath, sessionId, labels) {
  await initStore(dbPath);
  const normalized = normalizeManualLabels(labels);
  const db = await openDatabase(dbPath);
  const now = new Date().toISOString();
  let changed = false;
  const statement = db.prepare(`
    INSERT OR IGNORE INTO manual_label_assignments (session_id, label, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `);
  try {
    db.run('BEGIN');
    for (const label of normalized) {
      statement.run([sessionId, label, now, now]);
      changed = (typeof db.getRowsModified === 'function' && db.getRowsModified() > 0) || changed;
    }
    const labelsAfter = currentManualLabels(db, sessionId);
    db.run('COMMIT');
    persistDatabase(dbPath, db);
    return manualLabelState(sessionId, labelsAfter, 'add', changed);
  } catch (error) {
    rollbackDatabase(db);
    throw error;
  } finally {
    statement.free();
    closeDatabase(db);
  }
}

async function removeManualLabels(dbPath, sessionId, labels) {
  await initStore(dbPath);
  const normalized = normalizeManualLabels(labels);
  const db = await openDatabase(dbPath);
  let changed = false;
  const statement = db.prepare('DELETE FROM manual_label_assignments WHERE session_id = ? AND label = ?');
  try {
    db.run('BEGIN');
    for (const label of normalized) {
      statement.run([sessionId, label]);
      changed = (typeof db.getRowsModified === 'function' && db.getRowsModified() > 0) || changed;
    }
    const labelsAfter = currentManualLabels(db, sessionId);
    db.run('COMMIT');
    persistDatabase(dbPath, db);
    return manualLabelState(sessionId, labelsAfter, 'remove', changed);
  } catch (error) {
    rollbackDatabase(db);
    throw error;
  } finally {
    statement.free();
    closeDatabase(db);
  }
}

async function setManualLabels(dbPath, sessionId, labels) {
  await initStore(dbPath);
  const normalized = normalizeManualLabels(labels);
  const db = await openDatabase(dbPath);
  const now = new Date().toISOString();
  try {
    db.run('BEGIN');
    const before = currentManualLabels(db, sessionId);
    const beforeKey = before.join('\0');
    const afterKey = normalized.join('\0');
    const changed = beforeKey !== afterKey;
    if (changed) {
      for (const label of before) {
        if (!normalized.includes(label)) {
          db.run('DELETE FROM manual_label_assignments WHERE session_id = ? AND label = ?', [sessionId, label]);
        }
      }
      for (const label of normalized) {
        db.run(`
          INSERT INTO manual_label_assignments (session_id, label, created_at, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(session_id, label) DO UPDATE SET updated_at = excluded.updated_at
        `, [sessionId, label, now, now]);
      }
    }
    const labelsAfter = currentManualLabels(db, sessionId);
    db.run('COMMIT');
    persistDatabase(dbPath, db);
    return manualLabelState(sessionId, labelsAfter, 'set', changed);
  } catch (error) {
    rollbackDatabase(db);
    throw error;
  } finally {
    closeDatabase(db);
  }
}

async function clearManualLabels(dbPath, sessionId) {
  await initStore(dbPath);
  const db = await openDatabase(dbPath);
  try {
    db.run('BEGIN');
    db.run('DELETE FROM manual_label_assignments WHERE session_id = ?', [sessionId]);
    const changed = typeof db.getRowsModified === 'function' && db.getRowsModified() > 0;
    db.run('COMMIT');
    persistDatabase(dbPath, db);
    return manualLabelState(sessionId, [], 'clear', changed);
  } catch (error) {
    rollbackDatabase(db);
    throw error;
  } finally {
    closeDatabase(db);
  }
}

module.exports = {
  attachVscodeChatLabelEvidence,
  activeManualLabelAssignments,
  addManualLabels,
  clearImportCheckpoint,
  clearManualLabels,
  existingRawFingerprints,
  importCheckpoint,
  importedLineHighWater,
  initStore,
  insertImport,
  listManualLabels,
  loadImportState,
  queryOne,
  queryRows,
  repairDuplicateVscodeUsageRecords,
  removeManualLabels,
  sessionExists,
  setManualLabels,
  upsertImportCheckpoint,
  updateUsageCostEstimates,
  updateVscodeUsageResponseIds,
  vscodeRawRecordsNeedingResponseBackfill,
};
