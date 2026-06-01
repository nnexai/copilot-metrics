---
quick_id: 260601-b7v
slug: fix-0-1-7-cost-token-splitting-and-custo
status: in_progress
created: "2026-06-01T06:04:38.062Z"
---

# Quick Task: Fix 0.1.7 cost token splitting and custom extractor override behavior

## Context

GitHub Copilot pricing separates input, cached input, cache write, and output categories. Local telemetry totals can include cached read tokens in input totals and cache write tokens in output totals, so the estimator must avoid charging those tokens twice. Reasoning/thinking tokens are tracked for reporting but currently have no separate Copilot pricing column, so they remain informational and are not added as an extra priced category.

Configured custom label extractors should replace the built-in Jira extractor. The current behavior extends it.

## Plan

1. Update `src/pricing.js` to split `input_tokens` into uncached input plus cached read, and split `output_tokens` into normal output plus cache creation/write before applying category prices.
2. Update `src/label-extractors.js` so custom extractors override the built-in extractor when configured.
3. Add focused tests for token splitting, reasoning-token non-billing behavior, and custom extractor override semantics.
4. Update version/changelog/docs for `0.1.7`.
5. Run npm verification and commit the quick task atomically.
