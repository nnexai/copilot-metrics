---
phase: 17
slug: file-backed-sqlite-storage
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-10
---

# Phase 17 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node:test` |
| **Config file** | none - tests discovered by `node --test` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test && npm run check && npm run verify:package` |
| **Estimated runtime** | ~30 seconds for normal suite; package/native smoke may take longer |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test && npm run check && npm run verify:package`
- **Before `$gsd-verify-work`:** Full suite plus native package smoke must be green
- **Max feedback latency:** 60 seconds for normal tests; native install smoke is allowed to exceed this when package installation is involved

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | PERF-01, PERF-02 | T-17-01 / T-17-02 | Prepared statements and owner-local store permissions are preserved | unit/integration | `node --test test/storage-backend.test.js` | No - W0 | pending |
| 17-01-02 | 01 | 1 | PERF-01, PERF-02 | T-17-01 / T-17-02 | Existing setup/import/label/report behavior remains equivalent | integration | `npm test` | Yes - partial existing coverage | pending |
| 17-02-01 | 02 | 2 | PERF-03 | T-17-01 | Transaction callbacks contain synchronous DB writes only | unit/static review | `node --test test/storage-backend.test.js` | No - W0 | pending |
| 17-02-02 | 02 | 2 | PERF-03 | T-17-01 | Checkpoints, warnings, duplicate repair, manual labels, and selected pricing persist atomically | integration | `npm test` | Yes - partial existing coverage | pending |
| 17-03-01 | 03 | 3 | PERF-04 | T-17-03 | Native dependency is pinned and validated in isolated install/package flows | package smoke | `npm run verify:package` plus native sqlite package smoke | No - W0 | pending |
| 17-03-02 | 03 | 3 | PERF-01, PERF-04 | T-17-03 | CLI works from packed artifact outside checkout | package smoke | packed-tarball install plus `copilot-metrics --help` and fixture import/report JSON | No - W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `test/storage-backend.test.js` - backend equivalence for schema init, existing-store opening, constraints, checkpoint persistence, manual labels, selected pricing, diagnostics, and warning rows.
- [ ] `scripts/verify-native-sqlite-package.js` - install the packed package in a temp directory, load `better-sqlite3`, run a local CLI smoke, import a fixture, label a session, and run a JSON report.
- [ ] `scripts/benchmark-storage.js` or an adapted spike benchmark - compare checkpoint/write workload before and after on copied stores.
- [ ] `scripts/verify-package.js` - keep package artifact checks blocking `*.sqlite`, `*.sqlite-wal`, and `*.sqlite-shm` files.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| External published `npx -y copilot-metrics@<release>` validation | PERF-04 | Requires a published version after release, not just local phase execution | After release, run from a neutral directory and confirm `copilot-metrics --help` and a fixture-backed report command execute without native addon errors |

---

## Validation Sign-Off

- [x] All tasks have automated verify commands or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all missing references
- [x] No watch-mode flags
- [x] Feedback latency target documented
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
