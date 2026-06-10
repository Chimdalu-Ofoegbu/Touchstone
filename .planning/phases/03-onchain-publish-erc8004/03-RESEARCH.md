# Phase 3: On-Chain Publish + ERC-8004 + Historical Reconstruction Start — Research

**Researched:** 2026-06-10
**Domain:** viem write-path + event watcher on Mantle Mainnet (5000); headless IPFS pinning (Storacha / Pinata); Solidity ERC-8004 `ownerOf` gate + `cid` struct field (Foundry); ERC-8004 `register()` mint; Elixir deUSD historical fixture
**Confidence:** HIGH (every implementation-critical claim verified against installed versions, official docs, the deployed registry, or the existing codebase). The two formerly-open unknowns (mint surface + headless IPFS auth) were already resolved in CONTEXT.md and are corroborated here.

## Summary

This phase wires the Phase 2 rating engine (`rate()`) to real on-chain state. Five mechanical pieces, in dependency order: (1) **mint** an ERC-8004 Identity NFT from the canonical Mantle Mainnet registry by calling `register(agentURI)` — must happen first, everything downstream gates on the resulting `tokenId`; (2) **redeploy** `RatingRegistry.sol` once with the registry address + tokenId baked in as immutables, swapping the `onlyAgent` EOA check for a live `ownerOf(tokenId) == msg.sender` cross-contract call and adding `string cid` to the struct + event; (3) a **shared publish pipeline** — `rate(subject)` → pin canonical reasoning bytes to IPFS → `walletClient.writeContract(publishRating(...))` → wait for receipt → parse `RatingPublished`; (4) a **watcher daemon** on `RatingRequested` (viem `watchContractEvent` over the public HTTP RPC, which polls via `eth_getLogs`) plus a manual CLI fallback that calls the identical pipeline; (5) the **Elixir deUSD static fixture** rated by the unmodified engine.

The hardest-to-spot risks are not the happy paths — they are three byte/EVM-level traps: (a) the **pinned bytes must equal the hashed bytes** — pin exactly `canonicalizeDoc(doc)`, never `JSON.stringify(doc)` or a re-fetched-and-reserialized object; (b) **`@storacha/client.uploadFile` wraps every file in an IPFS directory and returns a directory CID** — there is no `wrapWithDirectory: false` option, so either store the directory CID and fetch via `/<fixed-filename>`, or use Pinata's `upload.public.file(blob)` which returns a raw-file CID directly; (c) the **forge gate test** for `ownerOf` reverts unless you `vm.etch` dummy code at the registry address *before* `vm.mockCall`, because Solidity emits an `extcodesize` check before the external call.

**Primary recommendation:** Build the publish pipeline as one function reused by watcher + CLI. Pin with **Pinata** (`pinata.upload.public.file(new Blob([canonicalBytes]))` → raw CID, byte-exact, simplest) unless the user has already done the Storacha one-time setup — both code paths are documented below so the planner can pick at task time. Gate via a 1-function `IIdentityRegistry { ownerOf(uint256) }` interface; redeploy to Mainnet exactly once and freeze the ABI. Iterate all agent/contract logic against an Anvil fork of Mantle Mainnet so the live registry's `ownerOf` is real without redeploying.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — ERC-8004 identity gate + network (Mainnet canonical + live `ownerOf` gate):**
- Phase 3 on-chain work runs on **Mantle Mainnet (chain 5000)**, not Sepolia — canonical ERC-8004 Identity Registry is Mainnet-only.
- **Ordering dependency (do FIRST):** mint the agent identity NFT against `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` on Mantle Mainnet **before anything else**. Everything downstream gates on this token existing.
- Store the resulting **`tokenId` and the registry address as immutable constructor args** in RatingRegistry (single source of reference; do not hardcode in multiple places).
- Gate in `publishRating`: `require(IIdentityRegistry(registry).ownerOf(agentTokenId) == msg.sender, "not the rating agent")`. Keep the interface minimal — **only `ownerOf` is needed**.
- **Negative test first, in isolation:** before layering publish logic, write + run the test confirming `publishRating` reverts from a non-agent address and succeeds from the agent EOA.
- **Redeploy RatingRegistry to Mainnet exactly once** with the canonical registry address + agent tokenId baked in. Treat it as the clean ship deploy, NOT an iteration target — iterate remaining logic against a **local fork of Mainnet state**.
- Pin the canonical registry address as a **named constant with a "Mantle Mainnet-only" comment**.

**D-02 — IPFS ↔ on-chain linkage (CID in the struct AND the event):**
- Add a **`string cid`** field to the `Rating` struct alongside grade/reasoningHash/confidence/timestamp.
- Set the CID in the **same `publishRating` call** that writes the hash — never a separate tx. Hash + pointer written **atomically**; never on-chain state with a hash but no retrievable reasoning.
- Also **emit the CID in the `RatingPublished` event**. Struct = canonical contract reads; event = cheap frontend indexing.
- **Lock the final struct ABI before Phase 4.** The gate redeploy is the moment the struct shape freezes — Phase 4 generates types from the **post-redeploy ABI**.
- Store the **bare CID**, not a full gateway URL.
- ⚠ **Silent-failure guard:** canonical serialization MUST be byte-identical on pin side and hash side. Reuse Phase 2's `agent/src/hash.ts` `canonicalizeDoc` for BOTH pin and hash — the pinned bytes must be exactly the bytes that were hashed.

**D-03 — Live publish flow / event listener (shared core pipeline; watcher primary + manual script fallback):**
- Build the **core pipeline once**: `(subject) → run Phase 2 engine → pin reasoning JSON to IPFS → call publishRating signed by the agent key`. Both watcher and manual script call this same function.
- **Watcher (primary, powers REQ-10):** long-running Node process using viem `watchEvent` on `RatingRequested` → invokes the pipeline per event.
- **Manual CLI (fallback):** `pnpm publish-rating <subject>` runs the identical pipeline on demand.
- **Idempotent / double-fire safe:** duplicate publish must be harmless or guarded.
- **Watcher resilience:** `watchEvent` can silently drop on RPC issues — daemon must detect a dead subscription, re-establish it, and log a **heartbeat**.
- **Pre-flight:** check agent EOA MNT balance before the demo. Same key signs both paths.

**D-04 — Historical reconstruction (curated static SubjectFacts fixture, Elixir deUSD, rated by the UNMODIFIED engine):**
- Build the Elixir pre-failure state as a **static `SubjectFacts` fixture** encoding: **$1.00 hardcoded oracle, 65% xUSD concentration, 4.1x leverage, $520M claimed vs $160M actual TVL gap**.
- **Run the unmodified rating engine.** CRITICAL: no special-casing / no engine tuning for Elixir. If the engine needs tweaks to flag Elixir, that is a **finding about the engine**, not a fixture patch.
- **Phase 3 deliverable:** capture the output as a **graded fixture** (grade + per-dimension reasoning citing each red flag).
- **Provenance per fact:** each red flag carries a `sources` reference to its public source (e.g., CBB0FE 2025-10-28).
- **Keep the fixture entirely separate** from live Mantle adapters.

### Claude's Discretion
- Exact Solidity interface name/shape for `IIdentityRegistry` (minimal — `ownerOf` only).
- Watcher reconnect/backoff parameters, heartbeat interval, log format.
- `@storacha/client` wiring details (CID version, store), agent-card JSON contents.
- Fixture file location/naming under `agent/` (separate from `src/subjects/` live adapters).
- Whether the manual publish CLI is a new `agent/src/publish.ts` + `pnpm publish-rating` script or folded into existing CLI surface.

### Deferred Ideas (OUT OF SCOPE)
- Live ERC-8004 Reputation Registry accuracy loop (v2 / cut #1) — Reputation Registry `0x8004BAa1…` surfaced as a documented record in Phase 4, NOT written to live.
- Real Ethereum-archival adapter for deUSD — deferred in favor of the curated fixture.
- Validation Registry integration — out of scope unless trivially available.
- All frontend rendering (Phase 4), Mainnet ship polish + submission (Phase 5).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-02 (real publish) | `RatingRegistry.sol` real `publishRating`; `latestRating`/`ratingHistory` return full struct end-to-end | §4 (Solidity changes: `cid` field + gate swap), §1 (viem write path + receipt parse), Validation Architecture (end-to-end read test on a fork) |
| REQ-03 | ERC-8004 Identity NFT minted + held by agent; `publishRating` gated to identity; identity surfaced in FE | §5 (`register(agentURI)` mint, agent-card schema, capture `agentId`), §4 (`ownerOf` gate + negative test), `agentIdentity` field already in struct |
| REQ-04 | Reasoning JSON pinned to IPFS; on-chain `reasoningHash == keccak256(canonical JSON)`; FE verifies | §3 (both pin providers, byte-exact upload), §2-hash (reuse `canonicalizeDoc` for pin+hash), D-02 atomic write of hash+cid |
| REQ-06 (start) | Pre-failure Elixir deUSD state reconstructed; unmodified engine produces low/deteriorating grade citing the weakness | §6 (Elixir fixture: exact numbers, block, dates, sources, `SubjectFacts` shape), engine-finding discipline (D-04) |

**Success-criteria → research map (from ROADMAP/CONTEXT):**
1. Agent holds ERC-8004 NFT; `publishRating` reverts from non-agent → §5 mint + §4 gate + negative test.
2. Watcher → engine → pin → `publishRating(subject, grade, reasoningHash, confidence, cid)` with `reasoningHash == keccak256(canonical JSON)` → §1 + §2 + §3 + §4.
3. `latestRating`/`ratingHistory` return full struct for ≥1 subject → §1 receipt+read + §4 struct shape.
4. Elixir pre-failure state reconstructed + graded → §6.
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| ERC-8004 identity mint | On-chain (canonical registry) | Agent / one-shot script (caller) | The registry owns the ERC-721; the agent EOA calls `register` and holds the token. Mint is a one-time off-chain-orchestrated tx, not a contract feature of RatingRegistry. |
| Identity enforcement (`ownerOf` gate) | On-chain (RatingRegistry → registry) | — | The gate is a cross-contract call inside `publishRating`; enforcement is purely on-chain at write time. |
| IPFS pinning | Off-chain (agent) | IPFS network (storage) | Pinning is an agent responsibility before the write; only the bare CID lands on-chain. |
| Reasoning hash computation | Off-chain (agent, `hash.ts`) | On-chain (stored as `bytes32`) | The hash is computed off-chain over canonical bytes; the chain only stores + the FE re-verifies. Single source = `hash.ts`. |
| Rating publish (write tx) | Off-chain (agent walletClient) | On-chain (RatingRegistry state + event) | The agent signs; the contract validates the gate + bounds and appends to history. |
| Event watching (`RatingRequested`) | Off-chain (agent daemon) | On-chain (event source) | Watcher is a long-running off-chain process polling the chain; resilience is an agent concern. |
| Historical fixture | Off-chain (static config, separate from live adapters) | Agent engine (rates it) | A demonstration artifact; deliberately NOT on-chain and NOT a live adapter, to keep the "live ratings aren't curated" boundary clean. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `viem` | **2.52.2** (installed; latest is also 2.52.2) | walletClient write path, `watchContractEvent`, `parseEventLogs`, `privateKeyToAccount` | Already the project's RPC layer (`agent/src/rpc.ts`); `mantle` chain preset built in; type-safe ABI inference. [VERIFIED: `npm view viem version` = 2.52.2; installed = 2.52.2] |
| Foundry (`forge`/`cast`/`anvil`) | **1.5.1-stable** (installed) | Contract build/test, `anvil --fork-url` Mainnet fork, deploy, verify | Spec-locked; `anvil --fork-url https://rpc.mantle.xyz` gives a local Mainnet with the real registry for iteration. [VERIFIED: `forge --version` = 1.5.1-stable] |
| Solidity | **^0.8.24** (foundry.toml) | Contract language | Matches existing contract + the canonical registry (compiled 0.8.24). [VERIFIED: foundry.toml `solc = "0.8.24"`] |
| `canonicalize` | **3.0.0** (installed) | RFC 8785 JCS — the byte-exact serialization for pin+hash | Already the cross-phase hash contract in `agent/src/hash.ts`. Do NOT introduce a second serializer. [VERIFIED: agent/package.json] |

### Supporting (IPFS pin — pick ONE; both researched per CONTEXT instruction)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pinata` | **2.5.6** | Headless pin via `PinataSDK` + `upload.public.file(blob)` → **raw-file CID** | **Recommended default.** Single `PINATA_JWT` env var; `upload.public.file(new Blob([bytes]))` returns a raw CID with NO directory wrap → byte-exact fetch is trivial (`{gateway}/ipfs/{cid}`). Simplest under time pressure. [VERIFIED: `npm view pinata version` = 2.5.6; docs.pinata.cloud] |
| `@storacha/client` | **2.1.4** (legacy alias `@web3-storage/w3up-client` 17.3.0) | Headless pin via delegation (`Signer.parse(KEY)` + `Proof.parse(PROOF)` + `StoreMemory`) → **directory CID** | Use if the user completes the one-time Storacha CLI setup (`STORACHA_KEY` + `STORACHA_PROOF` env vars). ⚠ `uploadFile` ALWAYS wraps in a directory and has NO `wrapWithDirectory: false` option — see Pitfall 2. Honors DEC-ipfs-provider-web3storage. [VERIFIED: `npm view @storacha/client version` = 2.1.4; docs.storacha.network] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pinata (raw CID) | Storacha (directory CID) | Storacha honors the original DEC-ipfs-provider-web3storage lock and has a generous free tier, but the directory wrap forces you to store the dir CID + fetch via a fixed filename path. Pinata's raw-CID path is simpler for byte-exact verification. Both preserve exact bytes (IPFS is content-addressed; neither re-serializes). |
| `watchContractEvent` (HTTP poll) | WebSocket subscription | Mantle's public RPC (`https://rpc.mantle.xyz`) is HTTP, so viem auto-polls via `eth_getLogs`/`eth_newFilter`. A WSS endpoint would allow `eth_subscribe`, but adds an endpoint dependency. HTTP polling is more robust for a demo and is the default for non-WS clients. [VERIFIED: viem watchEvent docs] |
| `vm.mockCall` for the gate test | `anvil --fork` against the live registry | `mockCall` is fast + hermetic (CI-friendly) but needs `vm.etch` first (Pitfall 4). A fork test against the real registry is higher-fidelity but slower and network-dependent. Use BOTH: mock for the unit negative-test, fork for one integration smoke. |

**Installation (agent — pick one pin provider):**
```bash
cd agent
pnpm add pinata            # recommended default (raw CID)
# OR
pnpm add @storacha/client  # if using the Storacha delegation path
```
No new Solidity deps — the `IIdentityRegistry` interface is hand-declared (only `ownerOf` needed); `lib/` has only forge-std and that is sufficient. [VERIFIED: `ls lib/` = forge-std only]

**Version verification (run at plan time to reconfirm):**
```bash
npm view viem version            # 2.52.2 as of 2026-06-10
npm view pinata version          # 2.5.6
npm view @storacha/client version# 2.1.4
forge --version                  # 1.5.1-stable
```

## Architecture Patterns

### System Architecture Diagram

```
                         Phase 3 — live publish + identity gate

  ┌─────────────────────── ONE-TIME (FIRST, ordering dependency) ──────────────────────┐
  │  agent EOA  ──register(agentURI)──▶  ERC-8004 Identity Registry 0x8004A169…         │
  │  (one-shot TS/forge script)            └── mints ERC-721, emits Transfer(0→agent,id)│
  │  capture agentId ◀───────────────────────  + Registered(agentId, agentURI, owner)  │
  │  agentURI = ipfs://<cid of agent-card.json> (pinned first)                           │
  └────────────────────────────┬───────────────────────────────────────────────────────┘
                                │ agentId → constructor arg
                                ▼
  ┌──────────────────── REDEPLOY (exactly once, ABI freezes here) ─────────────────────┐
  │  RatingRegistry(registry=0x8004A169…, agentTokenId=<id>)                             │
  │   publishRating gate: require(IIdentityRegistry(registry).ownerOf(tokenId)==sender) │
  │   Rating struct + RatingPublished event gain `string cid`                           │
  └────────────────────────────┬───────────────────────────────────────────────────────┘
                                │
   ┌─────────── WATCHER (daemon, primary) ──────────┐     ┌── MANUAL CLI (fallback) ──┐
   │ publicClient.watchContractEvent(RatingRequested)│     │ pnpm publish-rating <sub> │
   │   onLogs → subject ──┐   heartbeat log + reconnect    │   ──┐ (same pipeline fn)   │
   └──────────────────────┼─────────────────────────┘     └─────┼─────────────────────┘
                          ▼                                      ▼
              ┌───────────────────── SHARED PIPELINE  publishRatingFor(subject) ─────────────┐
              │ 1. rate(subject)  → { doc, reasoningHash }          (Phase 2, unchanged)      │
              │ 2. canonical = canonicalizeDoc(doc)                 (EXACT bytes that hashed) │
              │ 3. cid = pin(new Blob([canonical]))  → bare CID     (Pinata raw | Storacha dir)│
              │ 4. walletClient.writeContract(publishRating(                                  │
              │       subject, grade, reasoningHash, confidence, cid))                         │
              │ 5. receipt = waitForTransactionReceipt(hash)                                  │
              │ 6. [RatingPublished] = parseEventLogs(receipt.logs)  → assert cid + hash match │
              └───────────────────────────────┬───────────────────────────────────────────────┘
                                               ▼
                       RatingRegistry on Mantle Mainnet 5000
                       latestRating(subject) / ratingHistory(subject) → full Rating[]
                       (Phase 4 reads these; re-fetches cid → re-hashes → asserts == reasoningHash)

  ┌──────── HISTORICAL FIXTURE (separate artifact, REQ-06 start) ────────┐
  │ agent/fixtures/elixir-deusd.ts  → SubjectFacts (deUSD pre-failure)   │
  │   → UNMODIFIED engine scores 4 dims → graded doc (citing red flags)  │
  │   NOT on-chain, NOT a live adapter; Phase 4 renders the timeline     │
  └──────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (additions only)
```
agent/src/
├── wallet.ts            # walletClient (privateKeyToAccount(PRIVATE_KEY) + mantle chain) — mirrors rpc.ts
├── ipfs.ts              # pin(canonicalBytes) → cid  (Pinata OR Storacha behind one fn)
├── publish.ts           # publishRatingFor(subject): shared pipeline (rate → pin → write → parse)
├── watch.ts             # RatingRequested daemon (watchContractEvent + heartbeat + reconnect)
├── registry-abi.ts      # RatingRegistry ABI (post-redeploy) for viem write + parse
├── mint-identity.ts     # one-shot: pin agent-card → register(agentURI) → log agentId
└── fixtures/
    └── elixir-deusd.ts  # historical SubjectFacts fixture (SEPARATE from subjects/ live adapters)
src/
├── RatingRegistry.sol   # MODIFIED: IIdentityRegistry gate + `string cid`
├── interfaces/IIdentityRegistry.sol  # minimal: ownerOf(uint256) only
script/
└── Deploy.s.sol         # MODIFIED: constructor(registry, agentTokenId)
test/
└── RatingRegistry.t.sol # MODIFIED: gate negative-test (mockCall + etch) + cid round-trip
```

### Pattern 1: walletClient + writeContract + receipt + parseEventLogs
**What:** Sign and send `publishRating` from the agent key, wait for the receipt, parse the emitted event.
**When to use:** The core of the shared publish pipeline (D-03 step 4-6).
```typescript
// agent/src/wallet.ts — mirror rpc.ts, reuse the same chain + RPC URL
// Source: https://github.com/wevm/viem (createWalletClient / privateKeyToAccount / writeContract)
import { createWalletClient, http, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mantle } from "viem/chains";

const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const MANTLE_RPC_URL = process.env.MANTLE_RPC_URL ?? "https://rpc.mantle.xyz";
export const account = privateKeyToAccount(PRIVATE_KEY);
export const walletClient: WalletClient = createWalletClient({
  account,                 // hoisted — no need to pass account per call
  chain: mantle,           // chain 5000 preset (viem/chains)
  transport: http(MANTLE_RPC_URL, { retryCount: 2, timeout: 15_000 }),
});
```
```typescript
// agent/src/publish.ts (excerpt) — write + wait + parse, all scrubbed via redactRpcError
import { parseEventLogs } from "viem";
import { publicClient, redactRpcError } from "./rpc.js";
import { walletClient, account } from "./wallet.js";
import { ratingRegistryAbi } from "./registry-abi.js";

const REGISTRY = process.env.RATING_REGISTRY_ADDRESS as `0x${string}`;

let hash;
try {
  hash = await walletClient.writeContract({
    address: REGISTRY,
    abi: ratingRegistryAbi,
    functionName: "publishRating",
    args: [subject, grade, reasoningHash, confidence, cid], // cid added per D-02
    account,
    chain: mantle,
  });
} catch (e) { throw redactRpcError(e); }

const receipt = await publicClient.waitForTransactionReceipt({ hash });
const logs = parseEventLogs({ abi: ratingRegistryAbi, eventName: "RatingPublished", logs: receipt.logs });
// Defensive: assert the chain stored the same hash + cid we sent (silent-failure guard, D-02)
if (logs[0].args.reasoningHash !== reasoningHash || logs[0].args.cid !== cid) {
  throw new Error("on-chain RatingPublished diverged from intended hash/cid");
}
```
**Gas/nonce:** viem auto-fills `nonce`, `gas` (via `eth_estimateGas`), and Mantle uses native MNT post-Tectonic — no manual gas token approval. Optionally `publicClient.simulateContract(...)` first to surface a gate revert as a clean error before spending gas. Mantle gas is ~0.02-0.05 gwei; a publish costs well under $0.01. [VERIFIED: viem writeContract docs; Phase 1 RESEARCH gas figures]

### Pattern 2: RatingRequested watcher (HTTP poll, heartbeat, reconnect)
**What:** Long-running daemon; viem `watchContractEvent` over HTTP auto-polls (`eth_getLogs`).
**When to use:** The primary trigger path (REQ-10 demo moment).
```typescript
// agent/src/watch.ts (excerpt)
// Source: https://github.com/wevm/viem watchContractEvent docs — HTTP transport => poll:true
import { publicClient } from "./rpc.js";
import { ratingRegistryAbi } from "./registry-abi.js";
import { publishRatingFor } from "./publish.js";

const REGISTRY = process.env.RATING_REGISTRY_ADDRESS as `0x${string}`;
const inFlight = new Set<string>(); // idempotency guard (D-03 double-fire safe)

function startWatch() {
  return publicClient.watchContractEvent({
    address: REGISTRY,
    abi: ratingRegistryAbi,
    eventName: "RatingRequested",
    pollingInterval: 4_000,
    onLogs: (logs) => {
      for (const log of logs) {
        const subject = log.args.subject as `0x${string}`;
        const key = subject.toLowerCase();
        if (inFlight.has(key)) continue;     // dedupe vs manual CLI / re-emit
        inFlight.add(key);
        publishRatingFor(subjectIdFromAddress(subject))
          .catch((e) => console.error("publish failed", e))
          .finally(() => inFlight.delete(key));
      }
    },
    onError: (err) => {            // silent-drop guard: re-establish on error
      console.error("watch error, reconnecting", err);
      unwatch(); setTimeout(() => { unwatch = startWatch(); }, 2_000);
    },
  });
}
let unwatch = startWatch();
setInterval(() => console.log(`[heartbeat] watching ${REGISTRY} block=${...}`), 15_000); // liveness
```
**Notes:** `subject` is an indexed `address` arg — viem decodes it onto `log.args.subject`. Map address → `SubjectId` (USDY/cmETH/FBTC) before calling `rate()` (the engine takes the ticker, not the address). The heartbeat (`console.log` every 15s) is what makes "is it listening?" answerable live (CONTEXT specifics). [VERIFIED: viem watchContractEvent docs — `onLogs`, `onError`, `poll` default true for non-WS]

### Pattern 3: Headless IPFS pin — byte-exact (two providers)
**What:** Upload the EXACT canonical bytes; get a CID whose gateway-fetched content byte-equals `canonicalizeDoc(doc)`.
```typescript
// agent/src/ipfs.ts — PINATA path (recommended; raw-file CID, no directory wrap)
// Source: docs.pinata.cloud/sdk/upload/public/file
import { PinataSDK } from "pinata";
const pinata = new PinataSDK({ pinataJwt: process.env.PINATA_JWT!, pinataGateway: process.env.PINATA_GATEWAY });
export async function pin(canonical: string): Promise<string> {
  const blob = new Blob([canonical], { type: "application/json" }); // EXACT bytes — no JSON.stringify(doc)
  const { cid } = await pinata.upload.public.file(blob);            // raw-file CID
  return cid;                                                        // store bare CID (D-02)
}
// Fetch back (Phase 4): https://{gateway}/ipfs/{cid}  → byte-equal canonical
```
```typescript
// agent/src/ipfs.ts — STORACHA path (directory CID; needs a FIXED filename + /<name> fetch)
// Source: docs.storacha.network/how-to/upload (Node headless via delegation)
import * as Client from "@storacha/client";
import { StoreMemory } from "@storacha/client/stores/memory";
import * as Proof from "@storacha/client/proof";
import { Signer } from "@storacha/client/principal/ed25519";
const PIN_FILENAME = "reasoning.json"; // FIXED — fetch path depends on it
export async function pin(canonical: string): Promise<string> {
  const principal = Signer.parse(process.env.STORACHA_KEY!);
  const client = await Client.create({ principal, store: new StoreMemory() });
  const space = await client.addSpace(await Proof.parse(process.env.STORACHA_PROOF!));
  await client.setCurrentSpace(space.did());
  const file = new File([canonical], PIN_FILENAME, { type: "application/json" });
  const dirCid = await client.uploadFile(file); // ⚠ ALWAYS directory-wrapped; no wrapWithDirectory option
  return dirCid.toString();                       // store DIRECTORY cid
}
// Fetch back (Phase 4): https://w3s.link/ipfs/{dirCid}/reasoning.json  → byte-equal canonical
//   (note the trailing /reasoning.json — fetching the bare dir CID returns a directory listing, NOT the bytes)
```
**Critical:** Upload `new Blob([canonicalizeDoc(doc)])` — the same string `hash.ts` hashed. Never upload `JSON.stringify(doc)` or a re-parsed object: key order/whitespace would drift and the FE re-hash would fail. IPFS is content-addressed and never re-serializes, so a byte-identical upload always round-trips byte-identical. [VERIFIED: docs.pinata.cloud, docs.storacha.network/how-to/upload + /how-to/retrieve]

### Pattern 4: Solidity gate swap + `cid` field (minimal diff)
**What:** Swap the EOA check for a live `ownerOf` call; add `string cid` to struct + event + signature.
```solidity
// src/interfaces/IIdentityRegistry.sol — minimal (ownerOf only, per D-01 discretion)
interface IIdentityRegistry { function ownerOf(uint256 tokenId) external view returns (address); }
```
```solidity
// src/RatingRegistry.sol (key changes)
/// @dev Mantle Mainnet-ONLY canonical ERC-8004 Identity Registry. Do NOT point at Sepolia. (D-01)
IIdentityRegistry public immutable registry;
uint256 public immutable agentTokenId;

constructor(address registry_, uint256 agentTokenId_) {
    registry = IIdentityRegistry(registry_);
    agentTokenId = agentTokenId_;
}

struct Rating {
    address subject; uint8 grade; bytes32 reasoningHash;
    uint8 confidence; uint256 timestamp; address agentIdentity;
    string cid;                       // D-02: complementary to the hash, written atomically
}
event RatingPublished(
    address indexed subject, uint8 grade, bytes32 reasoningHash,
    uint8 confidence, uint256 timestamp, string cid   // D-02: cheap FE index path
);

modifier onlyAgent() {
    // Live cross-contract call — the new failure surface (test in isolation first, D-01)
    if (registry.ownerOf(agentTokenId) != msg.sender) revert NotAgent();
    _;
}

function publishRating(
    address subject, uint8 grade, bytes32 reasoningHash, uint8 confidence, string calldata cid
) external onlyAgent {
    if (grade > GradeEnum.MAX) revert InvalidGrade();
    if (confidence > 100) revert InvalidConfidence();
    Rating memory r = Rating(subject, grade, reasoningHash, confidence, block.timestamp, msg.sender, cid);
    _history[subject].push(r);
    emit RatingPublished(subject, grade, reasoningHash, confidence, block.timestamp, cid);
}
```
**Note:** the empty-`latestRating` sentinel return must also gain the trailing `""` for `cid` (the zero-value `Rating(address(0),0,bytes32(0),0,0,address(0),"")`). [VERIFIED against current src/RatingRegistry.sol]

### Pattern 5: `register(agentURI)` mint (one-shot)
**What:** Pin the agent-card, call `register(agentURI)`, capture `agentId`.
```typescript
// agent/src/mint-identity.ts (excerpt)
// register(string agentURI) returns (uint256 agentId), selector 0xf2c298be (CONTEXT pre-flight)
const IDENTITY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const; // Mantle Mainnet only
const cardCid = await pin(canonicalAgentCardJson);     // pin the card first
const agentURI = `ipfs://${cardCid}`;                  // or https://… or data: URI (EIP-8004)
const hash = await walletClient.writeContract({
  address: IDENTITY, abi: identityRegistryAbi, functionName: "register", args: [agentURI], account, chain: mantle,
});
const receipt = await publicClient.waitForTransactionReceipt({ hash });
// agentId from the Transfer(0x0 -> agent, agentId) event OR the Registered(agentId, agentURI, owner) event
const [reg] = parseEventLogs({ abi: identityRegistryAbi, eventName: "Registered", logs: receipt.logs });
console.log("agentId =", reg.args.agentId); // bake this into RatingRegistry constructor
```
**agentURI target (EIP-8004 registration-v1 agent card):** required fields `type` (literally `"https://eips.ethereum.org/EIPS/eip-8004#registration-v1"`), `name`, `description`, `image`, `services` (endpoints array), `registrations` (array of `{agentId, agentRegistry}` — can be filled post-mint or left to the verified-domain path); optional `x402Support`, `active`, `supportedTrust`. Pin this small JSON, use `ipfs://<cid>` as the agentURI. Registration is **permissionless** and mints to `msg.sender`. Cost: a single ERC-721 mint, well under $0.01 on Mantle. [VERIFIED: eips.ethereum.org/EIPS/eip-8004; CONTEXT pre-flight selector + permissionless confirmation]

### Anti-Patterns to Avoid
- **Pinning `JSON.stringify(doc)` instead of `canonicalizeDoc(doc)`.** Breaks the FE re-hash. Always pin the exact hashed string.
- **Fetching the bare Storacha directory CID expecting raw bytes.** Returns a directory listing. Append `/reasoning.json` (or use Pinata's raw CID).
- **`vm.mockCall` on the registry without `vm.etch` first.** Reverts on the `extcodesize` pre-check (Pitfall 4).
- **Hardcoding the registry address in multiple places.** D-01 mandates a single immutable + named constant.
- **Pointing the gate at Sepolia.** The canonical registry is Mainnet-only; a Sepolia address silently breaks `ownerOf`.
- **Two separate txs for hash and cid.** D-02 requires atomic write — they go in one `publishRating` call.
- **Re-reading `latest`/chain head inside the publisher.** Phase 2's determinism contract forbids a second snapshot; `rate()` already pins everything.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tx signing + nonce + gas | Manual `eth_sendRawTransaction` + RLP | `viem` `walletClient.writeContract` | Auto nonce/gas-estimate/encode; viem already in the stack |
| Event decoding | Manual topic/data ABI decode | `viem` `parseEventLogs` / `watchContractEvent` `onLogs` | Type-safe arg extraction from ABI |
| Event polling loop | `setInterval` + `eth_getLogs` + cursor | `viem` `watchContractEvent` (auto-polls over HTTP) | Handles filter creation, fallback to `eth_getLogs`, batching |
| IPFS pin/CID computation | Custom UnixFS/CAR builder | `pinata` or `@storacha/client` | CID algorithm + CAR packing + delegation are non-trivial |
| RFC 8785 canonicalization | New serializer for the pin | reuse `agent/src/hash.ts` `canonicalizeDoc` | Two serializers = hash drift = FE verify fails |
| ERC-8004 Identity Registry | Reference ERC-721 deploy | Canonical `0x8004A169…` (call `register`) | Already deployed + verified on Mantle Mainnet (DEC-erc8004-canonical-addresses) |
| ERC-721 ownerOf interface | Import full OpenZeppelin IERC721 | 1-function `IIdentityRegistry { ownerOf }` | Only `ownerOf` is needed; no OZ dep in `lib/` (D-01 discretion) |
| Mainnet iteration | Repeated live redeploys | `anvil --fork-url https://rpc.mantle.xyz` | Real registry `ownerOf` on a free local fork; redeploy live exactly once |

**Key insight:** Every piece here is a documented primitive already adjacent to the codebase. The only bespoke code is the *composition* (the shared pipeline) and the *gate swap* — and the gate swap is a 6-line diff. Time spent hand-rolling signing/polling/CID directly steals Phase 4 UI hours.

## Runtime State Inventory

Phase 3 redeploys the contract and mints a new identity — there is migrated/registered state to track even though most of the phase is greenfield agent code.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | The Sepolia Phase 1 RatingRegistry at `0x54163E309f7C8108F7110B086F640882a97f3838` holds 0 real ratings (only a smoke `requestRating`). No rating data to migrate. The new Mainnet contract starts empty. | None — no data migration. Phase 3 publishes fresh ratings to the new Mainnet address. |
| **Live service config** | None registered yet (no watcher daemon, no Datadog, no n8n). The watcher is *new* in this phase. The minted ERC-8004 token is new state on the live registry. | Mint creates the token (one-time). Record `agentId` in PROJECT.md "Deployed Addresses" + the contract constructor. |
| **OS-registered state** | None. The watcher runs as a foreground Node process for the demo (not a registered service/launchd/Task Scheduler entry). | None — run via `pnpm watch` in a terminal; rehearse the manual fallback (D-03). |
| **Secrets/env vars** | Root `.env` currently has `PRIVATE_KEY`, `MANTLE_RPC_URL`, `MANTLE_SEPOLIA_RPC_URL`, `MANTLE_EXPLORER_KEY`, `ANTHROPIC_API_KEY`. Phase 3 ADDS: `RATING_REGISTRY_ADDRESS` (new Mainnet address), `AGENT_TOKEN_ID` (minted), and pin creds — `PINATA_JWT` (+ optional `PINATA_GATEWAY`) OR `STORACHA_KEY` + `STORACHA_PROOF`. | Add new keys to `.env` + `.env.example` (names only, never values). `PRIVATE_KEY` is reused unchanged — same key mints, deploys, and signs `publishRating`. |
| **Build artifacts** | `out/` (forge artifacts) and `agent/out/` (rating JSON) regenerate on build/run. The post-redeploy ABI in `agent/src/registry-abi.ts` must be regenerated from the NEW contract (it gains the `cid` arg). | Regenerate the ABI after the contract change; Phase 4 generates FE types from this same post-redeploy ABI (D-02 ABI freeze). |

**Canonical reference addresses (verified):** ERC-8004 Identity Registry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` (Mantle Mainnet, ERC-721, `name="AgentIdentity"`, `symbol="AGENT"`); agent EOA `0xb27c7fa15D25E880Ba4a9a508e166538e106F51e` (16.41 MNT funded 2026-06-10). [VERIFIED: CONTEXT pre-flight + PROJECT.md DEC-erc8004-canonical-addresses]

## Common Pitfalls

### Pitfall 1: Pinned bytes ≠ hashed bytes (silent FE verify failure)
**What goes wrong:** FE fetches the CID, re-hashes, and the hash doesn't match `reasoningHash` on-chain — the "verified on Mantle" state never lights up, and it looks like the agent lied.
**Why it happens:** Pinning `JSON.stringify(doc)` (or a re-parsed object) instead of `canonicalizeDoc(doc)`. JCS sorts keys + strips whitespace; plain stringify does not.
**How to avoid:** In the pipeline, compute `const canonical = canonicalizeDoc(doc)` once, pass that exact string to BOTH `computeReasoningHash` (already does this internally) and `pin(canonical)`. Upload `new Blob([canonical])`. Add the in-pipeline assertion (Pattern 1 step 6) comparing the parsed-event `reasoningHash`/`cid` to the intended values.
**Warning signs:** Any `pin(JSON.stringify(...))` or `pin(doc)` call; any second serialization step.

### Pitfall 2: Storacha `uploadFile` returns a DIRECTORY CID (no `wrapWithDirectory` option)
**What goes wrong:** You store the returned CID, the FE fetches `{gateway}/ipfs/{cid}`, and gets an HTML/JSON directory listing instead of the reasoning bytes — re-hash fails.
**Why it happens:** `@storacha/client.uploadFile` ALWAYS wraps a single file in an IPFS directory and returns the directory CID. The README options are only `{retries, signal, onShardStored, shardSize, dedupe}` — **there is no `wrapWithDirectory: false`**. [VERIFIED: upload-service w3up-client README; storacha docs]
**How to avoid:** Two clean options — (a) **use Pinata** (`upload.public.file(blob)` returns a raw-file CID, no wrap) — recommended; or (b) **with Storacha, fix the filename** (`reasoning.json`) and have the FE fetch `https://w3s.link/ipfs/{dirCid}/reasoning.json`. Document the filename convention in the same place as the CID contract. Either way the bytes round-trip exactly (content-addressed).
**Warning signs:** Storing a Storacha CID with no filename convention; FE fetch of a bare directory CID.

### Pitfall 3: Watcher silently drops on HTTP RPC hiccup
**What goes wrong:** Mid-demo the public RPC blips, the poll loop stops, and `requestRating` events stop triggering publishes — with no error surfaced.
**Why it happens:** `watchContractEvent` over HTTP polls; a transport failure fires `onError` but does not auto-resurrect the loop.
**How to avoid:** Implement `onError` → `unwatch()` + re-`startWatch()` with a short backoff (Pattern 2). Emit a heartbeat log every ~15s so liveness is visible. Keep the manual `pnpm publish-rating <subject>` fallback rehearsed (D-03). Pre-check agent MNT balance before the demo.
**Warning signs:** No `onError` handler; no heartbeat; single un-restartable `watchContractEvent` call.

### Pitfall 4: `vm.mockCall` reverts because the registry has no code in the test EVM
**What goes wrong:** The negative gate test (`publishRating` reverts from non-agent) itself reverts in an unexpected way — not from `NotAgent`, but from the `extcodesize` check that Solidity inserts before the external `ownerOf` call, because the test EVM has no contract at the registry address.
**Why it happens:** `vm.mockCall(addr, ...)` only intercepts the call IF `addr` has bytecode. Foundry docs explicitly warn: "Calls to mocked addresses may revert if there is no code at the address."
**How to avoid:** `vm.etch(registryAddr, hex"01")` (any non-empty code) BEFORE `vm.mockCall(registryAddr, abi.encodeWithSelector(IIdentityRegistry.ownerOf.selector, tokenId), abi.encode(agentEOA))`. Then test both branches: mock returns `agentEOA` → publish succeeds; mock returns `nonAgent` → reverts `NotAgent`. Also add ONE `anvil --fork` integration test hitting the real registry for fidelity.
**Warning signs:** Gate test reverting with no/unexpected reason data; `mockCall` with no preceding `etch`.

### Pitfall 5: Engine special-cased to flag Elixir (proof invalidated)
**What goes wrong:** The fixture is rated by a tweaked engine or hand-graded, so the historical proof proves nothing — judges discount it.
**Why it happens:** The unmodified engine produces a less-dramatic grade than hoped, and there's pressure to "help" it.
**How to avoid:** Run `rate()` (or the dimension scorers + synthesize directly) on the Elixir `SubjectFacts` with ZERO engine changes. If the grade isn't bad enough, that is a *finding about the scorers* to surface, not a fixture patch (D-04). The fixture only supplies facts in the exact `SubjectFacts` shape; the engine does the rest.
**Warning signs:** Any `if (subject === "elixir")` branch; hand-authored grade in the fixture.

### Pitfall 6: cmETH/FBTC address → SubjectId mapping in the watcher
**What goes wrong:** `RatingRequested(subject)` carries an *address*; `rate()` takes a *ticker* (`USDY`/`cmETH`/`FBTC`). A missing/incorrect map means the watcher can't rate the requested subject (or rates the wrong one).
**Why it happens:** The engine's allow-list keys on ticker; the event keys on address.
**How to avoid:** Build a frozen `address → SubjectId` lookup from `STATIC` (the addresses are already there). Reject unknown addresses (mirror the CLI's exit-2 allow-list discipline). [VERIFIED against agent/src/subjects/static.ts + cli.ts]

## Code Examples

(See Patterns 1-5 above — all examples are verified against the installed `viem` 2.52.2 API, the live EIP-8004 spec, the Pinata/Storacha docs, and the existing `rpc.ts`/`hash.ts`/`rate.ts`/`RatingRegistry.sol`.)

### Forge gate negative-test (the new failure surface, isolated)
```solidity
// test/RatingRegistry.t.sol (new)
import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";

function setUp() public {
    registryAddr = address(0x8004A169FB4a3325136EB29fA0ceB6D2e539a432);
    vm.etch(registryAddr, hex"01");                 // Pitfall 4: give it code BEFORE mockCall
    reg = new RatingRegistry(registryAddr, AGENT_TOKEN_ID);
}
function test_publishRating_succeedsForAgent() public {
    vm.mockCall(registryAddr,
        abi.encodeWithSelector(IIdentityRegistry.ownerOf.selector, AGENT_TOKEN_ID),
        abi.encode(agent));
    vm.prank(agent);
    reg.publishRating(subject, GradeEnum.BBB, bytes32(uint256(1)), 80, "bafy...");
}
function test_publishRating_revertsForNonAgent() public {
    vm.mockCall(registryAddr,
        abi.encodeWithSelector(IIdentityRegistry.ownerOf.selector, AGENT_TOKEN_ID),
        abi.encode(agent));                          // ownerOf returns the real agent
    vm.prank(nonAgent);                              // but a different address calls
    vm.expectRevert(RatingRegistry.NotAgent.selector);
    reg.publishRating(subject, GradeEnum.AAA, bytes32(uint256(1)), 100, "bafy...");
}
```
[VERIFIED: getfoundry.sh/cheatcodes/mock-call — signature + etch requirement; matches existing test pattern in test/RatingRegistry.t.sol]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `web3.storage` runtime API token | Storacha **delegation** (KEY + PROOF, one-time CLI) | 2024-2025 (w3up rewrite) | No interactive/email step at runtime; headless-safe. `@web3-storage/w3up-client` aliases `@storacha/client`. [VERIFIED: CONTEXT pre-flight + storacha docs] |
| Hardcoded EOA `agent` gate (Phase 1) | Live `ownerOf(tokenId)` cross-contract gate | This phase (D-01) | Identity is enforced against the canonical registry, not a baked address — the "first credit-rating agent issuing under ERC-8004" claim is literally enforced on-chain (narrative beat). |
| `ethers.js` write path | `viem` walletClient | project-wide (Phase 2) | Type-safe ABI inference; one client lib across read + write. |

**Deprecated/outdated:**
- Manual `eth_sendTransaction` + nonce management — superseded by `writeContract`.
- `web3.storage` email-login flow — replaced by delegation for daemons.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The canonical registry emits `Registered(uint256 indexed agentId, string agentURI, address indexed owner)` AND a standard ERC-721 `Transfer(0x0→agent, agentId)` on `register`. | §5 mint | LOW. EIP-8004 specifies both; if the deployed bytecode only emits `Transfer`, capture `agentId` from `Transfer.args.tokenId` instead. Either way `agentId` is recoverable from the receipt. Confirm by reading one event log at mint time. |
| A2 | Pinata `upload.public.file(new Blob([...]))` returns a raw-file CID (no directory wrap) for an in-memory Blob. | §3 Pinata path | LOW. Pinata docs show Blob/File upload returning `{cid}`; the public-IPFS file upload is not directory-wrapped like Storacha. If a directory CID appears, apply the Storacha `/<filename>` fetch convention. Verify by fetching the returned CID once and byte-comparing. |
| A3 | `parseEventLogs`/`watchContractEvent` decode the indexed `subject` arg onto `log.args.subject` for the existing event shapes. | §1, §2 | LOW. Standard viem behavior for indexed args; confirmed by the event definitions in the existing contract. |
| A4 | Storacha env var names are `STORACHA_KEY` / `STORACHA_PROOF`. | Runtime State, §3 | LOW (naming only). CONTEXT says "KEY+PROOF env vars"; the exact names are the planner's choice. Code reads whatever names are agreed; document in `.env.example`. |
| A5 | The agent-card `registrations` array can be empty/omitted at mint and filled later (or via the verified-domain path), since `agentId` isn't known until after the mint tx. | §5 | LOW. EIP-8004 supports the `/.well-known/agent-registration.json` verification as optional; for the demo the on-chain token + URI is sufficient. Chicken-and-egg (need agentId to fill `registrations`, but mint produces agentId) is resolved by pinning the card without `registrations`, or re-pinning post-mint if a verified card is wanted. |

**No assumptions on the security-critical paths** (gate logic, hash determinism, mint permissionlessness) — those are VERIFIED against the live registry (CONTEXT pre-flight) and the existing codebase.

## Open Questions

1. **Storacha vs Pinata final lock.**
   - What we know: both headless paths work; Pinata's raw CID is simpler for byte-exact verify; Storacha honors DEC-ipfs-provider-web3storage.
   - What's unclear: whether the user has completed the Storacha one-time CLI setup (the `STORACHA_KEY`/`STORACHA_PROOF` todo is still ⬜ in CONTEXT).
   - Recommendation: write `ipfs.ts` with a single `pin(canonical)` interface; default to Pinata (one `PINATA_JWT`) and keep the Storacha implementation behind the same function so switching is a one-line change. Let the planner sequence "user provides creds" as a prerequisite task.

2. **cmETH/FBTC engine grade spread (carryover from Phase 2 UAT).**
   - What we know: USDY rated BBB live; cmETH/FBTC not yet run live (API budget). All three share one code path.
   - What's unclear: whether the spread is demo-worthy without tuning.
   - Recommendation: out of scope for Phase 3 wiring, but the watcher demo (REQ-10) will exercise these live — surface any flat-grade finding to the user, don't tune.

3. **Agent-card `registrations` self-reference.**
   - What we know: `agentId` is only known after the mint tx.
   - Recommendation: pin the card WITHOUT `registrations` (or with a placeholder), mint, capture `agentId`; optionally re-pin a complete card afterward if a fully-verified card is desired. Not a blocker for the four success criteria.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| viem | write path, watcher | ✓ | 2.52.2 (installed) | — |
| Foundry (forge/cast/anvil) | contract build/test/fork/deploy | ✓ | 1.5.1-stable | — |
| Node | agent runtime | ✓ | v24.15.0 | — |
| `pinata` OR `@storacha/client` | IPFS pin | ✗ (not yet installed) | 2.5.6 / 2.1.4 | `pnpm add` at task time; pick one |
| `PINATA_JWT` OR `STORACHA_KEY`+`STORACHA_PROOF` | pin auth | ✗ (user must provide) | — | Pinata JWT is the single-value simpler option |
| Agent EOA MNT balance | mint + redeploy + publish gas | ✓ | 16.41 MNT | — (covers everything; deploys <$1) |
| Mantle Mainnet RPC | all on-chain ops | ✓ | `https://rpc.mantle.xyz` | dRPC/QuickNode/Chainstack if public RPC rate-limits |
| `anvil --fork-url https://rpc.mantle.xyz` | local iteration vs real registry | ✓ (forge installed) | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:**
- Pin provider package + creds — install one provider and supply its single secret. This is the only user-action prerequisite (already tracked ⬜ in CONTEXT Execution Prerequisites). Pinata (`PINATA_JWT`) is the lowest-friction path.

## Validation Architecture

> `workflow.nyquist_validation` is not set in `.planning/config.json` (only `model_profile`), so validation is treated as enabled. This phase is highly verifiable (gate enforcement, hash equality, end-to-end read).

### Test Framework
| Property | Value |
|----------|-------|
| Framework (agent) | vitest 4.1.8 — config `agent/vitest.config.ts`, `include: tests/**/*.test.ts`, `exclude: tests/**/*.live.test.ts`, `testTimeout: 15_000` |
| Framework (contracts) | Foundry forge 1.5.1-stable — `test/`, `solc 0.8.24` |
| Quick run (agent) | `cd agent && pnpm test` (vitest run; excludes `.live.test.ts`) |
| Quick run (contracts) | `forge test -q` |
| Full suite | `cd agent && pnpm test && pnpm typecheck` + `forge test` (Phase 2 baseline: 191/191 vitest green, typecheck clean) |
| Live/fork run | `RUN_LIVE=1 vitest run` (excluded by default) for any `*.live.test.ts`; `forge test --fork-url https://rpc.mantle.xyz` for fork integration |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-03 | `publishRating` reverts from non-agent (mock `ownerOf` ≠ sender) | unit (Solidity) | `forge test --match-test test_publishRating_revertsForNonAgent` | ❌ Wave 0 (extend test/RatingRegistry.t.sol) |
| REQ-03 | `publishRating` succeeds when `ownerOf(tokenId) == msg.sender` | unit (Solidity) | `forge test --match-test test_publishRating_succeedsForAgent` | ❌ Wave 0 |
| REQ-03 | Gate against the REAL registry on a fork | integration | `forge test --fork-url https://rpc.mantle.xyz --match-contract RatingRegistryForkTest` | ❌ Wave 0 |
| REQ-02 | `latestRating`/`ratingHistory` return full struct incl. `cid` after publish | unit (Solidity) | `forge test --match-test test_latestRating_returnsCid` | ❌ Wave 0 (extend existing returnsLast/returnsAll for the new `cid` field) |
| REQ-04 | Pinned bytes == hashed bytes (round-trip) | unit (agent) | `cd agent && pnpm test ipfs` | ❌ Wave 0 (`tests/ipfs.test.ts` — mock pin, assert input Blob bytes === canonicalizeDoc) |
| REQ-04 | `reasoningHash` sent to chain == `computeReasoningHash(doc)` | unit (agent) | `cd agent && pnpm test publish` | ❌ Wave 0 (`tests/publish.test.ts` — mock walletClient, assert args[2]) |
| REQ-02/04 | End-to-end: publish then read back hash+cid (anvil fork) | integration | `cd agent && RUN_LIVE=1 vitest run tests/publish.live.test.ts` | ❌ Wave 0 (against `anvil --fork`) |
| REQ-10 | Watcher invokes pipeline once per `RatingRequested`, dedupes double-fire | unit (agent) | `cd agent && pnpm test watch` | ❌ Wave 0 (`tests/watch.test.ts` — inject fake log, assert pipeline called once) |
| REQ-06 | Unmodified engine on Elixir fixture → low/deteriorating grade citing red flags | unit (agent) | `cd agent && pnpm test elixir` | ❌ Wave 0 (`tests/fixtures/elixir.test.ts` — rate fixture, assert grade ≤ threshold + citations name the 4 flags) |
| REQ-03 | `register(agentURI)` mint captures agentId | manual / one-shot | run `pnpm mint-identity` once, observe `agentId` in log + Mantlescan | n/a (one-time script; verified by on-chain `ownerOf(agentId) == agentEOA`) |

### Sampling Rate
- **Per task commit:** `forge test -q` (contracts) and/or `cd agent && pnpm test <area>` (agent) — both < 30s.
- **Per wave merge:** `forge test && cd agent && pnpm test && pnpm typecheck`.
- **Phase gate:** full suite green + one anvil-fork end-to-end publish-then-read + the live mint confirmed on Mantlescan, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `test/RatingRegistry.t.sol` — extend: gate negative/positive tests (mockCall + etch), `cid` round-trip in latestRating/ratingHistory, fork integration contract. (Existing tests must update for the new `string cid` constructor/struct/signature.)
- [ ] `src/interfaces/IIdentityRegistry.sol` — new minimal interface (so tests can reference `ownerOf.selector`).
- [ ] `agent/tests/ipfs.test.ts` — byte-exact pin round-trip (mock provider).
- [ ] `agent/tests/publish.test.ts` — pipeline asserts hash/cid args (mock walletClient + mock pin).
- [ ] `agent/tests/watch.test.ts` — dedupe + single-invoke (inject fake logs).
- [ ] `agent/tests/fixtures/elixir.test.ts` + `agent/src/fixtures/elixir-deusd.ts` — fixture + unmodified-engine grade assertion.
- [ ] `agent/tests/publish.live.test.ts` — anvil-fork end-to-end (RUN_LIVE-gated; excluded from default run).
- [ ] No framework install needed — vitest + forge both present.

## Security Domain

> `security_enforcement` not set to `false` in config → included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | On-chain identity = ERC-8004 `ownerOf(tokenId) == msg.sender` (the agent gate). Off-chain: the agent's `PRIVATE_KEY` is the sole signing authority — keep in root `.env`, never logged. |
| V3 Session Management | no | No sessions; stateless tx signing. |
| V4 Access Control | yes | `publishRating` is the only privileged write; gated by `onlyAgent` (live `ownerOf`). `requestRating`/views are public by design (DEC-onchain-trigger-requestRating). Negative gate test is mandatory (D-01). |
| V5 Input Validation | yes | On-chain: `grade ≤ 9` (InvalidGrade), `confidence ≤ 100` (InvalidConfidence) already enforced — keep them. Off-chain: subject address allow-list (USDY/cmETH/FBTC); reject unknown `RatingRequested` subjects (mirror CLI exit-2). Citation validation (`validateCitations`, T-2-07) already in `rate()`. |
| V6 Cryptography | yes | keccak256 via viem (never hand-roll); RFC 8785 JCS via `canonicalize`. The hash is the integrity anchor — pinned bytes must equal hashed bytes (Pitfall 1). |
| V7 Secrets / Logging | yes | `redactRpcError`/`redactRpcUrl` already scrub the keyed RPC URL; `synthesize.ts` scrubs `ANTHROPIC_API_KEY`. Phase 3 must run the publish path's catches through `redactRpcError` too, and never log `PRIVATE_KEY`/`PINATA_JWT`/`STORACHA_KEY`. |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged rating from a non-agent address | Spoofing | `ownerOf(tokenId) == msg.sender` gate; negative test proves the revert |
| On-chain hash with no/unretrievable reasoning (orphan hash) | Tampering / Repudiation | Atomic hash+cid write in one `publishRating` tx (D-02); never two txs |
| Pinned reasoning silently differs from hashed reasoning | Tampering | Single canonicalizer for pin+hash; in-pipeline assert vs parsed event (Pattern 1) |
| Secret leakage via error message / log | Information Disclosure | `redactRpcError` on every RPC catch; no secret in stdout/stderr/JSON (T-2-01/03 pattern, extend to publish + pin paths) |
| Watcher double-fire corrupting state | Tampering | History is append-only + idempotency `inFlight` guard; duplicate publish is harmless (D-03) |
| Out-of-gas mid-demo | Denial of Service | Pre-flight MNT balance check before the demo (D-03); agent funded 16.41 MNT |
| Pointing the gate at the wrong network (Sepolia) | Tampering (silent gate bypass/break) | Named constant + "Mantle Mainnet-only" comment + immutable; fork tests use the real Mainnet address |

## Sources

### Primary (HIGH confidence)
- Installed codebase: `agent/src/rate.ts`, `hash.ts`, `rpc.ts`, `cli.ts`, `schema.ts`, `subjects/{types,static}.ts`, `src/RatingRegistry.sol`, `script/Deploy.s.sol`, `test/RatingRegistry.t.sol`, `foundry.toml`, `agent/package.json`, `agent/vitest.config.ts`, `.env`/`.env.example` — read directly this session.
- `npm view` (2026-06-10): viem 2.52.2, pinata 2.5.6, @storacha/client 2.1.4, @web3-storage/w3up-client 17.3.0. `forge --version` 1.5.1-stable; `node` v24.15.0.
- viem docs (Context7 `/wevm/viem`): `createWalletClient`/`privateKeyToAccount`/`writeContract`/`waitForTransactionReceipt`/`parseEventLogs`/`watchContractEvent` (HTTP poll default, `onLogs`/`onError`).
- EIP-8004 spec (eips.ethereum.org/EIPS/eip-8004): `register` overloads, agent-card registration-v1 schema, `Registered` event, permissionless registration.
- Foundry cheatcodes (getfoundry.sh/cheatcodes/mock-call): `mockCall` signature + the `extcodesize`/`vm.etch` requirement.
- `.planning/PROJECT.md` (DEC-erc8004-canonical-addresses, DEC-historical-proof-case), `.planning/phases/01-lock-skeleton/RESEARCH.md` (Elixir numbers, registry verification, Mantle params), `03-CONTEXT.md` (D-01..D-04 + resolved pre-flight).

### Secondary (MEDIUM confidence)
- docs.pinata.cloud/sdk/upload/public/file — `PinataSDK`, `upload.public.file(blob)` → `{cid}`, Blob/File in-memory upload, gateway URL.
- docs.storacha.network (how-to/upload, how-to/retrieve, concepts/ipfs-gateways) + upload-service `w3up-client` README — headless delegation flow; `uploadFile` directory-wrap with no `wrapWithDirectory` option; `w3s.link/ipfs/{cid}/{file}` fetch.
- Elixir/Stream Finance collapse coverage (BlockEden, BeInCrypto, Cryptopolitan, The Block) — Nov 4 ($93M disclosed), Nov 6 (deUSD shutdown), 98% drop, 65% Stream exposure (~$68M private Morpho), $285M cross-protocol exposure.

### Tertiary (LOW confidence)
- None load-bearing. The two former unknowns are corroborated by primary sources (live registry + official docs).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version verified against the installed tree + registry.
- viem write/watch path: HIGH — official docs + matches existing `rpc.ts` patterns.
- IPFS pin (both providers): HIGH for Pinata raw-CID, HIGH for the Storacha directory-wrap gotcha (verified in two sources); MEDIUM only on the exact env var names (planner's choice).
- Solidity gate + cid: HIGH — minimal diff against the read contract; mockCall/etch pitfall verified in Foundry docs.
- ERC-8004 mint: HIGH — EIP spec + CONTEXT live-registry pre-flight.
- Elixir fixture: HIGH on the four red-flag numbers + dates (cross-sourced); the `SubjectFacts` shape it must produce is verified against `types.ts`/`static.ts`.

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (stable; viem/Foundry/registry unlikely to move in the ship window). Re-confirm `npm view` versions if planning slips past the hackathon.
