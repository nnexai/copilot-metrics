'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { assertRelativeTiming } = require('../scripts/benchmark-utils');

test('relative timing gate accepts bounded variation', () => {
  const result = assertRelativeTiming({
    optimizedMedianMs: 14.9,
    referenceMedianMs: 10,
    maxRatio: 1.5,
    label: 'bounded benchmark',
  });

  assert.deepEqual(result, {
    max_ratio: 1.5,
    measured_ratio: 1.49,
    passed: true,
  });
});

test('relative timing gate rejects a major slowdown', () => {
  assert.throws(() => assertRelativeTiming({
    optimizedMedianMs: 20,
    referenceMedianMs: 10,
    maxRatio: 1.5,
    label: 'injected slowdown',
  }), /injected slowdown timing regressed: 20\.000 ms > 15\.000 ms/);
});

test('relative timing gate rejects unusable measurements', () => {
  assert.throws(() => assertRelativeTiming({
    optimizedMedianMs: Number.NaN,
    referenceMedianMs: 10,
    label: 'invalid optimized sample',
  }), /finite non-negative optimized median/);
  assert.throws(() => assertRelativeTiming({
    optimizedMedianMs: 1,
    referenceMedianMs: 0,
    label: 'zero reference sample',
  }), /positive reference median/);
});
