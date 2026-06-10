# Phase 19 Patterns

## Shared Context

Build one label report context per report command:

- automatic evidence rows
- active manual assignments
- session confidence rankings
- label confidence summaries
- usage rows and manual rows used by aggregate reports

Thread that context through report functions via an optional `options.context` argument. Existing callers without a context keep the prior behavior.

## Equivalence Test

For fixture-backed reports, compare each optimized call against the independent-call path:

- `labelSummary`
- `labelModelBreakdown`
- `labelSessionDetails`
- `labelDetails`

## Benchmark

Add `npm run benchmark:reports` so report latency evidence is repeatable alongside `npm run benchmark:storage`.

