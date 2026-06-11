---
phase: 03-onchain-publish-erc8004
plan: 03
subsystem: onchain
tags: [erc8004, identity, mint, mainnet, deploy, immutable, gate, abi-freeze, mantlescan, viem]

# Dependency graph
requires:
  - phase: 01-lock-skeleton
    provides: "RatingRegistry.sol (ERC-8004 ownerOf gate, string cid, immutable registry+agentTokenId) + script/Deploy.s.sol (reads AGENT_TOKEN_ID, bakes IDENTITY_REGISTRY constant)"
  - phase: 03-onchain-publish-erc8004 (Plan 02)
    provides: "wallet.ts (walletClient/account, Mantle 5000), ipfs.ts (pin), registry-abi.ts (hand-authored freeze source), rpc.ts (publicClient + redactRpcError)"
provides:
  - "LIVE ERC-8004 Identity NFT agentId=114 held by the agent EOA on the canonical Mantle Mainnet registry (ownerOf(114)==agent, verified)"
  - "CANONICAL Mantle Mainnet RatingRegistry at 0xF16d03965E1870Fc3235198468C56dEC65E5606D — once-only (D-01) deploy, ERC-8004 gate live, verified on Mantlescan"
  - "agent/src/mint-identity.ts + agent/src/identity-abi.ts (Task 1, dry-run-proven register(agentURI) mint capturing agentId)"
  - "agent/src/registry-abi.ts reconciled byte-equivalent (12/12) to the deployed artifact — D-02 ABI freeze for Phase 4 FE types"
  - "AGENT_TOKEN_ID=114 + RATING_REGISTRY_ADDRESS=0xF16d…606D in root .env"
affects: [03-04-publish-pipeline, 03-06-live-e2e, 04-frontend-verify, 05-ship]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "mint FIRST, redeploy ONCE, then iterate against an anvil fork — never redeploy live again (D-01)"
    - "live-gate proof via cast call --from (eth_call, no gas, no state): non-agent reverts NotAgent, agent passes — proven immediately after deploy"
    - "hand-authored as-const ABI reconciled to the deployed artifact by canonical-signature set comparison (order-independent, internalType-agnostic)"
    - "Etherscan-V2 multichain verify fallback when Blockscout 5xx — chainid must be in the verifier-url (?chainid=5000), the --chain flag alone is not appended"

key-files:
  created:
    - .planning/phases/03-onchain-publish-erc8004/03-03-SUMMARY.md
  modified:
    - agent/src/registry-abi.ts
    - .planning/PROJECT.md
  prior-session:
    - agent/src/mint-identity.ts
    - agent/src/identity-abi.ts

key-decisions:
  - "Mint (Task 2 Step 1) was already executed in a prior session (AGENT_TOKEN_ID=114 found pre-set); this session VERIFIED it live (ownerOf(114)==agent) rather than re-minting — D-01 honored, no double mint"
  - "Deploy decoupled from verify: --broadcast alone (no --verify) so flaky Blockscout could not interfere with the irreversible deploy; verified separately afterward"
  - "ABI reconcile found ZERO drift (hand-authored == deployed artifact, 12/12) — only the file header note updated (expected-mismatch → reconciled/frozen), no ABI body change"

patterns-established:
  - "Post-deploy gate proof is mandatory and immediate: prove the immutable ownerOf gate reverts non-agent + passes agent on the LIVE contract before any publish logic is wired"
  - "D-01 deploy-once guard: check for an existing broadcast/Deploy.s.sol/<chainid>/ dir before broadcasting"

requirements-completed: [REQ-02, REQ-03]

# Metrics
completed: 2026-06-11
---

# Phase 3 Plan 03: Mint ERC-8004 Identity + Once-Only Mainnet Redeploy + ABI Freeze

**The agent now holds ERC-8004 Identity NFT #114 on Mantle Mainnet, and the canonical `RatingRegistry` is live at `0xF16d…606D` with the `ownerOf(114)` gate baked in as an immutable and PROVEN on-chain — non-agent calls revert `NotAgent()`, the agent passes. The ABI is reconciled byte-equivalent to the deployed artifact and frozen for Phase 4.**

## Performance

- **Completed:** 2026-06-11
- **Tasks:** 3 (Task 1 prior session; Task 2 live checkpoint; Task 3 reconcile/record this session)

## Accomplishments

### Task 1 — Mint script + identity ABI (prior session, commit `df764a0`)
- `agent/src/identity-abi.ts`: `identityRegistryAbi` (`as const`) covering `register(string)→uint256`, `Registered`, ERC-721 `Transfer`, `ownerOf`.
- `agent/src/mint-identity.ts`: one-shot `register(agentURI)` — builds the EIP-8004 registration-v1 agent-card (`canonicalize`), `pin()`s it, mints from the agent EOA, parses `agentId` from `Registered`/`Transfer(0x0)`; `--dry-run` simulates via `publicClient.simulateContract` (no broadcast); all catches funnel through `redactRpcError`. Dry-run-proven against a Mainnet fork before the live tx.

### Task 2 — LIVE on-chain (human-confirmed checkpoint)
- **Mint (Step 1):** Identity NFT **agentId 114** minted on the canonical registry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`. Verified live: `ownerOf(114) == 0xb27c7fa15D25E880Ba4a9a508e166538e106F51e` (the agent EOA). Agent-card: `tokenURI(114) = ipfs://bafkreifu6wo7sseskorodory3lgsjhgpktimadantvbfkhvy7p4o5rh44u` (Pinata raw-file pin). *(Mint executed in a prior session; this session verified rather than re-minting — D-01.)*
- **Redeploy (Step 2, once-only):** `RatingRegistry` deployed to **Mantle Mainnet (chain 5000)** at **`0xF16d03965E1870Fc3235198468C56dEC65E5606D`** — deploy tx `0xd99ced666c2e6fc39b45de6f50f66b7a6befc2088b2632a21fc9bf1ceb134af3`, block 96506775, gas 705,910. Immutables: `registry()==0x8004A169…432`, `agentTokenId()==114`. **Verified on Mantlescan** (Etherscan-V2, `Pass - Verified`, GUID `i8mfsfk7…cid5`).
- **Live negative-gate proof** (the critical "does the immutable gate actually work" check, run as `eth_call`, no gas/state):
  - `publishRating` from a **non-agent** (`0x…dEaD`) → **reverts `NotAgent()`** (`0x0d9ab13f`). ✅
  - `publishRating` from the **agent EOA** (owner of 114) → **passes the gate** (returns `0x`). ✅

### Task 3 — Reconcile ABI + record (this session)
- `agent/src/registry-abi.ts` **reconciled** against the post-redeploy `out/RatingRegistry.sol/RatingRegistry.json`: **12/12 canonical signatures match, zero drift** (incl. `string cid` in `publishRating`, `RatingPublished`, and both read-struct returns). Header note updated from the wave-1 "expected mismatch" to "RECONCILED / FROZEN (D-02)".
- `.planning/PROJECT.md` "Deployed Addresses": added the *Phase 3 — Mantle Mainnet* canonical block (address, deploy tx, block/gas, agentId 114, agent-card CID, gate-is-live note via `ownerOf(agentTokenId)`); relabeled the Sepolia deploy as the superseded iteration record; updated the stale "Mainnet deploy scheduled for Day 5" line to DONE.
- Root `.env`: `RATING_REGISTRY_ADDRESS=0xF16d03965E1870Fc3235198468C56dEC65E5606D` (AGENT_TOKEN_ID=114 already present).

## Verification

- **Live:** `ownerOf(114)` → agent EOA; `agentTokenId()` → 114; `registry()` → `0x8004A169…432`; contract `Pass - Verified` on Mantlescan; gate reverts non-agent / passes agent.
- **Agent suite:** `pnpm typecheck` exits 0; `pnpm test` → **201 passed / 1 skipped** (24 files).
- **Contract suite:** `forge test` → **8/8 passed** (incl. `test_publishRating_revertsForNonAgent`, `test_publishRating_succeedsForAgent`, `test_latestRating_returnsCid`).

## Deviations from Plan

**1. Mint already executed in a prior session — verified, not re-run.**
- Pre-flight found `AGENT_TOKEN_ID=114` already set in `.env`. On-chain `ownerOf(114)` returned the agent EOA, confirming the mint (Task 2 Step 1) was already done. Per D-01 (mint once), this session re-verified the existing token instead of re-minting. The agent-card CID was recovered from `tokenURI(114)`.

**2. Blockscout verify 502 → Etherscan-V2 fallback (extends the Phase 1 precedent).**
- `forge verify-contract --verifier blockscout --verifier-url https://explorer.mantle.xyz/api/` returned **502 Bad Gateway** (Phase 1 hit persistent 503s on the Sepolia equivalent). Fell back to Etherscan-V2 multichain. **New detail vs Phase 1:** the `--chain 5000` flag alone did **not** append the v2 `chainid` param (`Error: Missing chainid parameter (required for v2 api)`); it must be baked into the verifier-url: `--verifier-url "https://api.etherscan.io/v2/api?chainid=5000"`. With that, verification succeeded first try.

**3. ABI reconcile produced no code change.**
- The hand-authored `registry-abi.ts` was already byte-equivalent to the deployed artifact (12/12). Only the header comment was updated. (Reconciliation was performed with a throwaway `agent/_cmp_abi.ts` canonical-signature comparator, since `abitype` is not directly resolvable under pnpm; the script was deleted after use.)

**Total deviations:** 3 (all benign — no scope change; each documented above).

## Next Phase Readiness

- **Plan 04 (publish pipeline):** the deploy target (`RATING_REGISTRY_ADDRESS`), the live gate (agent EOA owns 114), the frozen `ratingRegistryAbi`, `walletClient`, and `pin()` are all in place. `publishRatingFor(subject)` can compose them; iterate against an `anvil --fork` (D-01 — no further live redeploy).
- **Plan 06 (watcher live e2e):** the contract emits `RatingRequested`; the gate + identity are live for the end-to-end `requestRating → watcher → publishRating` proof.
- **Phase 4 (frontend verify):** ABI is frozen; the agent identity address + agentId 114 + agent-card CID are recorded for the track-record / identity surface.
- **No blockers.**

## Self-Check: PASSED

- Files: `agent/src/registry-abi.ts` (modified), `.planning/PROJECT.md` (modified), `agent/src/mint-identity.ts` + `agent/src/identity-abi.ts` (prior session), this SUMMARY — all FOUND.
- Live state: `ownerOf(114)`==agent, `agentTokenId()`==114, contract verified, gate proven — all CONFIRMED on Mantle Mainnet.
- Verification: agent 201 passed / 1 skipped, typecheck 0; forge 8/8.

---
*Phase: 03-onchain-publish-erc8004*
*Completed: 2026-06-11*
