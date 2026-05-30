---
status: passed
phase: 02-otel-ingestion-normalization-and-cost-model
verified: 2026-05-30
must_haves_checked: 8
must_haves_passed: 8
---

# Phase 2 Verification

## Result

Phase 2 passed verification.

## Must-Haves

| # | Must-have | Result | Evidence |
|---|-----------|--------|----------|
| 1 | CLI can initialize a SQLite store in the central user-level data directory. | PASS | `store init` creates `store/copilot-metrics.sqlite`. |
| 2 | CLI can import VS Code Copilot OTel JSONL, Copilot CLI OTel JSONL, and hook JSONL records. | PASS | Fixture tests import all three sources. |
| 3 | Malformed JSONL rows are skipped and reported as warnings. | PASS | `readJsonl` test and import smoke report `malformed_jsonl`. |
| 4 | LLM/model-call spans are normalized separately from root agent/tool spans. | PASS | Root agent fixture with large tokens is skipped while child LLM span is stored. |
| 5 | Token extraction handles input, output, cache read, cache creation, and reasoning token fields when present. | PASS | `normalizePayload` fixture test checks all five token categories. |
| 6 | Known model records produce estimated USD and AI Credits using a versioned local pricing table. | PASS | `estimateCost` test verifies USD and AI Credit conversion. |
| 7 | Unknown models or missing pricing are stored with visible warnings instead of fabricated cost estimates. | PASS | Unknown model fixture emits `unknown_model` warning and null estimates. |
| 8 | Costs are labeled as estimates. | PASS | Import result and stored records use `estimate:github-copilot-2026-06-01`. |

## Commands Run

```bash
npm test
npm run check
rm -rf /tmp/copilot-metrics-phase2
node bin/copilot-metrics.js store init --home /tmp/copilot-metrics-phase2 --json
node bin/copilot-metrics.js import --source vscode --file test/fixtures/vscode-otel.jsonl --home /tmp/copilot-metrics-phase2 --json
```

All commands passed.

## Portability Check

After user feedback, the SQLite implementation was changed from a system `sqlite3` executable to the portable npm dependency `sql.js`. Verification was rerun after that change:

```bash
npm test
npm run check
rm -rf /tmp/copilot-metrics-phase2
node bin/copilot-metrics.js store init --home /tmp/copilot-metrics-phase2 --json
node bin/copilot-metrics.js import --source vscode --file test/fixtures/vscode-otel.jsonl --home /tmp/copilot-metrics-phase2 --json
```
