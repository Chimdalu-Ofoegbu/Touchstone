---
phase: 1
slug: lock-skeleton
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-07
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Phase 1 ships the verified `RatingRegistry.sol` skeleton on Mantle Sepolia.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Foundry (forge test) |
| **Config file** | `foundry.toml` (Wave 0 creates) |
| **Quick run command** | `forge test --match-contract RatingRegistryTest -q` |
| **Full suite command** | `forge test` |
| **Estimated runtime** | ~5 seconds (Foundry is fast; skeleton has minimal surface area) |

---

## Sampling Rate

- **After every task commit:** Run `forge test --match-contract RatingRegistryTest -q`
- **After every plan wave:** Run `forge test`
- **Before `/gsd-verify-work`:** Full suite must be green AND the verified contract must resolve on Mantlescan Sepolia
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | REQ-15 | — | Project compiles with Foundry | smoke | `forge build` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 0 | REQ-15 | — | Test scaffolding in place | smoke | `test -f test/RatingRegistry.t.sol` | ❌ W0 | ⬜ pending |
| 1-02-02-a | 02 | 1 | REQ-02 | T-1-01 | onlyAgent gate rejects non-agent callers | unit | `forge test --match-test test_publishRating_rejectsNonAgent` | ❌ W0 | ⬜ pending |
| 1-02-02-b | 02 | 1 | REQ-02 | — | Grade enum 0-9 maps AAA-D, reverts above 9 | unit | `forge test --match-test test_publishRating_gradeRange` | ❌ W0 | ⬜ pending |
| 1-02-02-c | 02 | 1 | REQ-02 | — | requestRating emits RatingRequested for any caller | unit | `forge test --match-test test_requestRating_emitsEvent` | ❌ W0 | ⬜ pending |
| 1-02-02-d | 02 | 1 | REQ-02 | — | latestRating returns last published rating | unit | `forge test --match-test test_latestRating_returnsLast` | ❌ W0 | ⬜ pending |
| 1-02-02-e | 02 | 1 | REQ-02 | — | ratingHistory returns full timeline | unit | `forge test --match-test test_ratingHistory_returnsAll` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 2 | REQ-15 | — | Contract deployed and verified on Mantle Sepolia | integration | `cast call $RATING_REGISTRY "agent()(address)" --rpc-url https://rpc.sepolia.mantle.xyz` | ❌ W0 | ⬜ pending |
| 1-03-02 | 03 | 2 | REQ-15 | — | Blockscout verification succeeded | manual | (open Sepolia Mantlescan, check "Contract" tab shows verified source) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `foundry.toml` — Foundry config with src/test/lib paths, mantle-sepolia + mantle-mainnet RPC aliases, solc 0.8.24+
- [ ] `lib/forge-std/` — forge-std installed via `forge install foundry-rs/forge-std --no-commit`
- [ ] `src/RatingRegistry.sol` — skeleton contract scaffolded (real implementation in Wave 1)
- [ ] `src/constants/GradeEnum.sol` — shared grade encoding (uint8 0-9 → AAA-D) per DEC-grade-encoding-uint8
- [ ] `test/RatingRegistry.t.sol` — test file scaffolded with at least the 5 unit tests above
- [ ] `.env.example` — placeholder env vars (PRIVATE_KEY, MANTLE_SEPOLIA_RPC_URL) for deployer
- [ ] `script/Deploy.s.sol` — Forge deploy script
- [ ] `.gitignore` — exclude .env, broadcast/, cache/, out/

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Blockscout shows verified source for deployed contract | REQ-15 | Verification status is a UI artifact, not on-chain state | Open `https://explorer.sepolia.mantle.xyz/address/{DEPLOYED_ADDRESS}`, click "Contract" tab, confirm green checkmark + source code visible |
| Constructor agent address argument was passed correctly | REQ-15 | Set-once-and-forget; verified by manual cast call after deploy | `cast call $RATING_REGISTRY "agent()(address)" --rpc-url <sepolia-rpc>` returns expected deployer or designated agent address |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (all unit tests covered)
- [ ] Wave 0 covers all MISSING references (foundry.toml, forge-std, scaffolds)
- [ ] No watch-mode flags (`forge test` is one-shot)
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter after planner validates the map

**Approval:** pending (will be approved once gsd-planner generates 1-01-PLAN.md through 1-03-PLAN.md and gsd-plan-checker verifies they map to this validation table)
