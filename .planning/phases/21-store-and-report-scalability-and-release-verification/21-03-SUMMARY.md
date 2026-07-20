---
phase: 21-store-and-report-scalability-and-release-verification
plan: "03"
subsystem: release
tags: [npm, release-candidate, packaging, benchmarks, sqlite]
requires:
  - phase: 21-01
    provides: Ordered store migrations, repair markers, and persistent query indexes
  - phase: 21-02
    provides: Set-based imports, shared report context, and semantic performance benchmarks
provides:
  - Synchronized v0.7.0 package, lockfile, README, and changelog metadata
  - Clean-install functional, package-content, native SQLite, and benchmark evidence
  - Exact audit-gated publication and registry verification handoff
affects: [phase-21-verification, milestone-audit, v0.7.0-publication]
tech-stack:
  added: []
  patterns: [clean-install release gate, exact-version external registry proof]
key-files:
  created: []
  modified: [package.json, package-lock.json, README.md, CHANGELOG.md]
key-decisions:
  - "Keep VER-03 pending until the orchestrator confirms the published npm version and isolated exact-version commands after milestone audit."
patterns-established:
  - "Release candidates must pass functional, native-package, artifact-content, and semantic benchmark gates before publication."
requirements-completed: []
coverage:
  - id: D1
    description: Package, lockfile, README, and changelog consistently describe the v0.7.0 behavior-preserving scalability release.
    requirement: VER-03
    verification:
      - kind: other
        ref: "npm run check:readme-version"
        status: pass
      - kind: other
        ref: "node package and lockfile version assertion"
        status: pass
    human_judgment: false
  - id: D2
    description: The release candidate passes clean functional, syntax, smoke, package-content, native SQLite, and semantic benchmark gates outside checkout assumptions.
    requirement: VER-03
    verification:
      - kind: integration
        ref: "npm ci && npm test"
        status: pass
      - kind: integration
        ref: "npm run check && npm run smoke && npm run verify:package && npm run verify:native-sqlite"
        status: pass
      - kind: other
        ref: "npm pack --silent --dry-run --json"
        status: pass
      - kind: other
        ref: "npm run benchmark:storage -- 1000 && npm run benchmark:reports && npm run benchmark:ingest -- 2000 10 && npm run benchmark:hooks -- 5"
        status: pass
    human_judgment: false
  - id: D3
    description: GitHub trusted publishing, npm registry visibility, and isolated exact-version npx invocation confirm the published v0.7.0 package.
    requirement: VER-03
    verification: []
    human_judgment: true
    rationale: "Publication is intentionally deferred to the parent orchestrator until phase verification and milestone audit pass."
duration: 2min
completed: 2026-07-20
status: complete
---

# Phase 21 Plan 03: v0.7.0 Release Candidate Summary

**Synchronized v0.7.0 metadata plus clean-install, native SQLite, package-content, and semantic benchmark gates produce an audit-ready release candidate without premature publication claims.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-20T10:35:09Z
- **Completed:** 2026-07-20T10:36:55Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Updated package, root lock metadata, generated README examples, and user-facing changelog to 0.7.0 while preserving pricing, attribution, output, setup, and privacy contracts.
- Passed 127 tests plus syntax, smoke, package-content, native SQLite, version-consistency, and dry-pack checks from a clean `npm ci` install.
- Passed all four semantic benchmarks and confirmed the 23-file tarball excludes planning/runtime/test/fixture/telemetry/database artifacts.
- Preserved the publication boundary: VER-03 remains pending until the audited commit is published and exact npm/npx checks pass.

## Task Commits

1. **Task 1: Synchronize v0.7.0 release metadata and user-facing changes** — `3880e70` (release metadata)
2. **Task 2: Run the complete local release and benchmark matrix** — verification-only task; no repository content changed

## Files Created/Modified

- `package.json` — Package version 0.7.0 with the existing verified scripts, bins, files allowlist, and native dependency.
- `package-lock.json` — Root package and lock metadata synchronized to 0.7.0.
- `README.md` — Generated exact-version npm examples and current-limit references synchronized to 0.7.0.
- `CHANGELOG.md` — Dated ingestion, hook, debug reuse, store, import, report, compatibility, and privacy notes.

## Decisions Made

- Kept elapsed benchmark values as machine-dependent evidence; semantic and output equivalence remained the blocking result.
- Left VER-03 unchecked because the requirement explicitly includes the published npm package and isolated registry invocation, which occur only after phase verification and milestone audit.

## Verification

- `npm ci` — installed 38 packages, audited 39 packages, 0 vulnerabilities.
- `npm test` — passed, 127/127 tests.
- `npm run check` — passed JavaScript syntax validation.
- `npm run smoke` — passed in an isolated temporary data directory.
- `npm run verify:package` — passed for `copilot-metrics@0.7.0`; 23 files, 290,400 unpacked bytes.
- `npm run verify:native-sqlite` — passed isolated package install and invocation; both bins were packaged and `better-sqlite3@12.10.0` loaded natively on Node v26.5.0.
- `npm run check:readme-version` — passed.
- `npm pack --silent --dry-run --json` — passed; 23 allowlisted files and no `.planning/`, `.codex/`, tests, fixtures, telemetry, or database files.
- `npm run benchmark:storage -- 1000` — semantic migration/repeated-maintenance/batch-import equivalence passed; 2.227 ms one-time migration, 2.650 ms current repeated open versus 21.228 ms legacy maintenance (8.01x), 47.900 ms mixed batch import.
- `npm run benchmark:reports` — deep public, human, and JSON equivalence passed; 52.061 ms standalone versus 6.632 ms repeated context-backed reports (7.85x), 1.295 ms context build.
- `npm run benchmark:ingest -- 2000 10` — semantic equivalence passed; 3,720 incremental bytes versus 745,730 complete bytes, 5.307 ms versus 99.185 ms (18.689x).
- `npm run benchmark:hooks -- 5` — output equivalence passed; 38.090 ms lightweight median versus 59.069 ms legacy median (1.551x).
- `git diff --check` — passed.

## Packed Artifact Audit

The dry-run tarball contains only the declared documentation/license, two executable bins, package manifest, two shipped helper scripts, the shipped skill, and runtime `src/` modules. It excludes GSD planning, Codex runtime, tests and fixtures, local telemetry, SQLite databases, and checkout-only artifacts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Preserved the verification and publication boundary in milestone state**

- **Found during:** Plan close-out
- **Issue:** The generic state progress updater inferred two completed phases and reset the current plan to 1 after all plan summaries existed, even though Phase 21 verification, milestone audit, and VER-03 publication proof remain pending.
- **Fix:** Restored one verified completed phase, current plan 3, and release-ready pending-verification wording while keeping six of six execution plans complete.
- **Files modified:** `.planning/STATE.md`
- **Verification:** State and roadmap now distinguish complete plan execution from incomplete Phase 21 verification and publication.
- **Committed in:** Plan metadata commit

---

**Total deviations:** 1 auto-fixed (1 blocking issue).
**Impact on plan:** Planning state preserves the plan's explicit audit and publication gate; release metadata and implementation scope are unchanged.

## Issues Encountered

- `npm ci` emitted npm's informational `allow-scripts` warning for the already-declared `better-sqlite3@12.10.0` install script. The package's isolated native verification subsequently loaded that exact dependency successfully; no package or configuration change was needed.

## User Setup Required

None - publication uses the repository's existing GitHub Actions trusted-publishing configuration.

## Orchestrator Publication Handoff

After Phase 21 verification and milestone audit pass:

1. Confirm the working tree is clean and the audited release commit is on `main`.
2. Push `main` and create GitHub release/tag `v0.7.0` at that exact commit.
3. Wait for `.github/workflows/npm-publish.yml` to succeed.
4. Confirm `npm view copilot-metrics@0.7.0 version` and `npm view copilot-metrics@0.7.0 dist.tarball`.
5. From a fresh directory outside the checkout, run `npx copilot-metrics@0.7.0 --help`, `npx copilot-metrics@0.7.0 paths --json`, and `npx copilot-metrics@0.7.0 report labels --json`.
6. Only then mark VER-03 complete. Preserve exact workflow/registry errors and do not claim release success if any check fails.

## Next Phase Readiness

- The v0.7.0 release candidate is locally complete and ready for Phase 21 verification and milestone audit.
- External publication and registry checks remain the only VER-03 prerequisites.

## Self-Check: PASSED

- All four release metadata files and this summary exist.
- Task commit `3880e70` resolves in repository history.
- Every planned local release and benchmark command passed, with exact evidence recorded above.
- No push, tag, GitHub release, or npm publication was performed by this executor.

---
*Phase: 21-store-and-report-scalability-and-release-verification*
*Completed: 2026-07-20*
