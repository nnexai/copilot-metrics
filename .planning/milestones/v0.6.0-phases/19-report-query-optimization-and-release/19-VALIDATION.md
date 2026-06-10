# Phase 19 Validation

## User Acceptance Checks

- `report labels` output shape remains stable.
- `report label <id>` reuses shared report context.
- `report label <id> --detail` preserves detail rows and selected pricing fields.
- `report label <id> --session-detail --top-k 2` preserves manual-label provenance and inclusion semantics.
- Benchmarks include report and write workloads.
- Release checks pass locally before publish.
- External `npx copilot-metrics@0.6.0` validation runs from a neutral directory after publish.

## Planned Commands

- `node --test --test-name-pattern='shared label report context preserves report semantics' test/report.test.js`
- `npm run benchmark:reports`
- `npm run benchmark:storage`
- `npm test`
- `npm run check`
- `npm run smoke`
- `npm run verify:package`
- `npm run verify:native-sqlite`
- `npm run check:readme-version`
- `npm pack --silent --dry-run --json`

