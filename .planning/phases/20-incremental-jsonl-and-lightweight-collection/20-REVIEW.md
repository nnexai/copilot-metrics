---
phase: 20-incremental-jsonl-and-lightweight-collection
reviewed: 2026-07-20T09:44:06Z
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
  critical: 2
  warning: 1
  info: 0
  total: 3
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-07-20T09:44:06Z
**Depth:** deep
**Files Reviewed:** 10
**Status:** issues_found

## Summary

The lightweight hook path, redaction reuse, append-only happy path, partial-line handling, and per-import debug cache are coherently implemented and covered. Two recovery paths can nevertheless lose observable input: in-place truncate-and-regrow can pass the resume checks and skip replacement records, and invalid UTF-8 causes the range reader to discard valid records and warnings without surfacing an error. The incremental benchmark also leaks its temporary workspace.

## Critical Issues

### CR-01: In-place truncate-and-regrow silently skips replacement records

**File:** `src/ingest.js:287-293`
**Issue:** `canResumeJsonl` accepts any same-identity file whose current size is at least the previously observed size. If a writer truncates and rewrites the same inode between imports, then grows it to the old byte offset or beyond, the byte before the old offset can still be a newline and `readJsonlRange` resumes after it. All replacement records before that offset are silently skipped. This is not hypothetical: rewriting a one-record file in place with two same-width records reproduced a database containing the old first record and the new second record, while the new first record was never imported. The current tests cover a smaller truncation and an atomic rename with a changed inode, but not truncate-and-regrow on the same inode (`test/ingest.test.js:922-970`).
**Fix:** Persist a small digest of bytes ending at the committed checkpoint (or another content continuity token) in `context.jsonl`, and validate it before resuming. On mismatch, reset to byte zero and rely on the existing fingerprint/identity deduplication. Add a fixture that overwrites the same path/inode with an equal-width first record plus an appended second record and asserts both replacements are considered.

### CR-02: Invalid UTF-8 discards valid records and produces no diagnostic

**File:** `src/jsonl.js:107-111`
**Issue:** When any newline-complete line fails fatal UTF-8 decoding, `readJsonlRange` returns a fresh `rejectedRange`, discarding every valid record and warning accumulated earlier in the same read. For a read starting at byte zero, `readIncrementalJsonl` has no further fallback (`src/ingest.js:321-335`), so ingestion returns success with zero records and zero warnings and stores a zero checkpoint. Subsequent imports repeat this indefinitely. A file containing valid JSON, one invalid-UTF-8 line, and more valid JSON therefore imports none of its valid records and gives the user no indication why. The existing test only checks a deliberately invalid resume offset into a valid multibyte character (`test/ingest.test.js:117-130`); it does not exercise malformed UTF-8 input.
**Fix:** Treat invalid UTF-8 in a newline-complete source line as a line-numbered malformed-input warning and continue through later complete lines, preserving the safe byte and line checkpoint. Reserve `resetRequired` for incompatible resume metadata/boundaries. Add an ingestion fixture with valid lines surrounding invalid UTF-8 and assert both valid records plus an absolute-line warning.

## Warnings

### WR-01: Incremental benchmark leaks its temporary stores

**File:** `scripts/benchmark-incremental-jsonl.js:86-147`
**Issue:** The benchmark creates a temporary root at line 89 but never removes it on success or failure. Repeated benchmark and release-check runs leave complete SQLite stores and synthetic JSONL histories under the system temporary directory, unlike the hook benchmark which cleans up in `finally`.
**Fix:** Wrap all work after `mkdtempSync` in `try/finally` and call `fs.rmSync(tempRoot, { recursive: true, force: true })` in the `finally` block.

---

_Reviewed: 2026-07-20T09:44:06Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
