'use strict';

const { readJsonl } = require('./jsonl');
const { normalizePayload, normalizeHookEvent } = require('./otel');
const { estimateCost, PRICING_VERSION } = require('./pricing');
const { insertImport } = require('./sqlite-store');
const { attachUsageLabelEvidence, attachHookLabelEvidence } = require('./labels');

function enrichCosts(records) {
  return records.map((record) => {
    const estimate = estimateCost(record);
    const warnings = [...record.warnings];
    if (estimate.warning) warnings.push(estimate.warning);
    return {
      ...record,
      estimated_usd: estimate.estimated_usd,
      estimated_ai_credits: estimate.estimated_ai_credits,
      estimate_label: `estimate:${PRICING_VERSION}`,
      warnings,
    };
  });
}

async function ingestFile(options) {
  const { dbPath, file, source } = options;
  const parsed = readJsonl(file);
  const warnings = [...parsed.warnings];
  const usageRecords = [];
  const hookEvents = [];

  for (const record of parsed.records) {
    if (source === 'hooks') {
      const event = normalizeHookEvent(record.value, source, record.line);
      if (event) hookEvents.push(event);
      continue;
    }
    usageRecords.push(...normalizePayload(record.value, source, record.line));
  }

  const enrichedUsage = attachUsageLabelEvidence(enrichCosts(usageRecords));
  const enrichedHooks = attachHookLabelEvidence(hookEvents);
  for (const usage of enrichedUsage) {
    for (const warning of usage.warnings) {
      warnings.push({
        code: warning.split(':')[0],
        line: usage.raw_line,
        message: warning,
      });
    }
  }

  await insertImport(dbPath, source, parsed.records, enrichedUsage, enrichedHooks, warnings);

  return {
    source,
    file,
    dbPath,
    raw_records: parsed.records.length,
    usage_records: enrichedUsage.length,
    hook_events: enrichedHooks.length,
    label_evidence: enrichedUsage.reduce((sum, usage) => sum + (usage.label_evidence || []).length, 0)
      + enrichedHooks.reduce((sum, event) => sum + (event.label_evidence || []).length, 0),
    warnings,
    estimate_label: `estimate:${PRICING_VERSION}`,
  };
}

module.exports = {
  ingestFile,
};
