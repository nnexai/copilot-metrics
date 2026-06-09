---
phase: 16
slug: manual-precedence-reports-and-release-readiness
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-09
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner |
| **Config file** | `package.json` scripts |
| **Quick run command** | `node --test test/label-confidence.test.js test/report.test.js` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test test/label-confidence.test.js test/report.test.js`
- **After every plan wave:** Run `npm test`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | MLAB-05, MLAB-06 | T-16-01 | Manual precedence is computed at output time without deleting automatic evidence | unit | `node --test test/label-confidence.test.js` | ✅ | ⬜ pending |
| 16-01-02 | 01 | 1 | MLAB-06, MLAB-07, MLAB-08 | T-16-02 | Reports expose manual provenance only in detail-oriented surfaces and keep overview compact | integration | `node --test test/report.test.js` | ✅ | ⬜ pending |
| 16-01-03 | 01 | 1 | MLAB-10 | T-16-03 | Replacement/removal leave no stale manual provenance in default outputs | integration | `node --test test/report.test.js` | ✅ | ⬜ pending |
| 16-01-04 | 01 | 1 | MLAB-10 | T-16-04 | Release validation proves local and published package behavior without treating empty telemetry as failure | release | `npm run check && npm test && npm run verify:package` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GitHub release workflow and npm package publication | MLAB-10 | Requires external GitHub/npm state | Watch the release workflow, verify npm version, and run neutral-directory `npx -y copilot-metrics@0.5.0 ...` |

---

## Validation Sign-Off

- [x] All tasks have automated verify commands or explicit manual release checks
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all missing references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-09
