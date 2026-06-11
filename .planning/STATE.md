---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Executing Phase 03
last_updated: "2026-06-10T19:48:52.366Z"
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 14
  completed_plans: 12
  percent: 86
---

# STATE.md — Touchstone

> Project memory. Updated by orchestrators after each phase/plan transition.

## Project Reference

- **Project:** Touchstone
- **Core value:** Credit-ratings agent for on-chain RWA assets on Mantle. Ingests risk data, scores deterministic dimensions, uses Claude to synthesize a letter grade (AAA–D) with cited rationale, publishes on-chain under an ERC-8004 identity with a verifiable reasoning hash. Moody's of the agentic economy.
- **Current focus:** Phase 03 — onchain-publish-erc8004
- **Ship target:** 2026-06-12 (user). Buffer: 2026-06-13. Official deadline: 2026-06-15.
- **Today:** 2026-06-10 (Day 4 of the 5-day user target; Phases 1+2 complete).

## Current Position

Phase: 03 (onchain-publish-erc8004) — EXECUTING
Plan: 4 of 6 complete (03-01, 03-02, 03-05, 03-03 done; 03-04 + 03-06 remain)

**2026-06-11 — Plan 03-03 COMPLETE (LIVE Mainnet).** ERC-8004 Identity NFT **agentId 114** held by the agent EOA (`ownerOf(114)==0xb27c7fa1…F51e`, verified). Canonical `RatingRegistry` deployed ONCE (D-01) to Mantle Mainnet at **`0xF16d03965E1870Fc3235198468C56dEC65E5606D`** (tx `0xd99ced…34af3`, block 96506775), **verified on Mantlescan**. Live gate PROVEN: `publishRating` reverts `NotAgent()` (`0x0d9ab13f`) from a non-agent, passes from the agent EOA. Agent-card CID `bafkreifu6wo7sseskorodory3lgsjhgpktimadantvbfkhvy7p4o5rh44u`. ABI reconciled byte-equivalent (12/12) + frozen (D-02). Tests: agent 201 pass/1 skip + typecheck clean; forge 8/8. **Next: Plan 03-04** (`publishRatingFor` rate→pin→publishRating pipeline) — iterate against an `anvil --fork`, NO further live redeploy.

---
_Phase-02 closing history (retained for provenance):_
Code review (02-REVIEW.md) found 4 blockers on the cross-phase hash/provenance contract; verifier independently REPRODUCED all 4; ALL 4 FIXED inline this session (each an atomic root-cause-named commit) and re-verified CLOSED against live code:

  - CR-01 (SC-2) FIXED commit df2e254: synthesize.ts now rebuilds dimensions[] from engine BandResults (score/band_hit/missing_facts) in canonical key order; only rationale+citations are Claude's. Proven by [2-04-02e] divergent-score test.
  - CR-02 (SC-4) FIXED commit 25c789d: rpc.ts resolveBlockNumber() + 3 adapters thread one concrete resolved block into multiread AND ingestBlock (no more `:0` while reading latest). 3 adapter tests assert resolved head stamped.
  - CR-04 (SC-4) FIXED commit 27692f8: rate.ts getBlockTimestampSeconds(blockNumber: bigint) reads getBlock({blockNumber}) at BigInt(facts.ingestBlock) — no 2nd latest snapshot.
  - CR-03 (security) FIXED commit d334286: redactRpcError wired into multicall.ts/rate.ts/rpc.ts + redactRpcUrl at cli.ts boundary; wiring tripwire test enforces it.

LIVE UAT: PASSED in-session at Mantle Mainnet block 96481000 (model claude-opus-4-8) — 02-HUMAN-UAT.md status:passed.

  - A 5th blocker surfaced ONLY on the live path and was fixed: CR-05 (commit 7cdff79) — submit_rating input_schema was built by zod-to-json-schema v3 (incompatible with zod v4), emitting {$ref,definitions} with no top-level type → Anthropic 400 "input_schema.type: Field required". Fixed via zod v4 native z.toJSONSchema(); removed non-standard `strict` field; strengthened tool-schema test. Mock suite couldn't catch it (mock client doesn't validate schema like the real API).
  - SC-3 (citation rigor) PASS: USDY @96481000 → BBB, confidence 80, every rationale cites specific [N] facts; engine band scores (85/30/55/92) appear in doc (CR-01 confirmed live).
  - SC-4 (determinism) PASS with corrected expectation: NOT "two live runs identical" (Claude prose varies by design); the real contract is re-hash of a FIXED document — computeReasoningHash(stored live doc) reproduced published hash 0xa522477b…, canonical bytes stable. = Phase 4 verify path.
  Full suite 191/191 green, typecheck clean.
USER CHOICE (2026-06-10): holding to re-run live themselves before close — wants to see cmETH/FBTC grade spread firsthand (those not run live in-session to conserve API budget; USDY representative, all 3 adapters share one code path).
TO CLOSE once user confirms their re-run: `gsd-sdk query phase.complete 02` + commit ROADMAP/STATE/VERIFICATION, then advance to Phase 3 (On-Chain Publish + ERC-8004 + IPFS) — discuss or plan. Verifier confirmed NO code gaps block Phase 3. NOTE: project dates are stale in STATE (Today says 2026-06-07; actually 2026-06-10 = Day 4 of 5-day target).

- Phase: 1 — Lock + Skeleton COMPLETE 2026-06-08 (+ post-review hardening redeploy 2026-06-08)
- Plan: 1-03 complete; Phase 1 closed. Post-phase polish (WR-01/WR-02/WR-03/WR-04 from 01-REVIEW.md) applied and redeployed to Sepolia.
- Status: Hardened RatingRegistry deployed + verified on Mantle Sepolia at `0x54163E309f7C8108F7110B086F640882a97f3838`. Smoke requestRating transaction observed on-chain from non-agent wallet. 20 Project Deployment Award technical bar CLEARED.
- Deployed (Sepolia canonical): `0x54163E309f7C8108F7110B086F640882a97f3838` (Phase 1 hardened — confidence bound + immutable agent). Historical Phase 1.0 deploy at `0x0912bcBd57579179388cE9d4863032406dCfBe18` superseded but left on-chain. See .planning/phases/01-lock-skeleton/01-03-DEPLOYMENT.md for both records.
- Progress: 1/5 phases complete `[##        ] 1/5 phases complete (3/3 plans in Phase 1 + post-review polish)`
- Next: /gsd-execute-phase 2 — Rating Engine Core (5 plans, 5 sequential waves; Day 2).

## Performance Metrics

- **Phases planned:** 5
- **Phases complete:** 2
- **Requirements mapped:** 15/15 (100% coverage)
- **v1 requirements:** 15
- **v2 deferred:** 5
- **Days of runway (user target):** 5 working days (2026-06-08 → 2026-06-12)
- **Days of runway (official deadline):** 8 days (2026-06-08 → 2026-06-15)

## Accumulated Context

### Locked Decisions (18 total: 13 spec-asserted + 5 added at Phase 1 discovery 2026-06-07)

Listed in `.planning/PROJECT.md` under `<decisions>`. Three modified or added at planning time per user timeline_override; five added at Phase 1 discovery lock:

- **DEC-five-deterministic-risk-dimensions → FOUR.** Governance/custodian dimension dropped per DEC-scope-cut-sequence #3.
- **DEC-scope-cut-sequence applied proactively** for cuts #1, #3, #4 (not just contingency).
- **DEC-subject-set-locked:** USDY + cmETH + FBTC (cmETH replaces spec's mETH — Mantle-native variant).
- **DEC-erc8004-canonical-addresses:** Identity `0x8004A169...432`, Reputation `0x8004BAa1...b63` — both live on Mantle Mainnet, reference deployment contingency eliminated.
- **DEC-historical-proof-case:** Elixir deUSD collapse (2025-11-03/06). USDe Oct 11 flash depeg as backup.
- **DEC-deployment-target-plan:** Sepolia for iteration through Day 4, Mainnet for ship Day 5.
- **DEC-ipfs-provider-web3storage:** web3.storage chosen over Pinata.

### Phase 1 Discovery — RESOLVED 2026-06-07

All four open discovery items closed by parallel research; findings in `.planning/phases/01-lock-skeleton/RESEARCH.md` and locked above. Phase 1 Track A (verification) is complete — Day 1 effort drops to Track B only: deploy the verified `RatingRegistry.sol` skeleton with stub `requestRating → publishRating` on Mantle Sepolia to clear the 20 Project Deployment Award bar.

### Risks Tracked

- **Cherry-picked accuracy** → mitigated by historical-downgrade proof on a real 2025 failure (REQ-06).
- **AI x RWA crowding** → ratings-first positioning, upstream-of-yield framing in pitch.
- **ERC-8004 not on Mantle** → Phase 1 confirmation; reference deployment is the fallback.
- **Reasoning reads as generic** → CON-llm-prompt-evidence-citation enforced in agent prompt.
- **Attention split with Sui Overflow** (deadline 2026-06-16) → Phase 1 front-loads the 20 Project Deployment Award bar so worst-case finish still clears it.
- **Compressed timeline** (5 days vs 8) → cuts already baked in; cuts #2 and #5 remain contingency.

### Open Todos

- [x] ~~Phase 1 Plan 1-01 — Foundry scaffold (foundry.toml, forge-std v1.16.1, stub .sol files, .env.example, .gitignore)~~ → Completed 2026-06-08, commits `29bbb13` + `c4faaf3`.
- [x] ~~Phase 1 Plan 1-02 — RatingRegistry contract body + 5 unit tests per 01-VALIDATION.md.~~ → Completed 2026-06-08, commits `6ca550b` (feat) + `7f84073` (test). forge build + forge test both green.
- [x] ~~Phase 1 Plan 1-03 — Deploy verified RatingRegistry.sol to Mantle Sepolia (and Mainnet per DEC-deployment-target-plan)~~ → DEPLOYED 2026-06-08 (see .planning/phases/01-lock-skeleton/01-03-DEPLOYMENT.md). Mainnet artifact scheduled for Day 5 / Phase 5.
- [ ] User: pick light vs dark variant of editorial aesthetic before Phase 4 (DEC-aesthetic-direction-editorial — "pick one and execute completely").
- [x] ~~User: confirm IPFS pinning provider~~ → web3.storage locked 2026-06-07 (DEC-ipfs-provider-web3storage).
- [x] ~~User: confirm Mainnet vs Testnet for ship~~ → Sepolia iterate, Mainnet ship locked 2026-06-07 (DEC-deployment-target-plan).

### Blockers

None. Intel marked READY (no blockers, no competing variants).

## Session Continuity

- **Last session:** 2026-06-10T14:24:27.391Z

- **Phase 1 polish session:** 2026-06-08T07:00:00Z — Applied code-review findings WR-01 (confidence range guard), WR-02 (agent → immutable), WR-03 (latestRating sentinel docs + test tighten), WR-04 (.gitignore .env.* glob). Test suite expanded from 5/5 to 6/6 (new `test_publishRating_confidenceRange`). Redeployed hardened contract to Mantle Sepolia from same deployer EOA (nonce 3): canonical address now `0x54163E309f7C8108F7110B086F640882a97f3838`. Verified on Mantlescan via Etherscan V2 on first try. Smoke `requestRating` from fresh non-agent wallet `0x6FA40bBd50FB164D809b59D523357011055a60F4` confirmed RatingRequested event. Commits: `66eda27`, `0bceed0`, `55fa8f7`, `e15a767`, `ded45bf`. Phase 1.0 contract at `0x0912bcBd…Be18` left on-chain as historical record.

- **Plan 1-03 session:** 2026-06-08T06:20:00Z — Plan 1-03 executed by gsd plan executor (sequential, main worktree, continuation after user-funding checkpoint). Deploy.s.sol broadcast against Mantle Sepolia (chain 5003); RatingRegistry deployed at `0x0912bcBd57579179388cE9d4863032406dCfBe18` (block 39677059, deploy tx `0x4cba0abfe6aee6c69f4d59d1921ce8fdb3dffa154a0505746049ab71f0f16c2b`, gas 429245). `cast call agent()` returned the deployer `0xb27c7fa15D25E880Ba4a9a508e166538e106F51e` — constructor initialized state correctly. Source verified on Mantlescan / Etherscan V2 (chainid=5003) at `https://sepolia.mantlescan.xyz/address/0x0912bcBd57579179388cE9d4863032406dCfBe18` — Blockscout API at explorer.sepolia.mantle.xyz was returning persistent 503 across all endpoints during the execution window so we fell back to `forge verify-contract --chain-id 5003 --etherscan-api-key` which succeeded; Etherscan V2 getsourcecode returned ContractName=RatingRegistry, CompilerVersion=v0.8.24+commit.e11b9ed9, non-empty SourceCode, OptimizationUsed=1. Smoke `requestRating` tx sent from a fresh second wallet `0xb2Cf716A77C8739E3675203bb18E3ED6Ca50ecA4` (funded with 0.11 MNT from the deployer): tx `0x5846ec352e58259a8e5cebcc207d10368f96ff41a131c7dfd459f76fce2c0390` block 39677253; RatingRequested event observed (sig `0xf2c7f32ca728a7137bebb36fb9afaf4d7a6d25af26b5c68bd8f2b032a6dae996`) with indexed subject `0xdEaD000000000000000022d473030F116dDEE9F6` and indexed requester = second wallet — proves "anyone can trigger" per DEC-onchain-trigger-requestRating. `forge build` + `forge test -q` both green post-deploy. Three commits: `7b3e79b` (feat — deploy + verify + DEPLOYMENT.md), plus the STATE/PROJECT/SUMMARY commits that follow. See `.planning/phases/01-lock-skeleton/01-03-SUMMARY.md` and `01-03-DEPLOYMENT.md`. **Phase 1 CLOSED. 20 Project Deployment Award technical bar CLEARED.**
- **Next session:** `/gsd-plan-phase 2` — Rating Engine Core (Day 2). Phase 5 (Day 5) re-runs Deploy.s.sol against Mantle Mainnet (chain 5000) with `--rpc-url https://rpc.mantle.xyz` and a Mainnet-funded deployer key.
- **Artifacts written this session (Plan 1-03):**
  - `.planning/phases/01-lock-skeleton/01-03-DEPLOYMENT.md` (created — single source of truth for Sepolia deploy artifacts)
  - `.planning/phases/01-lock-skeleton/01-03-SUMMARY.md` (created)
  - `.planning/STATE.md` (this update — Current Position, progress, todos)
  - `.planning/PROJECT.md` (Deployed Addresses section appended after `</decisions>`)
  - `.planning/ROADMAP.md` (Phase 1 row → Complete, 3/3 plans)
- **Intel sources consulted (this session):**
  - `.planning/phases/01-lock-skeleton/1-03-PLAN.md` (interfaces block, action steps, acceptance criteria)
  - `.planning/phases/01-lock-skeleton/RESEARCH.md` (Pitfall 3 — --verify silent skip; Track B Stream 5 — verification path)
  - `.planning/phases/01-lock-skeleton/01-VALIDATION.md` (per-task verification map rows 1-03-01 / 1-03-02)
  - `.planning/phases/01-lock-skeleton/01-01-SUMMARY.md` + `01-02-SUMMARY.md` (Wave 2 starting state)
  - `script/Deploy.s.sol` (committed `8bf1be7` Task 1-03-01)
  - `foundry.toml` (mantle_sepolia RPC alias, [etherscan] Blockscout endpoint)
  - `.env` (PRIVATE_KEY, MANTLE_SEPOLIA_RPC_URL, MANTLE_EXPLORER_KEY)
