---
phase: 20-incremental-jsonl-and-lightweight-collection
reviewed: 2026-07-20T09:57:00Z
depth: deep
files_reviewed: 10
files_reviewed_list:
  - bin/copilot-metrics-hook.js
  - package.json
  - scripts/benchmark-hook-startup.js
  - scripts/benchmark-incremental-jsonl.js
  - src/hook-logger.js
  - src/ingest.js
  - src/jsonl.js
  - src/setup.js
  - test/ingest.test.js
  - test/setup.test.js
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: passed
---

# Phase 20: Code Review Report

**Reviewed:** 2026-07-20T10:02:00Z
**Depth:** deep
**Files Reviewed:** 10
**Status:** passed

## Summary

All original and re-review findings are resolved. Incremental checkpoints now validate bounded head and tail content digests before resuming, invalid UTF-8 is reported as a line-local malformed JSONL warning without discarding surrounding valid records, UTF-8 BOM handling matches the legacy parser, and the incremental benchmark removes its temporary workspace on success or failure. Full tests, syntax checks, semantic-equivalence benchmarks, privacy/redaction coverage, and deduplication coverage pass.

## Resolved Re-review Blockers

### RR-01: Tail-only continuity misses early rewrites in files larger than 4 KiB

**Issue:** The first review fix validated only the final 4 KiB ending at the checkpoint. A same-inode file larger than 9 KiB could therefore rewrite an early record while retaining the same size and trailing 4 KiB, causing resume at EOF and skipping the replacement record.

**Resolution:** Resolved in `3524322` after the failing regression in `3a047f6`. JSONL checkpoint version 2 stores SHA-256 samples for both the first and final 4 KiB of the committed prefix. Resume continuity reads at most 8 KiB regardless of history size; the test documents the sample positions and sizes and proves an early same-inode rewrite resets to byte zero. Rewrites confined entirely to the unsampled middle remain outside this explicitly bounded sampling contract.

### RR-02: Per-line decoding strips BOMs that the legacy parser reports as malformed

**Issue:** `TextDecoder` removes a leading UTF-8 BOM by default. Because incremental parsing decodes each JSONL row independently, BOM-prefixed rows were accepted even though the legacy whole-file parser reports them as malformed JSONL.

**Resolution:** Resolved in `3524322` after the failing regression in `3a047f6`. Incremental line decoding now uses `ignoreBOM: true`, retaining the decoded BOM for `JSON.parse`; a two-line fixture asserts record and warning parity with legacy parsing for a BOM on every line.

## Resolved Critical Issues

### CR-01: In-place truncate-and-regrow silently skips replacement records

**File:** `src/ingest.js:287-293`
**Issue:** `canResumeJsonl` accepts any same-identity file whose current size is at least the previously observed size. If a writer truncates and rewrites the same inode between imports, then grows it to the old byte offset or beyond, the byte before the old offset can still be a newline and `readJsonlRange` resumes after it. All replacement records before that offset are silently skipped. This is not hypothetical: rewriting a one-record file in place with two same-width records reproduced a database containing the old first record and the new second record, while the new first record was never imported. The current tests cover a smaller truncation and an atomic rename with a changed inode, but not truncate-and-regrow on the same inode (`test/ingest.test.js:922-970`).
**Fix:** Persist a small digest of bytes ending at the committed checkpoint (or another content continuity token) in `context.jsonl`, and validate it before resuming. On mismatch, reset to byte zero and rely on the existing fingerprint/identity deduplication. Add a fixture that overwrites the same path/inode with an equal-width first record plus an appended second record and asserts both replacements are considered.

**Resolution:** Resolved initially in `aa4f43f` and strengthened in `3524322`. Checkpoint version 2 persists SHA-256 digests of the first and final 4 KiB of the committed prefix. Resume validates both bounded samples; absent legacy tokens or mismatches safely restart at byte zero. The regressions prove equal-width and early same-inode rewrites are imported while retaining previously deduplicated rows.

### CR-02: Invalid UTF-8 discards valid records and produces no diagnostic

**File:** `src/jsonl.js:107-111`
**Issue:** When any newline-complete line fails fatal UTF-8 decoding, `readJsonlRange` returns a fresh `rejectedRange`, discarding every valid record and warning accumulated earlier in the same read. For a read starting at byte zero, `readIncrementalJsonl` has no further fallback (`src/ingest.js:321-335`), so ingestion returns success with zero records and zero warnings and stores a zero checkpoint. Subsequent imports repeat this indefinitely. A file containing valid JSON, one invalid-UTF-8 line, and more valid JSON therefore imports none of its valid records and gives the user no indication why. The existing test only checks a deliberately invalid resume offset into a valid multibyte character (`test/ingest.test.js:117-130`); it does not exercise malformed UTF-8 input.
**Fix:** Treat invalid UTF-8 in a newline-complete source line as a line-numbered malformed-input warning and continue through later complete lines, preserving the safe byte and line checkpoint. Reserve `resetRequired` for incompatible resume metadata/boundaries. Add an ingestion fixture with valid lines surrounding invalid UTF-8 and assert both valid records plus an absolute-line warning.

**Resolution:** Resolved in `aa4f43f`. Fatal decoding is scoped to the individual newline-complete row and emits `malformed_jsonl` with its absolute line and an explicit UTF-8 diagnostic. Reader and ingestion regressions added in `59b74f2` prove valid rows on both sides are imported and the warning is stored.

## Resolved Warnings

### WR-01: Incremental benchmark leaks its temporary stores

**File:** `scripts/benchmark-incremental-jsonl.js:86-147`
**Issue:** The benchmark creates a temporary root at line 89 but never removes it on success or failure. Repeated benchmark and release-check runs leave complete SQLite stores and synthetic JSONL histories under the system temporary directory, unlike the hook benchmark which cleans up in `finally`.
**Fix:** Wrap all work after `mkdtempSync` in `try/finally` and call `fs.rmSync(tempRoot, { recursive: true, force: true })` in the `finally` block.

**Resolution:** Resolved in `a926c0c`. A direct before/after temporary-directory check around the benchmark reported zero newly retained benchmark directories.

## Verification Evidence

- `npm test` — 115/115 tests passed, including bounded same-inode recovery, legacy BOM parity, invalid UTF-8, checkpoint upgrade, privacy/redaction, and deduplication fixtures.
- `npm run check` — passed.
- `npm run benchmark:ingest` — semantic equivalence true, 3,720 incremental payload bytes versus 745,730 complete bytes, 13.919x measured speedup; continuity sampling is separately bounded to at most 8 KiB.
- `npm run benchmark:hooks` — output equivalence true, 37.905 ms lightweight median versus 58.384 ms legacy median, 1.540x measured speedup.
- `git diff --check` — passed.

---

_Reviewed: 2026-07-20T09:57:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
