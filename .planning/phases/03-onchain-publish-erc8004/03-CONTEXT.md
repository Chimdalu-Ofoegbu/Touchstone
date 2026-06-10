# Phase 3: On-Chain Publish + ERC-8004 + Historical Reconstruction Start - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the Phase 2 rating engine produce **real on-chain ratings**:
1. The agent mints an **ERC-8004 Identity NFT** from the canonical registry on Mantle Mainnet and `publishRating` is gated to that identity (REQ-03).
2. The agent listens for `RatingRequested`, runs the Phase 2 engine, **pins the reasoning JSON to IPFS** (web3.storage), and writes `publishRating(subject, grade, reasoningHash, confidence, cid)` where `reasoningHash == keccak256(canonical reasoning JSON)` (REQ-02 real publish, REQ-04).
3. `latestRating` / `ratingHistory` return the full `Rating` struct end-to-end (REQ-02).
4. **Start** the Elixir deUSD historical reconstruction — a graded static fixture ready for Phase 4 to render (REQ-06 start).

Owns: REQ-02 (real publish), REQ-03, REQ-04, REQ-06 (start). Frontend rendering of all of this is Phase 4.

**Out of scope (other phases):** all frontend screens/rendering (Phase 4), the historical-proof *timeline UI* (Phase 4 finish), Mainnet *ship* polish + submission (Phase 5), live Reputation Registry accuracy loop (v2, cut #1).
</domain>

<decisions>
## Implementation Decisions

### ERC-8004 identity gate + network (D-01)
**Chosen: Mainnet canonical + live `ownerOf` gate.** Phase 3 on-chain work runs on **Mantle Mainnet (chain 5000)**, not Sepolia — the canonical ERC-8004 Identity Registry is Mainnet-only.

- **Ordering dependency (do FIRST):** Mint the agent identity NFT against the canonical ERC-8004 Identity Registry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` on Mantle Mainnet **before anything else in Phase 3**. Everything downstream gates on this token existing — it is the ordering dependency, not a parallel task.
- Store the resulting **`tokenId` and the registry address as immutable constructor args** in RatingRegistry (single source of reference; do not hardcode in multiple places).
- Gate implementation in `publishRating`: live cross-contract call `require(IIdentityRegistry(registry).ownerOf(agentTokenId) == msg.sender, "not the rating agent")`. Keep the interface minimal — **only `ownerOf` is needed**.
- **Negative test first, in isolation:** before layering publish logic, write + run the test confirming `publishRating` reverts from a non-agent address and succeeds from the agent EOA. The cross-contract call is the new failure surface — verify it alone first.
- **Redeploy RatingRegistry to Mainnet exactly once** with the canonical registry address + agent tokenId baked in. Treat it as the clean ship deploy, NOT an iteration target — iterate remaining logic against a **local fork of Mainnet state** so the live contract isn't redeployed repeatedly.
- Pin the canonical registry address as a **named constant with a "Mantle Mainnet-only" comment** so no one later points it at Sepolia and silently breaks the gate.
- IPFS reasoning-hash flow is unchanged by this decision — only the identity gate + network.

### IPFS ↔ on-chain linkage (D-02)
**Chosen: CID in the struct AND the event (complementary, not either/or).**

- Add a **`string cid`** (content identifier) field to the `Rating` struct alongside grade/reasoningHash/confidence/timestamp, so `latestRating()` / `ratingHistory()` return the full verification set in one read.
- Set the CID in the **same `publishRating` call** that writes the hash — never a separate tx. Hash and its pointer must be written **atomically**; there must never be on-chain state with a hash but no retrievable reasoning.
- Also **emit the CID in the `RatingPublished` event** (nearly free; fast path for indexers/frontend). Struct = canonical contract reads; event = cheap frontend indexing.
- **Lock the final struct ABI before Phase 4 frontend work begins.** The gate redeploy is the moment the struct shape freezes — Phase 4 generates types from the **post-redeploy ABI** (no mid-phase migration).
- Store the **bare CID**, not a full gateway URL — frontend composes the gateway URL at fetch time and can fall back across gateways.
- **Frontend (Phase 4) verifies end-to-end:** read rating → fetch JSON from CID → recompute `keccak256` over canonical JSON → assert `== reasoningHash` → surface as the "verified on Mantle" state.
- ⚠ **Silent-failure guard:** canonical serialization MUST be byte-identical on the pinning side and the hashing side (canonical key ordering, no whitespace drift) or the recomputed hash won't match. Reuse Phase 2's `agent/src/hash.ts` `canonicalizeDoc` for BOTH pin and hash — the pinned bytes must be exactly the bytes that were hashed (Phase 2 already writes canonical bytes via `rate({writeToFs})`).

### Live publish flow / event listener (D-03)
**Chosen: shared core pipeline; watcher primary + manual script fallback.**

- Build the **core pipeline once** as a single function: `(subject) → run Phase 2 engine → pin reasoning JSON to IPFS → call publishRating signed by the agent key`. Both the watcher and the manual script call this same function — **do not write publish logic twice**.
- **Watcher (primary, powers REQ-10):** long-running Node process using viem `watchEvent` on `RatingRequested` → invokes the pipeline per event. This is the "trigger from UI, watch it react" moment.
- **Manual CLI (fallback / break-glass):** `pnpm publish-rating <subject>` runs the identical pipeline on demand. Used if the daemon drops mid-demo.
- **Idempotent / double-fire safe:** if watcher and manual script could both fire for the same subject, a duplicate publish must be harmless or guarded — recovery action can't corrupt state.
- **Watcher resilience:** `watchEvent` can silently drop on RPC issues — daemon must detect a dead subscription, re-establish it, and log a **heartbeat** so liveness is visible during the demo.
- **Pre-flight:** pre-fund the agent EOA with MNT on Mainnet and check balance before the demo (avoidable "out of gas mid-demo"). Same key signs both paths.
- Rehearse the fallback once so switching to the manual command is smooth.

### Historical reconstruction approach (D-04)
**Chosen: curated static SubjectFacts fixture (Elixir deUSD), rated by the UNMODIFIED engine.**

- Build the Elixir pre-failure state as a **static `SubjectFacts` fixture at the documented pre-failure block**, encoding the real red flags verbatim: **$1.00 hardcoded oracle, 65% xUSD concentration, 4.1x leverage, $520M claimed vs $160M actual TVL gap**. Get the numbers exactly right against the documented record (DEC-historical-proof-case).
- **Run the unmodified rating engine** on the fixture. **CRITICAL: no special-casing / no engine tuning for Elixir.** The proof only means something if the *same* engine that rates live Mantle subjects produces the deteriorating grade from these facts with no special handling. If the engine needs tweaks to flag Elixir, that's a **finding about the engine**, not something to paper over in the fixture.
- **Phase 3 deliverable:** capture the output as a **graded fixture** (grade + per-dimension reasoning citing each red flag), so Phase 4 renders a fixed, known timeline rather than computing live during the demo.
- **Provenance per fact:** each red flag in the fixture carries a comment/`sources` field linking it to its documented public source (e.g., CBB0FE leverage analysis 2025-10-28). Recovers most of the authenticity of the archival path without building it.
- **Phase 4 (not this phase)** renders the timeline showing the ordering explicitly: engine's deteriorating grade at the pre-failure block → actual failure date after. Persuasion is in the ordering (downgrade first, failure second).
- **Keep the fixture entirely separate** from the live Mantle adapters and live-rating path — distinct demonstration artifact, clearly labeled as the historical proof, so no one thinks the live ratings are also curated.

### Claude's Discretion
- Exact Solidity interface name/shape for `IIdentityRegistry` (minimal — `ownerOf` only).
- Watcher reconnect/backoff parameters, heartbeat interval, log format.
- web3.storage client wiring details (auth token via root `.env`), CID version.
- Fixture file location/naming under `agent/` (separate from `src/subjects/` live adapters).
- Whether the manual publish CLI is a new `agent/src/publish.ts` + `pnpm publish-rating` script or folded into existing CLI surface.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner) MUST read these before planning or implementing.**

### ERC-8004 identity + on-chain gate
- `.planning/PROJECT.md` → `DEC-erc8004-canonical-addresses` — Identity `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`, Reputation `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` (Mantle Mainnet, verified 2026-02-11).
- `.planning/phases/01-lock-skeleton/RESEARCH.md` → Track A Stream 2 (ERC-8004 status, the mint flow "Phase 3 owns", `ownerOf`/registry verification, impl `0x7274e874…`, Solidity 0.8.24) and the anti-pattern note (lines ~279-281, 302-342) on the agent-gate swap.
- `src/RatingRegistry.sol` — current contract to **redeploy**: `immutable agent` EOA gate (`onlyAgent`), `Rating` struct (subject, grade, reasoningHash, confidence, timestamp, agentIdentity — **no cid yet**), `RatingPublished` event (**no cid yet**). Phase 3 swaps gate → `ownerOf` + adds `cid` to struct + event.
- `script/Deploy.s.sol` — deploy script to extend with new constructor args (registry address + agent tokenId).

### Reasoning hash + IPFS (reuse Phase 2 — do NOT reimplement)
- `agent/src/hash.ts` — `computeReasoningHash(doc)` + `canonicalizeDoc(doc)` (RFC 8785 JCS + viem keccak256). The publish path pins THESE canonical bytes; Phase 4 frontend re-hashes them. Single source of the hash contract.
- `agent/src/schema.ts` — `ReasoningDoc` zod schema / `ReasoningDocument` type (the JSON being pinned).
- `.planning/phases/02-rating-engine-core/02-CONTEXT.md` → D-13/D-14 (JCS canonical serialization + keccak256 hash-determinism path; Phase 3 publisher + Phase 4 verifier import unchanged).
- `agent/src/rate.ts` — `rate(subject, {blockNumber?, writeToFs, outDir})` → `{ doc, reasoningHash, outPath? }`. The engine entrypoint the publish pipeline wraps; `writeToFs` already emits canonical bytes.

### Subjects + deployment plan
- `.planning/PROJECT.md` → `DEC-subject-set-locked` (USDY/cmETH/FBTC + addresses), `DEC-ipfs-provider-web3storage`, `DEC-onchain-trigger-requestRating`.
- `.planning/PROJECT.md` → `DEC-deployment-target-plan` — ⚠ **PARTIALLY SUPERSEDED for Phase 3 by D-01 above:** Phase 3 identity + gated-publish work runs on **Mantle Mainnet now** (canonical ERC-8004 is Mainnet-only), iterating via a local Mainnet fork rather than Sepolia. Sepolia remains the Phase 1 skeleton's home; Mainnet is where Phase 3 lands.
- `.planning/PROJECT.md` → "Deployed Addresses" — Phase 1 agent EOA `0xb27c7fa15D25E880Ba4a9a508e166538e106F51e` (immutable in the superseded contract); the Phase 3 agent EOA must hold the minted NFT and be MNT-funded on Mainnet.

### Historical proof
- `.planning/PROJECT.md` → `DEC-historical-proof-case` — Elixir deUSD collapse 2025-11-03..06; the four red flags mapped to the four dimensions; CBB0FE analysis 2025-10-28.
- `.planning/phases/01-lock-skeleton/RESEARCH.md` — full Elixir/Stream Finance leverage analysis + pre-failure signal timeline.
- `agent/src/subjects/static.ts` — the static-fact pattern (`STATIC_VERSION`, `staticFact`) to mirror for the Elixir fixture (kept SEPARATE from live adapters).

### Requirements + success criteria
- `.planning/REQUIREMENTS.md` → REQ-02, REQ-03, REQ-04, REQ-06 (acceptance criteria + CON-* constraints).
- `.planning/ROADMAP.md` → Phase 3 section (4 success criteria).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`agent/src/rate.ts` `rate()`** — the full ingest→score→reason→hash pipeline; the publish pipeline (D-03 shared function) wraps this then adds pin + `publishRating`.
- **`agent/src/hash.ts` `computeReasoningHash` / `canonicalizeDoc`** — reuse verbatim for the pinned bytes so the on-chain hash and the Phase 4 re-hash agree (D-02 silent-failure guard).
- **`agent/src/rpc.ts`** — viem `publicClient` (Mantle 5000) + `resolveBlockNumber` + `redactRpcError`. Phase 3 adds a **walletClient** (agent key from root `.env` `PRIVATE_KEY`) for signing `publishRating`; reuse `redactRpcError` on the publish path too.
- **`agent/src/schema.ts`** — `ReasoningDocument` is the exact JSON pinned to IPFS.
- **`src/RatingRegistry.sol` + `script/Deploy.s.sol` + `test/RatingRegistry.t.sol`** — the contract/deploy/test triad to extend (gate swap, `cid` field, `IIdentityRegistry`, negative gate test).
- **`agent/src/subjects/static.ts`** — static-fact construction pattern to mirror for the Elixir historical fixture.

### Established Patterns
- **TDD RED→GREEN** with vitest (agent) + forge (contracts) — used throughout Phases 1-2; continue (esp. the D-01 negative gate test first).
- **Engine-side determinism + canonical hashing** — Phase 2's locked contract; the publisher must not re-introduce non-determinism (no second `latest` read, etc.).
- **Root `.env` via `tsx --env-file-if-exists=../.env`** — agent secrets (`ANTHROPIC_API_KEY`, `MANTLE_RPC_URL`, `PRIVATE_KEY`) live in the project-root `.env`; no agent-local `.env` (T-2-01).

### Integration Points
- **New Solidity:** `IIdentityRegistry` interface (ownerOf), gate swap in `publishRating`, `cid` in struct + event, constructor args (registry addr + tokenId).
- **New agent code:** IPFS pin client (web3.storage), agent walletClient + `publishRating` sender, `RatingRequested` watcher daemon, shared publish pipeline fn, manual `pnpm publish-rating` CLI.
- **New fixture:** Elixir deUSD `SubjectFacts` historical fixture + a one-shot "rate the historical fixture" path producing the graded artifact.
- **Mint step (manual/script, run FIRST):** mint the ERC-8004 Identity NFT on Mantle Mainnet; record the tokenId for the contract constructor.
</code_context>

<specifics>
## Specific Ideas

- Narrative beat to preserve (research "submission gold"): Mantle launched ERC-8004 as autonomous-economy infra → Touchstone is the **first credit-rating agent issuing under it**. The live `ownerOf` gate makes that claim literally enforced on-chain.
- Demo moment (REQ-10): UI fires `requestRating` → watcher reacts → reasoning streams → `publishRating` lands → verifiable hash. The watcher's heartbeat/liveness log is what makes "is it listening?" answerable live.
- Historical proof persuasion is **ordering**: downgrade timestamped before the real failure date.
</specifics>

<deferred>
## Deferred Ideas

- **Live ERC-8004 Reputation Registry accuracy loop** — v2 / cut #1; substituted by the historical-proof designed view. Reputation Registry `0x8004BAa1…` is surfaced as a documented record in Phase 4, not written to live.
- **Real Ethereum-archival adapter for deUSD** — considered (D-04 option 2/3) and deferred in favor of the curated fixture; could be a post-hackathon authenticity upgrade.
- **Validation Registry** integration — Phase 1 research flagged it as "verify before Phase 3 / nice-to-have"; not required for the four Phase 3 success criteria. Out of scope unless trivially available.

None of the above block Phase 3 scope.
</deferred>

---

*Phase: 3-On-Chain Publish + ERC-8004 + Historical Reconstruction Start*
*Context gathered: 2026-06-10*
