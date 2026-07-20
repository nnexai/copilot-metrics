'use strict';

const assert = require('node:assert/strict');

const BENCHMARK_SAMPLE_COUNT = 7;
const MAX_NON_REGRESSION_RATIO = 1.5;

function assertRelativeTiming({
  optimizedMedianMs,
  referenceMedianMs,
  maxRatio = MAX_NON_REGRESSION_RATIO,
  label,
}) {
  assert.ok(Number.isFinite(optimizedMedianMs) && optimizedMedianMs >= 0,
    `${label} requires a finite non-negative optimized median`);
  assert.ok(Number.isFinite(referenceMedianMs) && referenceMedianMs > 0,
    `${label} requires a finite positive reference median`);
  assert.ok(Number.isFinite(maxRatio) && maxRatio >= 1,
    `${label} requires a finite max ratio of at least 1`);

  const measuredRatio = optimizedMedianMs / referenceMedianMs;
  assert.ok(measuredRatio <= maxRatio,
    `${label} timing regressed: ${optimizedMedianMs.toFixed(3)} ms > ${(referenceMedianMs * maxRatio).toFixed(3)} ms (${measuredRatio.toFixed(2)}x > ${maxRatio.toFixed(2)}x)`);

  return {
    max_ratio: maxRatio,
    measured_ratio: Number(measuredRatio.toFixed(2)),
    passed: true,
  };
}

module.exports = {
  BENCHMARK_SAMPLE_COUNT,
  MAX_NON_REGRESSION_RATIO,
  assertRelativeTiming,
};
