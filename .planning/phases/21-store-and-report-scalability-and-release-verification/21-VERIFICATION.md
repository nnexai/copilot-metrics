---
phase: 21-store-and-report-scalability-and-release-verification
verified: 2026-07-20T11:06:52Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 21: Store and Report Scalability and Release Verification Report

**Phase Goal:** Users can import large histories and run repeated reports with bounded maintenance/query overhead while receiving the same estimates, attribution, diagnostics, and output contracts from a verified release.
**Verified:** 2026-07-20T11:06:52Z
**Status:** passed
**Re-verification:** No - initial verification after code-review remediation and publication

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Opening or querying an up-to-date store does not rerun legacy cleanup or historical repair work unless a schema, data, import, or versioned repair marker requires it. | ✓ VERIFIED | `initStore` checks `user_version` before configuration and executes only pending ordered migrations; repair marker check, scan, writes, and completion share one `BEGIN IMMEDIATE` transaction. The current-store, repair gating/retry, and two-connection serialization regressions pass in the 133-test suite. |
| 2 | Large imports retain existing merge and uniqueness behavior without avoidable per-record fingerprint, identity, or last-insert-id queries. | ✓ VERIFIED | Fingerprints and usage identities are deduplicated and selected in chunks of 400; inserts use the exact `lastInsertRowid` returned by the strict insert statement and recover only confirmed `usage_identity` uniqueness conflicts. Tests process 1,200 fingerprints and 1,102 usage inputs in at most four query-family reads while proving stronger-pricing/evidence merges and constraint rollback. |
| 3 | Label, session, and VS Code backfill lookups use persistent indexes, and label reports reuse evidence/manual-assignment context while preserving equivalent human and JSON results. | ✓ VERIFIED | Schema v2 creates `idx_label_evidence_label`, `idx_usage_records_session`, `idx_raw_records_source_file_line`, and `idx_usage_records_source_raw_line_span`. Representative 5,000-row query-plan tests reject automatic/target-table scans. `createLabelReportContext` performs one evidence-plus-usage read and one raw manual join; tests prove two source reads, deep report equivalence, and secondary manual-label details. |
| 4 | Repeatable benchmarks show improved incremental refresh, hook startup, store initialization, and report performance with no selected-price, confidence, manual-label, diagnostics, privacy, or report-output drift. | ✓ VERIFIED | Fresh verifier runs passed all four semantic benchmarks: repeated current-store open 2.609 ms vs 21.674 ms legacy maintenance (8.31x; 30 vs 460 SQL operations), shared reports 7.226 ms vs 37.367 ms standalone (6.01x context-backed; 5 vs 60 source reads), incremental JSONL 4.775 ms vs 101.654 ms (21.289x; 3,720 vs 745,730 bytes), and lightweight hook startup 36.276 ms vs 53.871 ms (1.485x). Storage/report timing gates and deep equivalence were blocking and passed. |
| 5 | The full release checklist passes and the published npm package succeeds in registry checks and isolated-environment smoke verification. | ✓ VERIFIED | Fresh local checks passed: 133/133 tests, syntax, smoke, package audit, native SQLite, README version, and dry pack. GitHub release `v0.7.0` is public; release workflow run `29737102399` completed successfully at head `5adf14b796e2a4b0dcbd93718a52a43e1746cd88` with successful `build` and `publish-npm` jobs. npm reports version `0.7.0` and the expected tarball. Fresh exact-version `npx` help, paths JSON, and label-report JSON invocations outside the checkout all exited 0. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/sqlite-store.js` | Ordered migrations, repair transactions, set-based identity work, persistent indexes | ✓ VERIFIED | Substantive implementation is imported by ingestion/reports and exercised by migration, repair-race, batching, merge, rollback, and query-plan tests. |
| `src/ingest.js` | Mutation-aware repair scheduling and batched fingerprint use | ✓ VERIFIED | Import paths call the store APIs; unchanged configured-source test proves repair scans are absent. |
| `src/reports.js` | Shared label-report context and label-aware manual-row derivation | ✓ VERIFIED | All report surfaces consume the context; context and non-context output equivalence is tested across inclusion modes. |
| `test/storage-backend.test.js` | Migration, marker, race, strict insert, future schema, and index coverage | ✓ VERIFIED | All named regressions passed in the full suite. |
| `test/ingest.test.js` | Batched lookup/identity and repair-gating coverage | ✓ VERIFIED | Large-set query counts, exact insert linkage, stronger pricing, evidence, cost repair serialization, and unchanged refresh are asserted. |
| `test/report.test.js` | Deep report equivalence and two-source-read coverage | ✓ VERIFIED | Shared context and secondary manual-label detail regressions passed. |
| `scripts/benchmark-storage.js` | Migration/current-open/batch-import semantic and timing gates | ✓ VERIFIED | Fresh execution passed semantic, structural-work, and 1.5x relative non-regression gates. |
| `scripts/benchmark-reports.js` | Deep public/human/JSON equivalence and report timing gates | ✓ VERIFIED | Fresh execution produced a non-empty secondary-label detail and passed semantic, read-count, and timing gates. |
| `package.json`, `package-lock.json` | Versioned 0.7.0 package, bins, scripts, and allowlist | ✓ VERIFIED | Package and both lockfile version fields equal 0.7.0; both CLI bins and release scripts are present. |
| `README.md`, `CHANGELOG.md` | Synchronized version, performance notes, unchanged privacy/billing guidance | ✓ VERIFIED | Exact 0.7.0 examples are present; estimates remain advisory and content capture remains disabled by default. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `initStore` | SQLite `user_version` and schema migrations | Ordered `BEGIN IMMEDIATE` migrations | ✓ WIRED | Version is read before write-affecting pragmas; each migration and version advance share a transaction with rollback. |
| Repair callers | `store_metadata` repair markers | `runStoreRepairTransaction` | ✓ WIRED | Marker check, candidate scan, repair writes, and completion are serialized in one immediate transaction. |
| Import normalization | Stored raw/usage identities | Chunked preload plus exact insert result | ✓ WIRED | Batch-local map handles within-import duplicates; strict insert conflicts are narrowed to the identity uniqueness constraint. |
| Production report/backfill SQL | Persistent indexes | Exact SQL shapes plus `EXPLAIN QUERY PLAN` | ✓ WIRED | Tests name all four persistent indexes and reject automatic or targeted full scans. |
| `createLabelReportContext` | All label report surfaces | `options.context` | ✓ WIRED | Overview, summary, models, details, and session details use shared evidence/manual data; tests compare context-backed and standalone results. |
| Audited release commit | GitHub release and npm registry | Release-triggered trusted publishing | ✓ WIRED | Remote tag and workflow head both resolve to `5adf14b...`; npm registry and exact-version `npx` checks succeed. |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Produces Real Data | Status |
|----------|------|--------|--------------------|--------|
| `src/reports.js` | Label evidence, manual assignments, usage estimates | Two SQLite joins into `createLabelReportContext`, then public report functions | Yes - seeded fixture produces three labels and a non-empty secondary manual detail | ✓ FLOWING |
| `src/sqlite-store.js` | Import identities and evidence links | Chunked SQLite reads, strict inserts/merges, returned row IDs | Yes - 1,102-row regression yields 1,101 inserts, one duplicate, stronger price, and both evidence labels | ✓ FLOWING |
| npm release | Packaged runtime and native SQLite | GitHub release workflow to npm tarball | Yes - registry version/tarball and isolated commands verified | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full functional regressions | `npm test` | 133 passed, 0 failed | ✓ PASS |
| Syntax, smoke, package, native dependency, version, and dry-pack gates | `npm run check`; `npm run smoke`; `npm run verify:package`; `npm run verify:native-sqlite`; `npm run check:readme-version`; `npm pack --silent --dry-run --json` | All exited 0; 23-file package, native `better-sqlite3@12.10.0` loaded | ✓ PASS |
| Store scalability | `npm run benchmark:storage -- 1000` | All equivalence/structural/timing gates passed; 8.31x repeated-open speedup | ✓ PASS |
| Report scalability | `npm run benchmark:reports` | Deep public/human/JSON equivalence and timing gate passed; 6.01x context-backed speedup | ✓ PASS |
| Phase 20 milestone performance retained | `npm run benchmark:ingest -- 2000 10`; `npm run benchmark:hooks -- 5` | Semantic/output equivalence passed; 21.289x ingestion and 1.485x hook startup speedups | ✓ PASS |
| Published exact version outside checkout | `npx -y copilot-metrics@0.7.0 --help`; `paths --json`; `report labels --json` with isolated home | All exited 0 and emitted valid expected output shapes | ✓ PASS |

### Probe Execution

No phase-declared or conventional `probe-*.sh` files exist; all runnable verification is provided by npm tests, benchmarks, package checks, and release smoke commands above.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| STR-01 | 21-01 | ✓ SATISFIED | Ordered `user_version` migrations skip current-store probes/cleanup; current, legacy, rollback, future-version, and non-mutation tests pass. |
| STR-02 | 21-01 | ✓ SATISFIED | Durable repair markers and one-transaction repair protocol are mutation-aware, retryable, race-safe, and absent on unchanged refreshes. |
| STR-03 | 21-02 | ✓ SATISFIED | Fingerprint and usage identities are chunked; exact insert results link evidence; strict constraints, merge semantics, and query-count bounds pass. |
| REP-01 | 21-01 | ✓ SATISFIED | Named persistent label/session/raw/backfill indexes are selected in representative query plans without automatic or target-table scans. |
| REP-02 | 21-02 | ✓ SATISFIED | Shared report context uses two source reads, preserves label-aware manual rows, and is deeply equivalent across report surfaces and inclusion modes. |
| VER-02 | 21-02 | ✓ SATISFIED | Four fresh benchmarks passed blocking semantic/output assertions; storage/report benchmarks also passed structural and timing non-regression gates. |
| VER-03 | 21-03 | ✓ SATISFIED | Local release checklist, public GitHub release, successful trusted-publish workflow, npm registry visibility, and isolated exact-version commands are all confirmed. |

No Phase 21 requirements are orphaned: all seven appear in exactly one plan and are mapped to Phase 21 in `REQUIREMENTS.md`.

### Review Remediation Verification

| Finding | Status | Independent Evidence |
|---------|--------|----------------------|
| CR-01 broad `INSERT OR IGNORE` telemetry loss | ✓ CLOSED | Store uses strict `INSERT`; only `SQLITE_CONSTRAINT_UNIQUE` on `usage_records.usage_identity` is recovered. Required-field failure rollback test passes. |
| CR-02 repair scan/marker race | ✓ CLOSED | `runStoreRepairTransaction` wraps marker, scan, writes, and completion in `BEGIN IMMEDIATE`; duplicate and cost two-connection lock regressions pass. |
| WR-01 future-schema mutation | ✓ CLOSED | `initStore` opens unconfigured, checks version, then configures; DELETE journal/no-sidecar preservation test passes. |
| WR-02 secondary manual-label details missing | ✓ CLOSED | Manual dedupe key includes canonical label before usage key; top-k/all-match context and standalone assertions produce one `DEMO-902` manual detail. |
| WR-03 benchmarks could not fail on regression | ✓ CLOSED | Seven-sample medians, structural-work assertions, non-empty detail coverage, and a tested 1.5x relative timing gate now block regressions. |

### Disconfirmation Pass

- **Partially updated requirement record:** `VER-03` is still unchecked and marked Pending in `REQUIREMENTS.md`, although its runtime contract is now fulfilled by the published package evidence above. This is planning-state bookkeeping for the orchestrator to close with this verification artifact, not an implementation or release gap.
- **Potentially misleading green signal checked:** semantic benchmark equality alone would not prove a speedup. The remediated storage/report benchmarks additionally fail on deterministic work-count regression and a conservative seven-sample relative timing bound; verifier executions passed both layers.
- **External error path not unit-testable:** GitHub/npm outage or trusted-publishing rejection cannot be meaningfully simulated in the local suite. The actual release-triggered workflow, npm publication, registry response, and isolated consumer commands all succeeded, so the observable release requirement is verified rather than inferred.

### Anti-Patterns Found

No unreferenced `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, placeholder, or not-implemented markers were found in the 11 reviewed Phase 21 source, test, benchmark, package, or documentation files. No stubs, orphaned artifacts, unresolved prohibitions, or deferred human checks were found.

### Human Verification Required

None. The external publication boundary was verified directly through GitHub, npm, and isolated exact-version execution; no visual or subjective behavior is part of this phase.

### Gaps Summary

No gaps found. All roadmap truths, seven Phase 21 requirements, required artifacts, key links, behavioral regressions, review remediations, performance gates, and publication checks are verified.

---

_Verified: 2026-07-20T11:06:52Z_
_Verifier: the agent (gsd-verifier)_
