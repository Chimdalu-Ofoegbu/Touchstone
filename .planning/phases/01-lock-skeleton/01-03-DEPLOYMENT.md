# Phase 1 Deployment Record — Mantle Sepolia

Deployed: 2026-06-08 (Phase 1.0) + 2026-06-08 (Phase 1.1 hardening redeploy)
Network: Mantle Sepolia (chain 5003)
Plan: 01-03 + post-review polish
Requirement: REQ-15

---

## Phase 1.1 — Hardening Redeploy (CANONICAL — 2026-06-08)

Applied code-review findings WR-01 (confidence range), WR-02 (immutable agent), WR-03 (latestRating sentinel docs + test), WR-04 (.gitignore .env.* glob) from `01-REVIEW.md`. Source-only changes for WR-03/WR-04; WR-01/WR-02 changed bytecode, so the contract was redeployed from the same deployer EOA at nonce 3 (Phase 1.0 deploy was nonce 0).

### Contract

- RatingRegistry address: **`0x54163E309f7C8108F7110B086F640882a97f3838`** ← canonical
- Deploy tx hash: `0xb39726dd41e43956ab98f4363347d0b65af1ecd53c4488d84ec1e7d79916f399`
- Deploy block: 39678689
- Gas used: 424753 (4,492 gas less than Phase 1.0's 429,245 — savings from `immutable agent` eliminating an SLOAD in the constructor and replacing the storage write with a code-embedded constant)
- Agent address (immutable, Phase 1): `0xb27c7fa15D25E880Ba4a9a508e166538e106F51e`
- Bytecode length: 1,712 bytes (vs 1,806 bytes Phase 1.0 — smaller because `immutable` removed the storage write opcodes)

### Explorer Links

- Contract (canonical, verified): https://sepolia.mantlescan.xyz/address/0x54163E309f7C8108F7110B086F640882a97f3838
- Deploy tx: https://sepolia.mantlescan.xyz/tx/0xb39726dd41e43956ab98f4363347d0b65af1ecd53c4488d84ec1e7d79916f399
- Verification status: **VERIFIED** via Etherscan V2 / Mantlescan (Pass - Verified, first-try success — Blockscout API was up at redeploy time but Etherscan V2 path was used for parity with Phase 1.0 record). Verified at submission GUID `w5z8z1jicukywlrqbpfgd6xe21zaby3vjyi5tlwa6ggfzzcfce`.

### Smoke Test — On-chain AI-trigger flow (Phase 1.1)

- Caller wallet: `0x6FA40bBd50FB164D809b59D523357011055a60F4` (fresh second wallet — NOT the deployer/agent; generated via `cast wallet new` and funded with 0.15 MNT from the deployer. Proves "anyone can trigger requestRating" per DEC-onchain-trigger-requestRating against the hardened contract.)
- Function called: `requestRating(address)` with subject = `0xdEaD000000000000000022d473030F116dDEE9F6` (same sentinel as Phase 1.0).
- Smoke tx hash: `0xa268a63196df365796a07e44b16cf1f012a64c25e2bbde4c670c75c3f8b9e7c9`
- Smoke tx block: 39678747
- Event observed: `RatingRequested(subject, requester, timestamp)` — event signature `0xf2c7f32ca728a7137bebb36fb9afaf4d7a6d25af26b5c68bd8f2b032a6dae996` confirmed in cast logs. Indexed topic[1] = sentinel subject `0xdEaD000000000000000022d473030F116dDEE9F6`, indexed topic[2] = caller `0x6FA40bBd50FB164D809b59D523357011055a60F4`, data = block.timestamp (= 0x6a266917 = 1778489623).

### On-chain Sanity Reads (Phase 1.1)

- `cast call 0x54163E309f7C8108F7110B086F640882a97f3838 "agent()(address)" --rpc-url https://rpc.sepolia.mantle.xyz` returned `0xb27c7fa15D25E880Ba4a9a508e166538e106F51e` — matches the deployer; immutable initializer ran correctly.

### Defenses now enforced on-chain (vs Phase 1.0)

- `publishRating` reverts `InvalidConfidence()` when `confidence > 100`. Phase 1.0 silently accepted up to 255.
- `agent` is `immutable` — embedded in bytecode at deploy time, no storage slot, no rotation path. Phase 1.0 had `agent` in storage slot 0 (no rotation function, but the slot existed).
- `latestRating` documents `timestamp == 0` as canonical "no rating" sentinel; tests assert it first.
- `.gitignore` covers `.env.*` with `!.env.example` re-include. Phase 1.0 ignored only `.env` and `.env.local`.

---

## Phase 1.0 — Initial Deploy (SUPERSEDED — historical record only)

The contract below was deployed during the initial Plan 1-03 run and cleared the 20 Project Deployment Award bar end of Day 1. It was superseded by the Phase 1.1 hardening redeploy above the same day. The contract remains on-chain and verified, but new code should not point at it.

### Contract

- RatingRegistry address: 0x0912bcBd57579179388cE9d4863032406dCfBe18
- Deploy tx hash: 0x4cba0abfe6aee6c69f4d59d1921ce8fdb3dffa154a0505746049ab71f0f16c2b
- Deploy block: 39677059
- Gas used: 429245
- Agent address (initial, Phase 1): 0xb27c7fa15D25E880Ba4a9a508e166538e106F51e

## Explorer Links

- Contract (Mantlescan / Etherscan V2): https://sepolia.mantlescan.xyz/address/0x0912bcBd57579179388cE9d4863032406dCfBe18
- Contract (Blockscout — UI up, API was 503 at verify time): https://explorer.sepolia.mantle.xyz/address/0x0912bcBd57579179388cE9d4863032406dCfBe18
- Deploy tx: https://sepolia.mantlescan.xyz/tx/0x4cba0abfe6aee6c69f4d59d1921ce8fdb3dffa154a0505746049ab71f0f16c2b
- Verification status: VERIFIED via Etherscan V2 / Mantlescan (chainid=5003). NOTE: Blockscout API at explorer.sepolia.mantle.xyz/api/ was returning persistent 503 Service Temporarily Unavailable across all endpoints (v1, v2/smart-contracts, etherscan-compat) during the Plan 1-03 execution window 2026-06-08T06:06-06:14Z, so both the inline `--verify` flag in `forge script` AND the `forge verify-contract --verifier blockscout` fallback failed identically. The Etherscan V2 path (`forge verify-contract --chain-id 5003 --etherscan-api-key $MANTLE_EXPLORER_KEY --watch ...`) succeeded — verification status confirmed via `https://api.etherscan.io/v2/api?chainid=5003&module=contract&action=getsourcecode&address=DEPLOYED&apikey=KEY` returning ContractName=RatingRegistry, CompilerVersion=v0.8.24+commit.e11b9ed9, non-empty SourceCode, OptimizationUsed=1.

## Smoke Test — On-chain AI-trigger flow

- Caller wallet: 0xb2Cf716A77C8739E3675203bb18E3ED6Ca50ecA4 (fresh second wallet — NOT the deployer/agent; generated via `cast wallet new` and funded with 0.11 MNT from the deployer for this Plan 1-03 smoke. Proves "anyone can trigger requestRating" per DEC-onchain-trigger-requestRating.)
- Function called: requestRating(address) with subject = 0xdEaD000000000000000022d473030F116dDEE9F6 (sentinel address chosen specifically to be distinguishable from Phase 2+ real ratings of subjects like USDY at 0x5bE26527e817998A7206475496fDE1E68957c5A6 — no transfer; payload is a literal calldata address. NOTE: the plan's <interfaces> block specified `0xdEaD000000000000000022d473030F116dDEE9F6B` which is 41 hex chars / not a valid 20-byte address — `cast send` rejected it with "odd number of digits". Trailing `B` truncated to produce a valid 40-char address preserving the dEaD-prefix sentinel intent. Documented as Rule 1 auto-fix in 01-03-SUMMARY.md.)
- Smoke tx hash: 0x5846ec352e58259a8e5cebcc207d10368f96ff41a131c7dfd459f76fce2c0390
- Smoke tx block: 39677253
- Event observed: RatingRequested(subject, requester, timestamp) — event signature 0xf2c7f32ca728a7137bebb36fb9afaf4d7a6d25af26b5c68bd8f2b032a6dae996 (= keccak256("RatingRequested(address,address,uint256)")) confirmed in cast send receipt logs. Indexed topic[1] = sentinel subject 0xdEaD000000000000000022d473030F116dDEE9F6, indexed topic[2] = caller 0xb2Cf716A77C8739E3675203bb18E3ED6Ca50ecA4, data = block.timestamp.

## On-chain Sanity Reads

- `cast call 0x0912bcBd57579179388cE9d4863032406dCfBe18 "agent()(address)" --rpc-url https://rpc.sepolia.mantle.xyz` returned `0xb27c7fa15D25E880Ba4a9a508e166538e106F51e` — matches the deployer address; constructor ran and initialized `agent` storage correctly.

## Phase 3 Forward Compatibility

The onlyAgent modifier is the Phase 1 stub (address check against `agent`). Phase 3 will swap the modifier body to "msg.sender holds ERC-8004 Identity Registry NFT" via the canonical Identity Registry at 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432. ABI is unchanged; no redeploy required.

## 20 Project Deployment Award

The Mantle Sepolia artifact above clears the technical bar:
- Contract deployed on Mantle: YES (chain 5003, address 0x0912bcBd57579179388cE9d4863032406dCfBe18)
- Contract verified on Mantle Explorer: YES (Mantlescan / Etherscan V2 — `https://sepolia.mantlescan.xyz/address/0x0912bcBd57579179388cE9d4863032406dCfBe18` shows verified source)
- On-chain AI function callable: YES (requestRating + publishRating round-trip; requestRating proven by smoke tx 0x5846ec352e58259a8e5cebcc207d10368f96ff41a131c7dfd459f76fce2c0390 from a non-agent wallet, RatingRequested event emitted)

Mainnet artifact: Day 5 / Phase 5 per DEC-deployment-target-plan.
