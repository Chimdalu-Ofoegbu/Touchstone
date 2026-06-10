---
phase: 03
slug: onchain-publish-erc8004
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-10
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated from 03-RESEARCH.md "Validation Architecture". The planner refines the
> per-task map; this is the skeleton the plan-checker validates Dimension 8 against.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (agent)** | vitest 4.x (existing — `agent/`) |
| **Framework (contracts)** | forge / foundry (existing — `test/`) |
| **Config file** | `agent/vitest.config.ts`; `foundry.toml` |
| **Quick run command** | `cd agent && pnpm vitest run <file>` · `forge test --match-path test/RatingRegistry.t.sol` |
| **Full suite command** | `cd agent && pnpm test && pnpm typecheck` · `forge test` |
| **Estimated runtime** | ~40s agent + ~1s forge |

---

## Sampling Rate

- **After every task commit:** Run the relevant quick command (vitest file or forge match-path).
- **After every plan wave:** Run both full suites (agent vitest + forge).
- **Before `/gsd-verify-work`:** Both suites green; live mint/redeploy/publish smoke evidence captured.
- **Max feedback latency:** ~45 seconds (mock paths); live on-chain steps are manual-evidence.

---

## Per-Task Verification Map

> Skeleton — the planner fills exact task IDs/commands. Key verifiable behaviors per requirement:

| Behavior | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|----------|-------------|------------|-----------------|-----------|-------------------|--------|
| `publishRating` reverts from non-agent (ownerOf gate) | REQ-03 | T-3-gate | only ERC-8004 NFT holder publishes | forge (mockCall+etch or fork) | `forge test --match-test test_publishRating_revertsNonAgent` | ⬜ pending |
| `publishRating` succeeds from agent (mocked ownerOf) | REQ-02/03 | — | happy-path write + event | forge | `forge test --match-test test_publishRating_agent` | ⬜ pending |
| Rating struct + RatingPublished carry `cid`, set atomically with hash | REQ-04 | T-3-cid | no hash-without-pointer state | forge | `forge test --match-test test_publishRating_cid` | ⬜ pending |
| `latestRating`/`ratingHistory` return full struct incl. cid | REQ-02 | — | read interface complete | forge | `forge test --match-test test_reads` | ⬜ pending |
| Pinned bytes == `canonicalizeDoc(doc)` (no re-serialization) | REQ-04 | T-3-determinism | Phase-4 re-hash matches | vitest | `pnpm vitest run tests/publish/pin-bytes.test.ts` | ⬜ pending |
| `pin(canonical)` returns a fetchable CID whose bytes re-hash to reasoningHash | REQ-04 | — | verifiable reasoning | vitest (mock provider) | `pnpm vitest run tests/publish/pin.test.ts` | ⬜ pending |
| Publish pipeline = engine→pin→publishRating (shared fn, watcher+CLI both call) | REQ-02 | T-3-idempotent | no double-publish corruption | vitest (mock walletClient) | `pnpm vitest run tests/publish/pipeline.test.ts` | ⬜ pending |
| Elixir deUSD fixture rated by UNMODIFIED engine → low/deteriorating grade | REQ-06 | — | no special-casing | vitest | `pnpm vitest run tests/historical/elixir.test.ts` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/RatingRegistry.t.sol` — extend with `IIdentityRegistry` mock (vm.etch + vm.mockCall on `ownerOf`) for the gate tests.
- [ ] `agent/tests/publish/` — new dir: pin-bytes, pin (mock provider), pipeline (mock walletClient) test stubs.
- [ ] `agent/tests/historical/elixir.test.ts` — stub asserting the unmodified engine grades the fixture low.
- [ ] No new framework install — vitest + forge already present.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ERC-8004 identity NFT minted on Mantle Mainnet, agentId captured | REQ-03 | One-time live mint, real gas | Run mint script from agent EOA; record agentId + tx; assert `ownerOf(agentId)==agent`. |
| RatingRegistry redeployed to Mainnet with registry+tokenId baked in | REQ-02/03 | Live deploy, real gas, once | `forge script Deploy` to Mainnet; record address; verify on Mantlescan. |
| End-to-end live publish for ≥1 subject (requestRating→watcher→publishRating) | REQ-02/05 | Live RPC + Anthropic + gas | Trigger requestRating; watcher publishes; confirm RatingPublished + latestRating returns struct + IPFS JSON re-hashes to on-chain hash. |

*Live on-chain steps are manual-evidence by nature; the mock-path tests above prove the logic deterministically first.*

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies (live on-chain steps documented as manual-evidence)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s (mock paths)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
