# Pricing Evidence From Local Logs

**Date:** 2026-06-02
**Milestone:** v0.1.9 Better pricing estimates

## Scope

The user reported one Copilot CLI session and one VS Code Insiders session for the `git-stacks` project around label `HDASPF-321`. This note records field-level evidence only; prompt and assistant content were not copied.

## Copilot CLI Session-State Evidence

Observed file:

- `~/.copilot/session-state/405b5b7b-bce4-4932-98cf-ab42ffe538de/events.jsonl`
- Modified: 2026-06-02 10:09:49 CEST
- Contains `HDASPF-321` on multiple events.

Pricing and token fields observed on `session.shutdown`:

- `data.tokenDetails.input.tokenCount`: `21625`
- `data.tokenDetails.cache_read.tokenCount`: `54144`
- `data.tokenDetails.output.tokenCount`: `1491`
- `data.modelMetrics.gpt-5-mini.usage.inputTokens`: `75769`
- `data.modelMetrics.gpt-5-mini.usage.outputTokens`: `1491`
- `data.modelMetrics.gpt-5-mini.usage.cacheReadTokens`: `54144`
- `data.modelMetrics.gpt-5-mini.usage.cacheWriteTokens`: `0`
- `data.modelMetrics.gpt-5-mini.usage.reasoningTokens`: `1152`
- `data.modelMetrics.gpt-5-mini.totalNanoAiu`: `974185000`
- `data.modelMetrics.gpt-5-mini.requests.count`: `3`
- `data.modelMetrics.gpt-5-mini.requests.cost`: `0`
- `data.totalPremiumRequests`: `0`

Interpretation:

- Numeric cache-read counts are present, so a high-confidence token-price estimate is possible.
- `totalNanoAiu` appears to be a local observed AI usage unit and should be captured separately from estimated AI Credits until its exact unit semantics are validated.
- `requests.cost` and `totalPremiumRequests` can be zero for an included or non-premium session; zero should not be treated as proof that token-level price estimates are impossible.

## VS Code Insiders Evidence

Observed current Insiders session in the `git-stacks` workspace:

- `~/.config/Code - Insiders/User/workspaceStorage/dce4bb421e965572b9221e183cedcef6/chatSessions/2dacd5bb-bc4b-45c3-ab50-81e3a944f101.jsonl`
- Modified: 2026-06-02 10:11:21 CEST
- Workspace cache key: `file:///home/nnex/dev/prj/git-stacks`
- No `HDASPF-321` string found in the chat session, transcript, or debug logs for this session.

Fields observed:

- `v.inputState.selectedModel.metadata.id`: `gpt-5-mini`
- `v.inputState.selectedModel.metadata.pricing`: `In: 25 · Out: 200 AICs/1M tokens`
- `v.inputState.selectedModel.metadata.inputCost`: `25`
- `v.inputState.selectedModel.metadata.outputCost`: `200`
- `v.inputState.selectedModel.metadata.cacheCost`: `2`
- `v.inputState.selectedModel.metadata.priceCategory`: `low`
- `v.metadata.promptTokens`: `31124`
- `v.metadata.outputTokens`: `209`
- `v.metadata.cacheKey`: present
- `v.metadata.renderedUserMessage[].cacheType`: `ephemeral`
- `v.metadata.toolCallRounds[].thinking.tokens`: present

Additional local locations inspected:

- `logs/*/window1/exthost/GitHub.copilot-chat/GitHub Copilot Chat.log`
- `logs/*/window1/exthost/GitHub.copilot-chat/GitHub Copilot Chat Hooks.log`
- `logs/*/ahp/*.jsonl`
- `logs/*/window1/output_*/agenthost.*.log`
- `Local Storage/leveldb`
- `Session Storage`
- `User/globalStorage/github.copilot-chat`
- `User/globalStorage/storage.json`
- Workspace `GitHub.copilot-chat/*.sqlite`

Additional fields and signals observed outside the chat session file:

- `copilot token sku: monthly_subscriber_quota` in Copilot Chat extension logs.
- Context utilization feedback such as `CompactionProcessor: Utilization 19.2% (24521/128000 tokens) below threshold 80%`.
- `params.action.agents[].models[]._meta.multiplierNumeric` in AHP logs for some sessions.
- `v.inputState.selectedModel.metadata.multiplierNumeric`: `0` in some older `HDASPF-321` Insiders chat sessions.
- `v.metadata.multiplierNumeric`: `0` in some older Insiders result metadata.

Matching model debug metadata:

- `billing.token_prices.batch_size`: `1000000`
- `billing.token_prices.default.input_price`: `25`
- `billing.token_prices.default.output_price`: `200`
- `billing.token_prices.default.cache_price`: `2`

Nearby Insiders sessions containing `HDASPF-321` were found on 2026-05-31:

- `eb8359d1-74d7-4c06-b1f5-47a3ecbcd7aa`
- `c593e39c-9fd1-4a3b-bad2-e16484430067`
- `d86f0592-24b3-47f9-8eb3-82a6a5939d9d`

Those sessions show prompt/output/thinking tokens and cache metadata, but no numeric `cacheReadTokens` / `cache_read_tokens` fields.

Interpretation:

- VS Code Insiders can expose session-local model pricing metadata.
- `cacheKey` and `cacheType` prove cache-related prompt handling exists, but they are not token counts and must not be converted into discounted cache-read usage.
- VS Code hook/log metadata can support `cache_present=true` and `cache_read_unknown`, but not `cache_read_tokens`.
- No VS Code session-end actual charge field was found in the inspected local files: no `totalNanoAiu`, final `aiCredits`, `creditsUsed`, cents, or per-session billed `cost`.
- `multiplierNumeric: 0`, `pricing: 0x`, and token SKU values should be preserved as plan/inclusion evidence, but they are not equivalent to a measured session debit.
- Context utilization feedback is useful for diagnostics and compaction analysis, but it is not a billable token bucket.
- Without numeric cache-read counts, the prompt-token cost can only be an upper bound if priced as fully uncached input.

Privacy note:

- Some VS Code `agenthost.*.log` files can contain auth token-looking strings. v0.1.9 fixtures and diagnostics must avoid persisting or printing those values.

## Milestone Implications

- Store actual charge evidence and estimates separately.
- Add cache availability states: `known`, `explicit_zero`, and `unknown`.
- Prefer actual local charge fields in reports when present, but preserve token-price estimates for comparison.
- Use session-local model prices before static fallback pricing when the source provides token price metadata.
- Label VS Code fallback rows with missing numeric cache-read counts as upper-bound estimates, not exact estimates.
- Add a distinct `included_or_zero` / `plan_included` basis for `0x`, `multiplierNumeric: 0`, or quota SKU evidence when no measured charge exists.
- Add a `context_usage_only` diagnostic for logs that expose context utilization but not billable token buckets.
- Treat VS Code cache metadata as evidence to explain why an upper bound may overstate cost, not as a pricing input.
