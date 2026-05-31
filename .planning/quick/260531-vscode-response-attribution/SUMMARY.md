---
quick_id: 260531-vscode-response-attribution
status: complete
completed: 2026-05-31
---

# Summary: VS Code Response Attribution Bugfix

Implemented VS Code response ID attribution so token-bearing OTel usage can be linked to labels found in VS Code chat session metadata. Chat session records are parsed in memory and reduced to label evidence; full chat content is not persisted.

Existing local stores are repaired by backfilling missing VS Code response IDs from raw OTel rows that were already imported before this fix.

Added generic dated-model pricing-key normalization so telemetry names such as `gpt-5-mini-2025-08-07` use the canonical pricing row when available. This keeps `AI Credits est.` useful as a what-would-this-cost estimate even while the current Copilot UI shows included or `0x` request multipliers.

Live validation:

- `node bin/copilot-metrics.js report label HDASPF-321 --json`
- Result after fix: 4 usage records, 159,072 input tokens, 4,392 output tokens, 49,280 cache-read tokens, and 4.9784 estimated AI Credits.

Release target: `copilot-metrics@0.1.5`.
