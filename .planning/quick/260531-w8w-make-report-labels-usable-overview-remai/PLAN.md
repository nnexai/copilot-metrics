---
status: complete
quick_id: 260531-w8w
slug: make-report-labels-usable-overview-remai
---
Make report labels usable and setup genuinely one-command.

Plan:
- Keep `report labels` accumulated by label, but add default per-model breakdown to `report label <id>`.
- Rename ambiguous report wording: credits become `AI Credits est.` and status becomes `Usage status` with `usage`/`evidence-only` human values.
- Make `setup` write VS Code telemetry settings and install hooks by default while preserving `--print` for dry output.
- Make `--surface both` install both VS Code and Copilot CLI hook event names.
- Speed report auto-import by skipping previously imported session-state files and already imported JSONL lines.
- Add tests and docs for the changed behavior.
