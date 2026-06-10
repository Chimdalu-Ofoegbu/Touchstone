---
status: partial
phase: 02-rating-engine-core
source: [02-VERIFICATION.md]
started: 2026-06-10T12:30:00Z
updated: 2026-06-10T12:30:00Z
---

## Current Test

[awaiting human testing — both items need a live ANTHROPIC_API_KEY + MANTLE_RPC_URL]

## Tests

### 1. Live citation-rigor eyeball
Run `pnpm rate USDY --block <recent>` (and again for cmETH, FBTC) with a real
`ANTHROPIC_API_KEY` + `MANTLE_RPC_URL`, then read each dimension rationale.
expected: Every claim names a specific data point from the `<facts>` block (a TVL
value, owner address, paused flag, reference price). Grades show a distinguishable
mix across the three subjects (not three identical AAAs). [SC-3]
result: [pending]

### 2. Live two-run determinism
Run `pnpm rate USDY --block <fixed N>` twice live and diff the `reasoningHash`.
expected: Byte-identical `reasoningHash` across both live runs at the same pinned
block (T-2-06 on the live model path, not just mock). [SC-4]
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
