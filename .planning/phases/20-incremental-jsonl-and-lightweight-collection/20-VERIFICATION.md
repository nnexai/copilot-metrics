---
phase: 20-incremental-jsonl-and-lightweight-collection
verified: 2026-07-20T10:00:45Z
status: passed
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 20: Incremental JSONL and Lightweight Collection Verification Report

**Phase Goal:** Users can refresh growing append-only telemetry and session logs, and collect hook/debug evidence, without repeatedly paying for historical input or heavyweight startup.
**Verified:** 2026-07-20T10:00:45Z
**Status:** passed
**Re-verification:** No - initial formal verification after two code-review remediation rounds

## Goal Achievement

### Observable Truths

The five roadmap success criteria and the additional plan truths were merged into eight non-duplicative observable truths. Every runtime-dependent truth has direct behavioral coverage.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Append-only refresh parses only bytes after the last complete-line checkpoint, and an unchanged source performs no historical payload read. | VERIFIED | `src/jsonl.js:86-153` implements bounded reads from `startByte`; `src/ingest.js:330-380,1131-1163` validates and passes the checkpoint. Tests at `test/ingest.test.js:921` and `:950` assert payload read positions and zero reads for unchanged input. The independent benchmark read 3,720 appended bytes versus 745,730 bytes for a complete import. |
| 2 | Truncation, replacement/rotation, incompatible legacy state, malformed input, and partial lines recover without losing warning lines, deduplication, redaction, attribution, or explicit-refresh behavior. | VERIFIED | Version-2 offset/line/stat/identity/continuity validation is in `src/ingest.js:255-380`; complete-line parsing and UTF-8/BOM warning parity are in `src/jsonl.js:75-153`. Behavioral fixtures at `test/ingest.test.js:970-1224` cover legacy upgrade, truncate-and-regrow, early same-inode rewrite, invalid UTF-8, identity replacement, explicit refresh, complete-vs-incremental equivalence, partial retry, privacy, fingerprints, Jira evidence, and usage identity dedupe. |
| 3 | Generated Copilot and VS Code hook configurations invoke the dedicated hook executable without loading SQLite, ingestion, pricing, reports, or the general CLI. | VERIFIED | `src/setup.js:208-253` resolves repository, installed-bin, and npx-cache forms to `copilot-metrics-hook`; `bin/copilot-metrics-hook.js:5-12` imports only the hook logger. The generated-command and module-graph tests at `test/setup.test.js:397` and `:430` passed. |
| 4 | The lightweight hook path preserves event selection, quiet/JSON output, redaction, Jira extraction, private file modes, central-home resolution, and the legacy `hook-log` route without requiring a daemon. | VERIFIED | `src/hook-logger.js:32-116` is the shared redaction/append/flag runner and `package.json:13-17` exposes a second executable. Spawned equivalence tests at `test/setup.test.js:364-445` passed. An independent temp-home probe observed directory mode `0700`, file mode `0600`, `raw_prompt_stored: false`, no prompt preview, and label `DEMO-12345`; the bin is tracked executable (`100755`). |
| 5 | Each resolved VS Code debug log is parsed at most once per source import and every eligible record receives the same cache evidence. | VERIFIED | Import-local `resolvedBySession` and `debugByFile` maps in `src/ingest.js:701-729` cache positive and absent results; the production pipeline applies them before cost enrichment at `src/ingest.js:955-959`. The multi-record one-parse/persisted-evidence test at `test/ingest.test.js:714` passed. |
| 6 | Debug enrichment does not overwrite known or explicit-zero evidence and does not persist debug payload content. | VERIFIED | `src/ingest.js:721-728` returns non-unknown records unchanged. Tests at `test/ingest.test.js:714-800` assert equal evidence for eligible rows, known/explicit-zero precedence, negative-result caching, and absence of debug payload text. |
| 7 | Fixture-backed verification covers append, unchanged, truncation, replacement/rotation, malformed and partial input, legacy checkpoints, hooks, privacy, and debug reuse. | VERIFIED | The independent `npm test` run executed 115 tests with 115 passing and no skips or failures. Phase-specific named fixtures are present in `test/ingest.test.js:41-178,677-800,873-1224` and `test/setup.test.js:193-249,320-454`. |
| 8 | Repeatable npm benchmarks compare incremental ingestion and hook startup while blocking on semantic/output drift. | VERIFIED | `package.json:39-40` wires both commands. `scripts/benchmark-incremental-jsonl.js:72-156` deep-compares persisted usage, evidence, warnings, and raw counts and cleans its temp tree in `finally`; `scripts/benchmark-hook-startup.js:37-115` validates one redacted event per invocation and cross-path equivalence. Independent runs reported `semantic_equivalence: true` with 15.23x measured ingest speedup and `output_equivalent: true` with 1.498x hook speedup. |

**Score:** 8/8 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/jsonl.js` | Byte-range complete-line JSONL reader and bounded continuity evidence | VERIFIED | 212 substantive lines; exports `readJsonl` and `readJsonlContinuity`; called by ingestion. |
| `src/ingest.js` | Checkpoint reset/persistence and import-local debug cache | VERIFIED | Substantive implementation is wired into both generic and VS Code chat ingestion paths. |
| `bin/copilot-metrics-hook.js` | Dedicated hook-only executable | VERIFIED | Executable mode `100755`; directly runs `runHookLogger`. |
| `src/hook-logger.js` | Shared privacy-preserving hook runner | VERIFIED | Exports append, stream-read, flag parsing, redaction, and runner functions used by both entrypoints. |
| `src/setup.js` | Generated lightweight commands for supported install shapes | VERIFIED | `hookCommand` selects the sibling hook bin or stable npx package invocation and recognizes legacy/new managed hooks. |
| `package.json` / `package-lock.json` | Published secondary bin and benchmark commands | VERIFIED | Bin maps agree; both benchmark npm scripts exist. |
| `scripts/benchmark-incremental-jsonl.js` | Incremental-vs-complete semantic benchmark | VERIFIED | Uses production ingestion/store code, asserts deep equivalence, emits machine-readable evidence, and cleans up. |
| `scripts/benchmark-hook-startup.js` | Fresh-process hook benchmark | VERIFIED | Spawns both entrypoints, asserts redacted output equivalence, reports median/p95, and cleans up. |
| `test/ingest.test.js` | Full incremental/debug behavior matrix | VERIFIED | Relevant tests passed in the 115-test workspace run. |
| `test/setup.test.js` | Hook configuration, compatibility, privacy, and module-graph fixtures | VERIFIED | Relevant spawned-process tests passed in the workspace run. |

The GSD artifact query reported 14/14 plan artifact declarations present and substantive.

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/ingest.js` | `src/jsonl.js` | Validated `startByte` and `completedLines` passed to `readJsonl` | WIRED | `readIncrementalJsonl` at `src/ingest.js:360-380`; both generic and VS Code paths call it. The plan-query false result was only an invalid escaped regex. |
| `src/jsonl.js` | persisted checkpoint context | `nextByte`, `completedLines`, observation, and continuity returned to ingestion | WIRED | `src/jsonl.js:142-151` flows through `jsonlCheckpointContext` and `upsertImportCheckpoint` at `src/ingest.js:341-358,1224-1234`. |
| `src/setup.js` / `package.json` | `bin/copilot-metrics-hook.js` | generated sibling/npx command and npm bin map | WIRED | Generated-command execution and package-map tests pass. |
| `bin/copilot-metrics-hook.js` | `src/hook-logger.js` | direct `require('../src/hook-logger')` and `runHookLogger` call | WIRED | `bin/copilot-metrics-hook.js:5-12`; the plan-query false result was only an invalid escaped regex. |
| VS Code record normalization | debug sidecar cache | `applyVscodeDebugCachedTokens(normalizeVscodeFallbackUsage(...))` | WIRED | `src/ingest.js:955-959`; multi-record DB fixture proves the enriched values reach storage. |
| npm scripts | benchmark implementations | `benchmark:ingest` and `benchmark:hooks` | WIRED | Both commands executed successfully during this verification. |

### Data-Flow Trace (Level 4)

| Artifact | Input | Real-data flow | Status |
|----------|-------|----------------|--------|
| Incremental ingestion | Local JSONL bytes | file stat/checkpoint -> bounded reader -> normalization/redaction/attribution -> batched SQLite insert -> updated complete-line checkpoint | FLOWING |
| Hook collection | Hook JSON on stdin | stream parser -> shared redaction/label extraction -> central private JSONL append -> quiet/human/JSON response | FLOWING |
| Debug enrichment | Resolved VS Code debug JSONL | one import-local parse -> numeric cached-token aggregate -> all unknown-status usage rows -> pricing diagnostic/store | FLOWING |

### Review Remediation Verification

| Round | Finding | Fix evidence | Independent result |
|-------|---------|--------------|--------------------|
| 1 | Same-inode truncate/regrow could silently skip replacements; invalid UTF-8 could discard surrounding valid rows; benchmark leaked temp stores. | Regressions in `59b74f2`; recovery fixes in `aa4f43f`; cleanup in `a926c0c`. | All related tests passed; invalid UTF-8 imported both valid neighbors and stored its absolute-line warning; benchmark cleanup is unconditional. |
| 2 | Tail-only continuity missed early rewrites; line-local decoding stripped BOMs unlike the legacy parser. | Regressions in `3a047f6`; bounded head+tail continuity and `ignoreBOM` parity fix in `3524322`. | Early same-inode rewrite and per-line BOM parity tests passed without skip on this host. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Complete functional regression | `npm test` | 115 tests, 115 passed, 0 failed, 0 skipped | PASS |
| Source syntax | `npm run check` | CLI and every `src/*.js` file passed `node --check` | PASS |
| Incremental semantics/performance | `npm run benchmark:ingest -- 2000 10` | Equivalent 2,010-row stores; 3,720 vs 745,730 payload bytes; 15.23x measured speedup | PASS |
| Hook semantics/startup | `npm run benchmark:hooks -- 7` | Output equivalent; 36.023 ms lightweight vs 53.955 ms legacy median; 1.498x measured speedup | PASS |
| Hook privacy and permissions | isolated `appendHookEvent` temp-home probe | directory `0700`, file `0600`, prompt redacted, Jira label retained | PASS |
| Whitespace | `git diff --check` | no errors | PASS |

### Probe Execution

No phase plan declares a shell probe and no conventional `scripts/**/tests/probe-*.sh` exists. The runnable verification surface is the npm test/check/benchmark set above.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| ING-01 | 20-01 | SATISFIED | Instrumented append and unchanged fixtures plus benchmark byte counts prove proportional reads. |
| ING-02 | 20-01 | SATISFIED | Recovery matrix includes truncation, same-inode regrowth, bounded early rewrite detection, identity rotation, invalid ranges, malformed UTF-8/BOM, partial lines, legacy checkpoints, and explicit refresh. |
| ING-03 | 20-01 | SATISFIED | Complete-vs-incremental DB equality, absolute warnings, redacted Copilot session payloads, Jira evidence, fingerprints, and distinct usage identities are asserted. |
| COL-01 | 20-02 | SATISFIED | Dedicated executable, generated commands, narrow module graph, legacy compatibility, permissions, privacy, and startup comparison all pass. |
| COL-02 | 20-03 | SATISFIED | One-parse instrumentation and persisted multi-row evidence pass; known/explicit-zero evidence remains unchanged. |
| VER-01 | 20-03 | SATISFIED | Full required fixture matrix is present and the independent 115-test run passed. |

All six Phase 20 requirements appear in plan frontmatter; no mapped requirement is orphaned.

### Anti-Patterns Found

| File | Line/Area | Pattern | Severity | Impact |
|------|-----------|---------|----------|--------|
| Phase source set | all modified runtime files | No unreferenced `TBD`, `FIXME`, `XXX`, placeholder, or stub implementation was found. | None | No blocker or warning. |

### Adversarial Disconfirmation Notes

- **Scope edge:** checkpoint continuity intentionally hashes only the first and last 4 KiB of the committed prefix. A mutation confined entirely to an unsampled middle region is not detected. This does not block the phase's append-only goal and is explicitly documented in `src/jsonl.js`; identity rotation, truncation/regrowth, head rewrites, and checkpoint-tail rewrites are covered.
- **Benchmark interpretation:** semantic/output equivalence is a hard assertion, but elapsed time has no fixed pass threshold. The observed speedups are evidence from this machine, not a universal performance guarantee, as intended by the plan.
- **Unmodeled race:** there is no deterministic fixture that mutates a source concurrently between stat and bounded read. Complete-line checkpointing, continuity validation, and next-refresh recovery constrain this path, but the exact concurrent-writer race remains outside the hermetic fixture matrix.
- **Misleading-test check:** the inode-sensitive rotation/rewrite fixtures are allowed to skip on runtimes that replace the inode; they did not skip on this verification host, so both remediation paths received behavioral execution here.

### Human Verification Required

None. The phase changes local data pipelines and CLI hooks, and every observable contract is exercised by hermetic automated tests or isolated probes. No visual, external-service, or real-time interaction remains.

### Gaps Summary

No blocking or warning-level gaps were found. The phase goal is achieved, both code-review remediation rounds are behaviorally covered, and Phase 21 may proceed.

---

_Verified: 2026-07-20T10:00:45Z_
_Verifier: the agent (gsd-verifier)_
