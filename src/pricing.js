'use strict';

const PRICING_VERSION = 'github-copilot-2026-06-01';

// USD per 1M tokens. Source: GitHub Copilot models and pricing docs, checked 2026-05-31.
const MODEL_PRICES = {
  'gpt-4.1': { input: 2.00, cacheRead: 0.50, cacheWrite: 0, output: 8.00 },
  'gpt-5 mini': { input: 0.25, cacheRead: 0.025, cacheWrite: 0, output: 2.00 },
  'gpt-5-mini': { input: 0.25, cacheRead: 0.025, cacheWrite: 0, output: 2.00 },
  'gpt-5.2': { input: 1.75, cacheRead: 0.175, cacheWrite: 0, output: 14.00 },
  'gpt-5.2-codex': { input: 1.75, cacheRead: 0.175, cacheWrite: 0, output: 14.00 },
  'gpt-5.3-codex': { input: 1.75, cacheRead: 0.175, cacheWrite: 0, output: 14.00 },
  'gpt-5.4': { input: 2.50, cacheRead: 0.25, cacheWrite: 0, output: 15.00 },
  'gpt-5.4 mini': { input: 0.75, cacheRead: 0.075, cacheWrite: 0, output: 4.50 },
  'gpt-5.4-mini': { input: 0.75, cacheRead: 0.075, cacheWrite: 0, output: 4.50 },
  'gpt-5.4 nano': { input: 0.20, cacheRead: 0.02, cacheWrite: 0, output: 1.25 },
  'gpt-5.4-nano': { input: 0.20, cacheRead: 0.02, cacheWrite: 0, output: 1.25 },
  'gpt-5.5': { input: 5.00, cacheRead: 0.50, cacheWrite: 0, output: 30.00 },
  'claude haiku 4.5': { input: 1.00, cacheRead: 0.10, cacheWrite: 1.25, output: 5.00 },
  'claude sonnet 4': { input: 3.00, cacheRead: 0.30, cacheWrite: 3.75, output: 15.00 },
  'claude sonnet 4.5': { input: 3.00, cacheRead: 0.30, cacheWrite: 3.75, output: 15.00 },
  'claude sonnet 4.6': { input: 3.00, cacheRead: 0.30, cacheWrite: 3.75, output: 15.00 },
  'claude opus 4.5': { input: 5.00, cacheRead: 0.50, cacheWrite: 6.25, output: 25.00 },
  'claude opus 4.6': { input: 5.00, cacheRead: 0.50, cacheWrite: 6.25, output: 25.00 },
  'claude opus 4.7': { input: 5.00, cacheRead: 0.50, cacheWrite: 6.25, output: 25.00 },
  'claude opus 4.8': { input: 5.00, cacheRead: 0.50, cacheWrite: 6.25, output: 25.00 },
  'gemini 2.5 pro': { input: 1.25, cacheRead: 0.125, cacheWrite: 0, output: 10.00 },
  'gemini 3 flash': { input: 0.50, cacheRead: 0.05, cacheWrite: 0, output: 3.00 },
  'gemini 3.1 pro': { input: 2.00, cacheRead: 0.20, cacheWrite: 0, output: 12.00 },
  'gemini 3.5 flash': { input: 1.50, cacheRead: 0.15, cacheWrite: 0, output: 9.00 },
  'raptor mini': { input: 0.25, cacheRead: 0.025, cacheWrite: 0, output: 2.00 },
};

function normalizeModelName(model) {
  return String(model || '').trim().toLowerCase().replace(/^copilot\//, '');
}

function modelPriceKey(model) {
  const normalized = normalizeModelName(model);
  if (MODEL_PRICES[normalized]) return normalized;
  const withoutDate = normalized.replace(/-\d{4}-\d{2}-\d{2}$/, '');
  if (MODEL_PRICES[withoutDate]) return withoutDate;
  return normalized;
}

function estimateCost(record) {
  const model = modelPriceKey(record.resolved_model || record.requested_model);
  const price = MODEL_PRICES[model];
  if (!model) {
    return { estimated_usd: null, estimated_ai_credits: null, warning: 'missing_model' };
  }
  if (!price) {
    return { estimated_usd: null, estimated_ai_credits: null, warning: `unknown_model:${model}` };
  }

  const usd = (
    (record.input_tokens / 1_000_000) * price.input
    + (record.output_tokens / 1_000_000) * price.output
    + (record.cache_read_tokens / 1_000_000) * price.cacheRead
    + (record.cache_creation_tokens / 1_000_000) * price.cacheWrite
  );

  return {
    estimated_usd: Number(usd.toFixed(8)),
    estimated_ai_credits: Number((usd / 0.01).toFixed(6)),
    warning: null,
  };
}

module.exports = {
  PRICING_VERSION,
  MODEL_PRICES,
  estimateCost,
  modelPriceKey,
};
