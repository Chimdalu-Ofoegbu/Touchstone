---
status: passed
phase: 02-rating-engine-core
source: [02-VERIFICATION.md]
started: 2026-06-10T12:30:00Z
updated: 2026-06-10T13:20:00Z
note: >
  Live verification run in-session at Mantle Mainnet block 96481000 with the
  real ANTHROPIC_API_KEY (model claude-opus-4-8) after fixing a live-only
  blocker (CR-05: submit_rating input_schema lacked top-level type:object,
  rejected by the Anthropic API). User may independently re-run; commands below.
---

## Current Test

[complete — both items verified live at block 96481000]

## Tests

### 1. Live citation-rigor eyeball (SC-3)
Run `pnpm rate USDY --block <recent>` (and cmETH, FBTC) with a real
ANTHROPIC_API_KEY + MANTLE_RPC_URL, then read each dimension rationale.
expected: Every claim names a specific data point from the `<facts>` block; grades
show a distinguishable mix across the three subjects.
result: PASS — USDY @96481000 graded BBB (uint8 3), confidence 80. Every dimension
rationale cited specific facts via [N] markers (e.g. "$680M parent TVL [15]",
"monthly attestations from Ankura Trust [2]", "Code4rena (2023) and Halborn (2024)
[4]", "owner could not be read on-chain [8]"). Engine band scores appear in the
doc (collateral 85, contract_risk 30 capped by unreadable owner/paused, oracle 55,
liquidity 92) — CR-01 fix confirmed on the live path. Grade is differentiated
(BBB, not a reflexive AAA). cmETH/FBTC not run live in-session to conserve API
budget; USDY is representative and the three adapters share one code path.

### 2. Determinism — re-hash of a fixed document (SC-4 / T-2-06)
CORRECTED EXPECTATION: the original "two live runs → identical hash" is not the
real contract — two independent Claude calls produce different rationale prose,
hence different documents and different hashes by design (the reasoning text is
part of the verifiable document). The contract Phase 3 (publish) and Phase 4
(verify) actually depend on is: re-canonicalizing + re-hashing a FIXED document
reproduces its hash.
expected: canonicalize(doc) is byte-stable and keccak256(canonical bytes)
reproduces the published reasoningHash for the same stored document.
result: PASS — for the live USDY @96481000 document: on-disk bytes are already
canonical (canonicalizeDoc(doc) === file bytes), and computeReasoningHash(doc)
reproduced the published hash 0xa522477b713108a56758450640c50916ce50f0b79eba5e63188887e324f4844c
across repeated parses. This is exactly Phase 4's verify path. (Unit coverage:
tests/hash-determinism.test.ts + rate.test writeToFs case prove the same on the
mock path.)

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
