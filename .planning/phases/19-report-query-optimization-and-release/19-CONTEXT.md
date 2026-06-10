# Phase 19 Context: Report Query Optimization and Release

## Phase

Phase 19: Report Query Optimization and Release

## Goal

Reduce normal report/detail latency, prove output equivalence, and ship the v0.6.0 performance milestone through the established release path.

## Requirements

- PERF-09: Reuse report evidence and label-ranking work within a single command.
- PERF-10: Preserve JSON and human report contracts for selected pricing, label inclusion modes, manual provenance, diagnostics, and estimates.
- PERF-11: Cover report equivalence with fixture tests.
- PERF-12: Keep performance evidence runnable through npm scripts.
- PERF-13: Complete local release gates.
- PERF-14: Validate the published package from outside the checkout.

## Current State

Phases 17 and 18 replaced the storage backend with file-backed SQLite and batched refresh imports. The remaining hot path is the label report path, where `report label` separately computes summary, model breakdown, session detail, and detail output. Each call currently rebuilds evidence rows, manual assignments, and confidence rankings.

## Constraints

- Do not change selected-price semantics.
- Do not change top-label default, `--top-k`, `--all-matches`, or manual-label precedence.
- Keep content capture disabled by default.
- Keep verification runnable through npm scripts.

