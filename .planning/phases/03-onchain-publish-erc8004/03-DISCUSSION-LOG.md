# Phase 3: On-Chain Publish + ERC-8004 + Historical Reconstruction Start - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-10
**Phase:** 3-On-Chain Publish + ERC-8004 + Historical Reconstruction Start
**Areas discussed:** ERC-8004 identity + publish gate, IPFS ↔ on-chain linkage, Live publish flow / event listener, Historical reconstruction approach

---

## ERC-8004 identity gate + network

| Option | Description | Selected |
|--------|-------------|----------|
| Mainnet canonical + ownerOf gate | Mint identity NFT from canonical registry on Mantle Mainnet now; publishRating does live ownerOf(tokenId)==msg.sender. True enforcement + strongest narrative; sub-cent gas; Phase 3 work moves to Mainnet. | ✓ |
| Recorded agent EOA gate | Agent EOA holds NFT; contract checks msg.sender==agent; identity is UI narrative only. Simplest, fastest. | |
| Sepolia reference + Mainnet at ship | Reference-deploy ERC-8004 on Sepolia to iterate, canonical on Mainnet at ship. More moving parts. | |

**User's choice:** Mainnet canonical + ownerOf gate.
**Notes:** Mint NFT against `0x8004A169…` on Mainnet FIRST (ordering dependency). Store tokenId + registry as immutable constructor args. Gate = `require(IIdentityRegistry(registry).ownerOf(agentTokenId) == msg.sender)`, minimal interface (ownerOf only). Negative test first, in isolation. Redeploy to Mainnet exactly once (clean ship deploy); iterate via local Mainnet fork. Registry address = named constant w/ Mainnet-only comment. IPFS hash flow unchanged.

---

## IPFS ↔ on-chain linkage

| Option | Description | Selected |
|--------|-------------|----------|
| Emit CID in RatingPublished event | Add string cid to event only; frontend reads from logs. No storage cost. | |
| Add CID/URI field to Rating struct | Store cid on-chain in struct; latestRating returns it. +SSTORE, struct ABI change. | ✓ |
| Off-chain CID map | subject→CID manifest off-chain; nothing on-chain. Weakest verifiability. | |

**User's choice:** Add CID to struct — AND keep emitting it in the event (complementary).
**Notes:** `string cid` in Rating struct + emit in RatingPublished event. Set CID in the same publishRating call as the hash (atomic). Lock struct ABI before Phase 4 (Phase 4 gens types from post-redeploy ABI). Store bare CID (not gateway URL). Frontend verifies end-to-end: read → fetch JSON → recompute keccak256 over canonical JSON → assert == reasoningHash. Guard the silent failure: canonical serialization must match pin-side and hash-side.

---

## Live publish flow / event listener

| Option | Description | Selected |
|--------|-------------|----------|
| Persistent watcher daemon | viem watchEvent on RatingRequested → engine → pin → publishRating. Powers REQ-10. | |
| Manual publish script | Run a script per request on demand. Simpler, but no live reactivity. | |
| Both — watcher primary, script fallback | Watcher for the live moment, manual script as break-glass backup. | ✓ |

**User's choice:** Both — watcher primary, manual script fallback.
**Notes:** Build the core pipeline ONCE as a shared function; both paths call it. Watcher = long-running viem watchEvent (primary, REQ-10). Manual = `pnpm publish-rating <subject>` (fallback). Idempotent/double-fire safe. Watcher needs reconnect + heartbeat liveness (watchEvent silently drops). Pre-fund agent EOA + pre-flight balance check. Rehearse fallback.

---

## Historical reconstruction approach

| Option | Description | Selected |
|--------|-------------|----------|
| Curated static snapshot fixture | Hand-curate Elixir deUSD red flags into a static SubjectFacts fixture; run unmodified engine; capture graded fixture. Fast, deterministic, demo-safe. | ✓ |
| Real Ethereum-archival adapter | Build a deUSD/xUSD adapter on Ethereum archival RPC at the pre-failure block. Most authentic, most work. | |
| Hybrid: archival reads + curated gaps | Archival for cheap reads, hand-fill the rest. | |

**User's choice:** Curated static snapshot fixture.
**Notes:** Encode red flags verbatim ($1.00 hardcoded oracle, 65% xUSD concentration, 4.1x leverage, $520M vs $160M TVL gap) at the pre-failure block. Run the UNMODIFIED engine — no special-casing; if it needs tweaks to flag Elixir, that's a finding, not a fixture patch. Phase 3 captures the graded fixture; Phase 4 renders the timeline (downgrade → failure ordering). Provenance per fact (sources linking to public record). Keep fixture entirely separate from live adapters; label as historical proof.

---

## Claude's Discretion

- `IIdentityRegistry` interface name/shape (minimal — ownerOf only).
- Watcher reconnect/backoff params, heartbeat interval, log format.
- web3.storage client wiring, CID version.
- Fixture file location/naming under agent/ (separate from live src/subjects/).
- Whether manual publish CLI is new `agent/src/publish.ts` + script, or folded into existing CLI.

## Deferred Ideas

- Live ERC-8004 Reputation Registry accuracy loop — v2 / cut #1 (historical proof substitutes).
- Real Ethereum-archival deUSD adapter — post-hackathon authenticity upgrade.
- ERC-8004 Validation Registry integration — not required for Phase 3 success criteria.
