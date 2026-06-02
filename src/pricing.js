'use strict';

const PRICING_VERSION = 'github-copilot-2026-06-01';

// USD per 1M tokens. Source: GitHub Copilot models and pricing docs, checked 2026-06-01.
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

function localPrice(record) {
  const metadata = record.pricing_metadata && typeof record.pricing_metadata === 'object'
    ? record.pricing_metadata
    : {};
  if (!metadata.token_prices) return null;
  const prices = metadata.token_prices && typeof metadata.token_prices === 'object'
    ? metadata.token_prices
    : metadata;

  const input = Number(prices.input_usd_per_million ?? prices.input);
  const output = Number(prices.output_usd_per_million ?? prices.output);
  const cacheRead = Number(prices.cache_read_usd_per_million ?? prices.cacheRead ?? prices.cache_read ?? prices.cache);
  const cacheWrite = Number(prices.cache_write_usd_per_million ?? prices.cacheWrite ?? prices.cache_write ?? 0);
  if (!Number.isFinite(input) || !Number.isFinite(output)) return null;
  return {
    input,
    output,
    cacheRead: Number.isFinite(cacheRead) ? cacheRead : input,
    cacheWrite: Number.isFinite(cacheWrite) ? cacheWrite : 0,
    source: metadata.source || 'session',
  };
}

function priceForRecord(record) {
  const sessionPrice = localPrice(record);
  if (sessionPrice) return sessionPrice;
  const model = modelPriceKey(record.resolved_model || record.requested_model);
  const price = MODEL_PRICES[model];
  if (!model) return { warning: 'missing_model' };
  if (!price) return { warning: `unknown_model:${model}` };
  return { ...price, source: 'static' };
}

function cacheReadStatus(record) {
  if (record.cache_read_status) return record.cache_read_status;
  if (record.cache_read_tokens === null || record.cache_read_tokens === undefined) return 'unknown';
  return Number(record.cache_read_tokens || 0) > 0 ? 'known' : 'explicit_zero';
}

function actualCharge(record) {
  const nanoAiu = Number(record.actual_charge_nano_aiu ?? record.total_nano_aiu);
  if (Number.isFinite(nanoAiu) && nanoAiu >= 0) {
    const credits = Number((nanoAiu / 1_000_000_000).toFixed(9));
    return {
      actual_charge_nano_aiu: nanoAiu,
      actual_ai_credits: credits,
      actual_usd: Number((credits * 0.01).toFixed(8)),
      actual_basis: 'totalNanoAiu',
    };
  }
  return {
    actual_charge_nano_aiu: null,
    actual_ai_credits: null,
    actual_usd: null,
    actual_basis: null,
  };
}

function displayedCreditEvidence(record) {
  if (record.displayed_ai_credits === null || record.displayed_ai_credits === undefined || record.displayed_ai_credits === '') {
    return {
      displayed_ai_credits: null,
      displayed_usd: null,
      displayed_credit_text: record.displayed_credit_text || null,
      displayed_credit_basis: null,
    };
  }
  const credits = Number(record.displayed_ai_credits);
  if (Number.isFinite(credits) && credits >= 0) {
    return {
      displayed_ai_credits: Number(credits.toFixed(9)),
      displayed_usd: Number((credits * 0.01).toFixed(8)),
      displayed_credit_text: record.displayed_credit_text || null,
      displayed_credit_basis: record.displayed_credit_basis || 'vscode_result_details',
    };
  }
  return {
    displayed_ai_credits: null,
    displayed_usd: null,
    displayed_credit_text: record.displayed_credit_text || null,
    displayed_credit_basis: null,
  };
}

function estimateCost(record) {
  const price = priceForRecord(record);
  if (price.warning === 'missing_model') {
    return { estimated_usd: null, estimated_ai_credits: null, warning: 'missing_model' };
  }
  if (price.warning) {
    return { estimated_usd: null, estimated_ai_credits: null, warning: price.warning };
  }

  const cacheReadTokens = Number(record.cache_read_tokens || 0);
  const cacheWriteTokens = Number(record.cache_creation_tokens || 0);
  const uncachedInputTokens = Math.max(Number(record.input_tokens || 0) - cacheReadTokens, 0);
  const normalOutputTokens = Math.max(Number(record.output_tokens || 0) - cacheWriteTokens, 0);

  const usd = (
    (uncachedInputTokens / 1_000_000) * price.input
    + (normalOutputTokens / 1_000_000) * price.output
    + (cacheReadTokens / 1_000_000) * price.cacheRead
    + (cacheWriteTokens / 1_000_000) * price.cacheWrite
  );

  return {
    estimated_usd: Number(usd.toFixed(8)),
    estimated_ai_credits: Number((usd / 0.01).toFixed(6)),
    pricing_source: price.source,
    warning: null,
  };
}

function inferredCacheRead(record, displayed, estimate) {
  if (displayed.displayed_ai_credits === null || estimate.estimated_ai_credits === null) return null;
  if (cacheReadStatus(record) !== 'unknown') return null;
  const inputTokens = Number(record.input_tokens || 0);
  if (inputTokens <= 0) return null;
  const price = priceForRecord(record);
  if (price.warning) return null;
  const inputPrice = Number(price.input);
  const cacheReadPrice = Number(price.cacheRead);
  if (!Number.isFinite(inputPrice) || !Number.isFinite(cacheReadPrice) || inputPrice <= cacheReadPrice) return null;
  const deltaCredits = Number(estimate.estimated_ai_credits || 0) - Number(displayed.displayed_ai_credits || 0);
  if (deltaCredits <= 0) return null;
  const savedUsdPerToken = (inputPrice - cacheReadPrice) / 1_000_000;
  const inferredTokens = Math.round((deltaCredits * 0.01) / savedUsdPerToken);
  if (!Number.isFinite(inferredTokens) || inferredTokens <= 0) return null;
  return {
    inferred_cache_read_tokens: Math.min(inferredTokens, inputTokens),
    inferred_cache_read_reason: inferredTokens > inputTokens ? 'displayed_delta_clamped_to_input' : 'displayed_delta',
  };
}

function classifyPricing(record) {
  const estimate = estimateCost(record);
  const actual = actualCharge(record);
  const displayed = displayedCreditEvidence(record);
  const status = cacheReadStatus(record);
  const diagnostics = Array.isArray(record.pricing_diagnostics) ? [...record.pricing_diagnostics] : [];
  const warnings = [];
  if (estimate.warning) warnings.push(estimate.warning);
  if (status === 'unknown') warnings.push('cache_read_unknown_upper_bound');
  if (record.included_or_zero || displayed.displayed_ai_credits === 0) diagnostics.push('included_or_zero');

  const inferred = inferredCacheRead(record, displayed, estimate);
  if (inferred) diagnostics.push('displayed_inferred_cache_read');

  let pricingBasis = 'estimated';
  let confidence = 'high';
  let upperBoundUsd = null;
  let upperBoundCredits = null;

  if (estimate.warning) {
    pricingBasis = 'unknown_price';
    confidence = 'unknown';
  } else if (status === 'unknown') {
    pricingBasis = 'upper_bound';
    confidence = 'upper_bound';
    upperBoundUsd = estimate.estimated_usd;
    upperBoundCredits = estimate.estimated_ai_credits;
  }

  if (actual.actual_charge_nano_aiu !== null) {
    pricingBasis = 'actual';
    if (confidence === 'unknown') confidence = 'actual';
    if (estimate.estimated_ai_credits !== null) {
      const delta = Math.abs(Number(actual.actual_ai_credits || 0) - Number(estimate.estimated_ai_credits || 0));
      if (delta > Math.max(0.01, Number(estimate.estimated_ai_credits || 0) * 0.5)) {
        diagnostics.push('actual_estimate_delta');
      }
    }
  } else if (displayed.displayed_ai_credits !== null) {
    pricingBasis = displayed.displayed_ai_credits === 0 ? 'included_or_zero' : 'displayed_credit';
    confidence = displayed.displayed_ai_credits === 0 ? 'plan_included' : 'displayed';
    if (estimate.estimated_ai_credits !== null) {
      const delta = Math.abs(Number(displayed.displayed_ai_credits || 0) - Number(estimate.estimated_ai_credits || 0));
      if (delta > Math.max(0.01, Number(estimate.estimated_ai_credits || 0) * 0.5)) {
        diagnostics.push('displayed_estimate_delta');
      }
    }
  } else if (record.included_or_zero && pricingBasis === 'estimated') {
    pricingBasis = 'included_or_zero';
    confidence = 'plan_included';
  }

  return {
    ...actual,
    ...displayed,
    inferred_cache_read_tokens: inferred?.inferred_cache_read_tokens ?? null,
    inferred_cache_read_reason: inferred?.inferred_cache_read_reason ?? null,
    estimated_usd: estimate.estimated_usd,
    estimated_ai_credits: estimate.estimated_ai_credits,
    upper_bound_usd: upperBoundUsd,
    upper_bound_ai_credits: upperBoundCredits,
    pricing_basis: pricingBasis,
    estimate_confidence: confidence,
    cache_read_status: status,
    pricing_source: estimate.pricing_source || null,
    pricing_diagnostics: Array.from(new Set(diagnostics)),
    warnings,
  };
}

module.exports = {
  PRICING_VERSION,
  MODEL_PRICES,
  classifyPricing,
  estimateCost,
  modelPriceKey,
};
