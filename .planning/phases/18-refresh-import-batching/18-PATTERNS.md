# Phase 18: Refresh Import Batching - Pattern Map

## Files

| File | Role | Pattern |
|------|------|---------|
| `src/ingest.js` | import orchestration | Extend existing checkpoint/stat helpers and report-time auto-import loop. |
| `src/sqlite-store.js` | storage facade | Reuse `runImportMutationBatch`; avoid new storage semantics. |
| `test/report.test.js` | integration tests | Extend existing refresh/report fixture tests. |
| `test/ingest.test.js` | import tests | Add lower-level checkpoint/stat assertions if needed. |
| `scripts/benchmark-storage.js` | benchmark utility | Follow existing JSON output style if refresh benchmark is added. |

## Existing Patterns To Preserve

- `fileStatContext(file)` returns a compact persisted fingerprint.
- `vscodeChatRefreshStatContext(file)` augments chat stat context with debug sidecar size/mtime.
- `sameFileStat(left, right)` is the source of truth for stat equality.
- `sourceCheckpoint(options, source, sourceFile)` reads from preloaded import state when available.
- `runImportMutationBatch(dbPath, async () => { ... })` scopes a shared native connection around already parsed mutation work.

## Anti-Patterns

- Do not skip a file based only on checkpoint line; appended content can share the same high-water line only after parsing.
- Do not remove `--refresh` correctness behavior for changed files.
- Do not add visible timing/performance text to normal report output.
- Do not change selected-price or label-confidence report semantics.
