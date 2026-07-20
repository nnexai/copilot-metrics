---
phase: 21-store-and-report-scalability-and-release-verification
reviewed: 2026-07-20T10:43:56Z
depth: deep
files_reviewed: 11
files_reviewed_list:
  - CHANGELOG.md
  - README.md
  - package.json
  - scripts/benchmark-reports.js
  - scripts/benchmark-storage.js
  - src/ingest.js
  - src/reports.js
  - src/sqlite-store.js
  - test/ingest.test.js
  - test/report.test.js
  - test/storage-backend.test.js
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
resolved_findings: 5
status: passed
---

# Phase 21: Code Review Report

**Reviewed:** 2026-07-20T10:43:56Z
**Depth:** deep
**Files Reviewed:** 11
**Status:** passed

## Summary

The Phase 21 changes improve the measured paths, and the focused tests and both new benchmarks pass. However, the import conflict optimization introduces a reproducible silent data-loss path, and the durable repair protocol has a reproducible race that can leave duplicates permanently marked as repaired. Three additional correctness/verification gaps affect future-schema safety, secondary manual-label details, and benchmark regression detection. The critical issues must be fixed before v0.7.0 is published.

## Critical Issues

### CR-01: `INSERT OR IGNORE` silently drops usage rows on non-identity constraint failures

**File:** `src/sqlite-store.js:983-996,1072-1138`
**Issue:** The batched usage insert was changed from `INSERT` to `INSERT OR IGNORE`, but the recovery branch only handles a `usage_identity` collision. SQLite applies `OR IGNORE` to every applicable constraint, including `NOT NULL`. If a normalized row is missing `estimate_label` (or violates another ignored constraint), `insertResult.changes` is zero, `usage_identity` can be null, and the code reaches `continue` without inserting a row, emitting a warning, or rolling back. A focused repro returned `{ inserted_usage_records: 0, duplicate_usage_records: 0 }` and left `usage_records` empty instead of surfacing the invalid record. This converts an actionable ingestion failure into silent telemetry loss.
**Fix:** Keep strict constraint behavior and handle only the expected unique identity conflict. Prefer a normal `INSERT` with a narrow `try/catch` that recognizes the named `idx_usage_records_identity`/`SQLITE_CONSTRAINT_UNIQUE` case and reselects that identity, rethrowing every other constraint error. Alternatively use an identity-specific `ON CONFLICT(usage_identity) ...` design compatible with the partial unique index, without a statement-wide `OR IGNORE`. Add a regression test proving required-field violations reject and roll back.

### CR-02: Repair scans and completion markers are not protected by one transaction

**File:** `src/sqlite-store.js:1495-1527,1622-1625`; `src/ingest.js:1060-1127`
**Issue:** Both repair protocols check the marker and read candidates before beginning the transaction that performs repairs and records completion. A concurrent importer can commit new relevant data and invalidate the marker after the scan but before the repair marks it complete. The stale repair then overwrites that invalidation. This was reproduced for duplicate usage by injecting a second matching VS Code row after the candidate `SELECT`: the repair returned zero, persisted `repair:duplicate_usage = 1`, a second repair performed no scan, and both duplicate rows remained. Reports can therefore permanently double-count usage until another mutation happens to invalidate the marker. Cost repair has an even wider split because `updateUsageCostEstimates` and `markStoreRepairComplete` are separate transactions.
**Fix:** Perform marker check, candidate scan, repair writes, and completion marking on the same database connection inside one `BEGIN IMMEDIATE` transaction. Concurrent imports must either commit before the protected scan or wait and invalidate the marker after the repair commits. Provide in-DB repair helpers for the active mutation connection rather than composing async helpers that independently open/check/commit. Add a two-connection regression test covering an import between scan and mark for both repair types.

## Warnings

### WR-01: Future-schema rejection mutates the database before compatibility is checked

**File:** `src/sqlite-store.js:58-64,555-564`
**Issue:** `openDatabase` executes `PRAGMA journal_mode = WAL` and `PRAGMA synchronous = FULL` before `initStore` reads and rejects a future `user_version`. A future-version database using another journal mode is therefore modified, and WAL sidecar files may be created, even though the migration contract says newer stores are rejected before mutation. The current test checks only the schema version and one sentinel row, so it cannot detect this mutation.
**Fix:** Probe `user_version` through a read-only connection before applying write-affecting pragmas, then open/configure the normal connection only when the version is supported. Extend the future-version test to start in `journal_mode=DELETE` and assert the journal mode and sidecar state remain unchanged after rejection.

### WR-02: Secondary manual labels disappear from detail output

**File:** `src/reports.js:369-370,424-478`
**Issue:** `manualLabelUsageRows` deduplicates raw manual join rows by usage semantic key without including the label. When one session has two manual labels, only the first label row survives; `labelDetails` then filters that already-deduplicated set by the requested label. A repro with `DEMO-901` and `DEMO-902` produced a valid rank-2 summary/session result for `DEMO-902` but an empty `details` array. The new report benchmark exposes this as `output_counts.details: 0` yet accepts it, so manual top-k/all-match detail behavior is not actually protected.
**Fix:** Preserve one row per `(label, usage semantic key)` for manual detail/report rows, or filter by requested label before usage deduplication. Keep aggregate-level usage deduplication separate so broader inclusion does not double-count totals. Add assertions that the second manual label has one manual detail row in top-k and all-match modes, both with and without a shared context.

### WR-03: Performance benchmarks cannot fail when the optimized path regresses

**File:** `scripts/benchmark-storage.js:65-72,90-100`; `scripts/benchmark-reports.js:65-92`
**Issue:** The benchmarks assert semantic equality but only print timing ratios. A run where current-store initialization or context-backed reports are slower than their comparison paths still exits successfully and records `equivalence: true`. Thus the release gate cannot enforce VER-02's requirement that the measured paths improve. The report benchmark also labels output equivalence successful despite its targeted secondary-label detail count being zero.
**Fix:** Use repeated warm runs and a robust statistic such as median, then assert a conservative non-regression bound that tolerates machine noise. Separately assert meaningful fixture coverage (`details > 0` for the targeted manual label) so an empty output cannot make the fast path look successful. Keep exact semantic assertions blocking and report raw samples for diagnosis.

---

_Reviewed: 2026-07-20T10:43:56Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_

## Remediation Verification

All five findings were resolved and independently exercised by focused regressions:

- **CR-01:** Usage inserts are strict again. Only a confirmed `usage_records.usage_identity` unique conflict is recovered; all other constraints throw and roll back the complete import.
- **CR-02:** Repair marker check, candidate scan, repair writes, and marker completion now share one `BEGIN IMMEDIATE` transaction. Two-connection tests prove concurrent invalidation cannot interleave for duplicate-usage or cost-estimate repairs.
- **WR-01:** Schema compatibility is read before write-affecting pragmas. A future-version store remains in DELETE journal mode without WAL/SHM sidecars or data changes.
- **WR-02:** Manual usage deduplication is label-aware, preserving the second manual label in top-k and all-match details both with and without shared report context.
- **WR-03:** Benchmarks now block on deep semantic equality, meaningful secondary-label detail coverage, deterministic SQL/query-work reductions, and a conservative 1.5x relative non-regression limit over seven warm median samples. A focused unit test proves an injected 2x slowdown fails the gate.

### Evidence

- RED regressions: `5ace842`
- Correctness fixes: `9f8e1c1`
- Structural benchmark gates: `7cfe2e6`
- Relative timing benchmark gates: this remediation commit
- `npm test`: 133/133 passed
- `npm run check`, `npm run smoke`, `npm run verify:package`: passed
- `npm run verify:native-sqlite`, `npm run check:readme-version`, and `git diff --check`: passed
- Five consecutive storage trials passed the timing gate at 0.12-0.13x of legacy maintenance; five consecutive report trials passed at 0.20-0.22x of standalone reports, always with one secondary manual-label detail row.
- The full storage and report benchmarks retain blocking semantic equality. Storage measured 30 current-store SQL operations versus 460 legacy operations; report context measured 5 total source reads versus 60 standalone reads.
- `npm pack --silent --dry-run --json`: `copilot-metrics@0.7.0`, 23 files, package contents verified.

_Remediated and verified: 2026-07-20T10:59:38Z_
