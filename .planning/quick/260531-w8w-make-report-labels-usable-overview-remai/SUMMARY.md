---
status: complete
quick_id: 260531-w8w
slug: make-report-labels-usable-overview-remai
completed_at: 2026-05-31T21:32:00Z
---
Implemented report usability and setup fixes.

Summary:
- `report labels` remains an accumulated per-label overview.
- `report label <id>` now includes a per-model breakdown by default, with detailed evidence still available via `--detail`.
- Human report columns now use `AI Credits est.` and `Usage status`; evidence-only labels no longer show the unclear `hook-only` wording in human output.
- `setup` now writes VS Code telemetry settings and installs hooks by default; `--print` keeps the old print-only behavior.
- `hooks --surface both` now includes both VS Code and Copilot CLI hook event names.
- Auto-import skips previously imported Copilot session-state files and already imported JSONL lines to make repeated reports faster.
- Existing config files are upgraded with the Copilot session-state source.

Verification:
- `npm test`
- `npm run check`
- `npm run smoke`
- `npm run verify:package`
