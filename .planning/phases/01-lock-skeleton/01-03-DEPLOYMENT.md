# Phase 1 Deployment Record — Mantle Sepolia

Deployed: 2026-06-08
Network: Mantle Sepolia (chain 5003)
Plan: 01-03
Requirement: REQ-15

## Contract

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
