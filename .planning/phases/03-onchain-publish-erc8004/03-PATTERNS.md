# Phase 3: On-Chain Publish + ERC-8004 + Historical Reconstruction Start - Pattern Map

**Mapped:** 2026-06-10
**Files analyzed:** 11 (3 MODIFIED Solidity/test, 1 NEW Solidity interface, 7 NEW agent modules + 1 fixture)
**Analogs found:** 9 / 11 (2 net-new flagged: watcher daemon, mint one-shot)

All file paths below are absolute from the repo root `C:\Users\Ben\Desktop\B3NSAG3\Hackathons\Mantle - Turing\Touchstone`. Excerpts use relative paths for readability; line numbers are exact against the files read 2026-06-10.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/RatingRegistry.sol` (MODIFY) | contract / model | CRUD (append-only) | itself (current) | exact (self-edit) |
| `src/interfaces/IIdentityRegistry.sol` (NEW) | interface | request-response (external call) | inline `parseAbi` ABIs in adapters | role-match |
| `script/Deploy.s.sol` (MODIFY) | config / deploy | batch (one-shot) | itself (current) | exact (self-edit) |
| `test/RatingRegistry.t.sol` (MODIFY) | test | CRUD round-trip + gate | itself (current) | exact (self-edit) |
| `agent/src/wallet.ts` (NEW) | config / client | request-response (write) | `agent/src/rpc.ts` | role-match (publicClient → walletClient) |
| `agent/src/ipfs.ts` (NEW) | service | file-I/O (pin/upload) | `agent/src/rpc.ts` (client construction) | partial (client-construction shape only) |
| `agent/src/registry-abi.ts` (NEW) | config | n/a (static data) | `agent/src/subjects/static.ts` (versioned const export) | role-match |
| `agent/src/publish.ts` (NEW) | service / orchestrator | transform → write → event-parse | `agent/src/rate.ts` (`rate()` orchestrator) | role-match |
| `agent/src/watch.ts` (NEW) | service / daemon | event-driven (poll) | **none** | NET-NEW |
| `agent/src/mint-identity.ts` (NEW) | utility / one-shot | request-response (write + event) | `script/Deploy.s.sol` + `agent/src/cli.ts` | partial |
| `agent/src/publish-cli.ts` (NEW; or fold into cli.ts) | utility / CLI | request-response | `agent/src/cli.ts` | exact |
| `agent/src/fixtures/elixir-deusd.ts` (NEW) | fixture / model | static (SubjectFacts build) | `agent/src/subjects/usdy.ts` + `static.ts` | role-match |

> **CONTEXT D-03 discretion:** the manual CLI may be a new `agent/src/publish-cli.ts` + `pnpm publish-rating` script OR folded into the existing `cli.ts` surface. Either way the analog is `cli.ts` (below). The shared pipeline `publish.ts` is the load-bearing artifact; CLI and watcher are thin callers.

---

## Pattern Assignments

### `src/RatingRegistry.sol` (contract, CRUD append-only) — MODIFY

**Analog:** the current `src/RatingRegistry.sol` (self-edit; this is the contract being extended).

The full current contract was read (118 lines). The Phase 3 diff is ~6 lines per RESEARCH Pattern 4. Mirror the existing natspec density and error-revert style. Four concrete touch points:

**1. Add immutable constructor args (replaces the single `agent` immutable, lines 25-30, 63-66):**
Current:
```solidity
address public immutable agent;                       // line 30
constructor(address initialAgent) { agent = initialAgent; }   // lines 64-66
```
New shape (RESEARCH §4):
```solidity
/// @dev Mantle Mainnet-ONLY canonical ERC-8004 Identity Registry. Do NOT point at Sepolia. (D-01)
IIdentityRegistry public immutable registry;
uint256 public immutable agentTokenId;
constructor(address registry_, uint256 agentTokenId_) {
    registry = IIdentityRegistry(registry_);
    agentTokenId = agentTokenId_;
}
```
Keep the "named constant + Mainnet-only comment" discipline (D-01). The registry address is passed at deploy time, NOT hardcoded in the contract body (single source of reference).

**2. Swap the `onlyAgent` modifier (current lines 57-61) for a live `ownerOf` call:**
Current:
```solidity
modifier onlyAgent() {
    if (msg.sender != agent) revert NotAgent();
    _;
}
```
New (the new failure surface — test in isolation FIRST, D-01):
```solidity
modifier onlyAgent() {
    // Live cross-contract call to the canonical ERC-8004 Identity Registry.
    if (registry.ownerOf(agentTokenId) != msg.sender) revert NotAgent();
    _;
}
```
`NotAgent()` error already exists (line 51) — reuse it; the negative test (below) expects `RatingRegistry.NotAgent.selector`.

**3. Add `string cid` to the struct (current lines 16-23) and the event (current lines 36-42):**
Current struct ends at `address agentIdentity;` (line 22). Add `string cid;` after it.
Current event ends at `uint256 timestamp` (line 41). Add `, string cid` after it.
Mirror the existing `Rating memory r = Rating({ ... })` named-field construction (current lines 87-94) — append `cid: cid`.

**4. Update `publishRating` signature (current lines 79-97) and the empty-`latestRating` sentinel (current line 109):**
Current signature: `publishRating(address subject, uint8 grade, bytes32 reasoningHash, uint8 confidence)`. Add `, string calldata cid`. Keep the existing bounds checks verbatim:
```solidity
if (grade > GradeEnum.MAX) revert InvalidGrade();      // line 85 — keep
if (confidence > 100) revert InvalidConfidence();      // line 86 — keep
```
Current emit (line 96): append `, cid`.
Current sentinel (line 109): `return Rating(address(0), 0, bytes32(0), 0, 0, address(0));` → add a trailing `, ""` for the new `cid` field (RESEARCH §4 note — positional ctor must gain the empty string).

---

### `src/interfaces/IIdentityRegistry.sol` (interface, external call) — NEW

**Analog:** the inline `parseAbi([...])` minimal-surface pattern in `agent/src/subjects/usdy.ts` lines 24-27 (declare ONLY the functions you call). Solidity equivalent: a 1-function interface. No OpenZeppelin import — `lib/` has only forge-std (RESEARCH "Don't Hand-Roll").

**Core pattern** (RESEARCH §4, D-01 discretion — `ownerOf` only):
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface IIdentityRegistry {
    function ownerOf(uint256 tokenId) external view returns (address);
}
```
Match the existing file header convention (`// SPDX-License-Identifier: MIT` + `pragma solidity ^0.8.24;`) seen in every `src/*.sol` file (e.g. `src/RatingRegistry.sol` lines 1-2, `src/constants/GradeEnum.sol` lines 1-2).

---

### `script/Deploy.s.sol` (config/deploy, one-shot) — MODIFY

**Analog:** the current `script/Deploy.s.sol` (self-edit; 22 lines, read in full).

Current constructor call (line 17): `registry = new RatingRegistry(deployer);`. Phase 3 passes the canonical registry address + minted tokenId instead. Mirror the existing `vm.envUint` / `vm.addr` / `console2.log` / `vm.startBroadcast`/`vm.stopBroadcast` structure verbatim — only the constructor args change.

**Current pattern to preserve** (lines 11-21):
```solidity
function run() external returns (RatingRegistry registry) {
    uint256 deployerKey = vm.envUint("PRIVATE_KEY");
    address deployer = vm.addr(deployerKey);
    console2.log("Deployer (will be initial agent):", deployer);
    vm.startBroadcast(deployerKey);
    registry = new RatingRegistry(deployer);          // ← change this line
    vm.stopBroadcast();
    console2.log("RatingRegistry deployed at:", address(registry));
}
```
**New constructor call** (the only behavioral change):
```solidity
address constant IDENTITY_REGISTRY = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432; // Mantle Mainnet ONLY (D-01)
uint256 agentTokenId = vm.envUint("AGENT_TOKEN_ID");  // minted in the FIRST ordering step
registry = new RatingRegistry(IDENTITY_REGISTRY, agentTokenId);
```
Update the stale natspec at lines 7-9 (currently says "Phase 3 will swap … without a redeploy" — D-01 supersedes this: it IS a redeploy, exactly once, on Mainnet).

---

### `test/RatingRegistry.t.sol` (test, CRUD round-trip + gate) — MODIFY

**Analog:** the current `test/RatingRegistry.t.sol` (self-edit; 120 lines, read in full) + RESEARCH §"Forge gate negative-test".

Preserve the existing test-class structure: the re-declared events block (current lines 16-27 — must gain `string cid` in `RatingPublished` to match the new event), `setUp()` (lines 29-32), `vm.prank`/`vm.expectRevert`/`vm.expectEmit` idioms, and the per-test natspec citing the verification-map ID.

**Critical setUp change (Pitfall 4 — `vm.etch` BEFORE `vm.mockCall`):**
Current `setUp` (lines 29-32) constructs `new RatingRegistry(agent)`. New shape per RESEARCH §gate-test:
```solidity
function setUp() public {
    registryAddr = address(0x8004A169FB4a3325136EB29fA0ceB6D2e539a432);
    vm.etch(registryAddr, hex"01");                 // Pitfall 4: code MUST exist before mockCall
    registry = new RatingRegistry(registryAddr, AGENT_TOKEN_ID);
}
```

**Gate negative test (the new failure surface, in isolation FIRST per D-01)** — mirror the existing `test_publishRating_rejectsNonAgent` (current lines 35-39) but add the `vm.mockCall`:
```solidity
function test_publishRating_revertsForNonAgent() public {
    vm.mockCall(registryAddr,
        abi.encodeWithSelector(IIdentityRegistry.ownerOf.selector, AGENT_TOKEN_ID),
        abi.encode(agent));                          // ownerOf returns the real agent
    vm.prank(nonAgent);                              // but a different address calls
    vm.expectRevert(RatingRegistry.NotAgent.selector);
    registry.publishRating(subject, GradeEnum.AAA, bytes32(uint256(1)), 100, "bafy...");
}
function test_publishRating_succeedsForAgent() public {
    vm.mockCall(registryAddr,
        abi.encodeWithSelector(IIdentityRegistry.ownerOf.selector, AGENT_TOKEN_ID),
        abi.encode(agent));
    vm.prank(agent);
    registry.publishRating(subject, GradeEnum.BBB, bytes32(uint256(1)), 80, "bafy...");
}
```

**Existing tests to UPDATE for the new signature + `cid`:** every `registry.publishRating(...)` call in the current file (lines 38, 44, 47, 53, 59, 61, 67, 71, 94, 95, 111, 112, 113) gains a trailing `cid` arg; under the new gate each must run inside a `vm.mockCall`(ownerOf→agent) + `vm.prank(agent)` context (the old tests relied on `agent = address(this)` at line 30 — that no longer satisfies the `ownerOf` gate). The `cid` round-trip assertion mirrors the existing `assertEq(latest.reasoningHash, ...)` style (current lines 99-101): add `assertEq(latest.cid, "bafy...")`. Add `import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";`.

---

### `agent/src/wallet.ts` (config/client, write) — NEW

**Analog:** `agent/src/rpc.ts` (71 lines, read in full). This is the write-side twin of the read-side `publicClient`. Mirror its module-doc-comment style, the `MANTLE_RPC_URL ?? "https://rpc.mantle.xyz"` fallback, the `http(..., { retryCount: 2, timeout: 15_000 })` transport options, and the named `export const` client.

**Imports pattern** (mirror `rpc.ts` lines 12-13 + add accounts):
```typescript
import { createWalletClient, http, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mantle } from "viem/chains";
```

**Core pattern** (RESEARCH §1; `PRIVATE_KEY` read from root `.env` exactly like `rpc.ts` reads `MANTLE_RPC_URL`):
```typescript
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const MANTLE_RPC_URL = process.env.MANTLE_RPC_URL ?? "https://rpc.mantle.xyz";
export const account = privateKeyToAccount(PRIVATE_KEY);
export const walletClient: WalletClient = createWalletClient({
  account,
  chain: mantle,
  transport: http(MANTLE_RPC_URL, { retryCount: 2, timeout: 15_000 }),
});
```
**Reuse, do not re-implement:** `redactRpcError` from `rpc.ts` (lines 64-67) — the write path's catch blocks must funnel through it (same T-2-03 secret-scrub discipline as the read path; see `rate.ts` lines 147-151 for the established catch idiom).

---

### `agent/src/ipfs.ts` (service, file-I/O pin) — NEW

**Analog:** `agent/src/rpc.ts` client-construction pattern (module-level singleton client built from an env secret + a single exported async function). There is no existing IPFS code — this is the client-construction *shape* mirrored onto a new dependency.

**Established conventions to honor:**
- Secrets from root `.env` only (`PINATA_JWT` or `STORACHA_KEY`+`STORACHA_PROOF`) — T-2-01, same as `ANTHROPIC_API_KEY`/`PRIVATE_KEY` (see `cli.ts` line 13 `tsx --env-file-if-exists=../.env`).
- Single exported function `pin(canonical: string): Promise<string>` returning the **bare CID** (D-02) — a one-function public surface like `rpc.ts`'s `resolveBlockNumber`.
- ⚠ **Silent-failure guard (Pitfall 1):** the input MUST be the exact `canonicalizeDoc(doc)` string from `hash.ts` (lines 31-39) — upload `new Blob([canonical])`, never `JSON.stringify(doc)`.

**Core pattern (Pinata, recommended default — raw-file CID, RESEARCH §3):**
```typescript
import { PinataSDK } from "pinata";
const pinata = new PinataSDK({ pinataJwt: process.env.PINATA_JWT!, pinataGateway: process.env.PINATA_GATEWAY });
export async function pin(canonical: string): Promise<string> {
  const blob = new Blob([canonical], { type: "application/json" }); // EXACT hashed bytes
  const { cid } = await pinata.upload.public.file(blob);            // raw-file CID, no dir wrap
  return cid;                                                        // bare CID (D-02)
}
```
**Storacha alternative (directory CID — needs a FIXED filename; Pitfall 2):** RESEARCH §3 second block. Keep both behind the same `pin()` signature so switching is one-line (Open Question 1). Flag for planner: pin-provider package + creds are the only user-action prerequisite (CONTEXT prereq ⬜).

---

### `agent/src/registry-abi.ts` (config, static data) — NEW

**Analog:** `agent/src/subjects/static.ts` lines 14, 38 (`export const STATIC_VERSION` + `export const STATIC` — a versioned, named static-data const export). Mirror that "named const, module-doc header, locked-to-Mantle comment" style.

**Core pattern:** export the post-redeploy `RatingRegistry` ABI fragment as a `const` (typed `as const` for viem inference), covering at minimum `publishRating`, `RatingPublished`, `RatingRequested`, `latestRating`, `ratingHistory`. Generated from the **post-redeploy** artifact (`out/RatingRegistry.sol/RatingRegistry.json`) — RESEARCH Runtime State: regenerate after the contract change; Phase 4 FE types derive from this same frozen ABI (D-02 ABI freeze). Imported by `publish.ts` and `watch.ts` exactly as `rate.ts` imports `STATIC`/typed configs.

---

### `agent/src/publish.ts` (service/orchestrator, transform→write→event-parse) — NEW

**Analog:** `agent/src/rate.ts` `rate()` (305 lines, read in full) — the established pipeline-orchestrator pattern: a single exported async function composing imported steps, with a typed result and inline determinism/secret-scrub discipline. `publish.ts` WRAPS `rate()` (it is a downstream stage), per CONTEXT code_context "the publish pipeline wraps this then adds pin + publishRating".

**Imports pattern** (mirror `rate.ts` lines 49-51 + add wallet/ipfs/abi — RESEARCH §1):
```typescript
import { parseEventLogs } from "viem";
import { rate } from "./rate.js";
import { canonicalizeDoc } from "./hash.js";              // reuse — single hash contract
import { publicClient, redactRpcError } from "./rpc.js";  // reuse waitForTxReceipt + scrub
import { walletClient, account } from "./wallet.js";
import { ratingRegistryAbi } from "./registry-abi.js";
import type { SubjectId } from "./subjects/types.js";
```

**Core pipeline pattern** — the D-03 shared function `publishRatingFor(subject)`, the single source of publish logic (watcher + CLI both call it). Steps (RESEARCH §1 + diagram):
```typescript
const REGISTRY = process.env.RATING_REGISTRY_ADDRESS as `0x${string}`;
export async function publishRatingFor(subject: SubjectId) {
  const { doc, reasoningHash } = await rate(subject);          // Phase 2 engine, unchanged
  const canonical = canonicalizeDoc(doc);                      // EXACT bytes that hashed (Pitfall 1)
  const cid = await pin(canonical);                            // bare CID
  const grade = doc.grade.uint8;
  const confidence = doc.confidence;                           // 0..100 (matches on-chain bound)
  let hash;
  try {
    hash = await walletClient.writeContract({
      address: REGISTRY, abi: ratingRegistryAbi, functionName: "publishRating",
      args: [doc.subject.address, grade, reasoningHash, confidence, cid],
      account, chain: mantle,
    });
  } catch (e) { throw redactRpcError(e); }                     // reuse rpc.ts scrub (rate.ts lines 147-151 idiom)
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const logs = parseEventLogs({ abi: ratingRegistryAbi, eventName: "RatingPublished", logs: receipt.logs });
  // D-02 silent-failure guard: assert the chain stored what we sent
  if (logs[0].args.reasoningHash !== reasoningHash || logs[0].args.cid !== cid)
    throw new Error("on-chain RatingPublished diverged from intended hash/cid");
  return { cid, reasoningHash, txHash: hash };
}
```
**Determinism note (CONTEXT Established Patterns):** do NOT re-read `latest`/chain head inside the publisher — `rate()` already pins everything (mirror the CR-04 discipline documented in `rate.ts` lines 128-153). Grade/confidence come straight from the returned `doc`, not a second engine pass.

---

### `agent/src/watch.ts` (service/daemon, event-driven poll) — NEW — ⚠ NET-NEW

**Analog: NONE.** No long-running daemon, event watcher, reconnect loop, or heartbeat exists anywhere in the codebase (RESEARCH Runtime State: "The watcher is *new* in this phase"). The closest reuse is structural only — it imports `publishRatingFor` (from `publish.ts`) and `publicClient` (from `rpc.ts`), and mirrors the allow-list discipline of `cli.ts` (lines 28-32, 78-82) for the address→`SubjectId` mapping.

**Build from RESEARCH §2 (Pattern 2) directly — no codebase analog to copy.** Key elements the planner must specify (all are "Claude's Discretion" per CONTEXT — reconnect/backoff params, heartbeat interval, log format):
- `publicClient.watchContractEvent({ address, abi, eventName: "RatingRequested", pollingInterval, onLogs, onError })` (HTTP auto-polls via `eth_getLogs`).
- **Idempotency guard** (D-03 double-fire safe): an `inFlight: Set<string>` keyed on subject, checked before invoking the pipeline; mirror the dedupe in RESEARCH §2.
- **Reconnect on `onError`** (Pitfall 3): `unwatch()` + re-`startWatch()` with backoff — `watchContractEvent` does NOT auto-resurrect.
- **Heartbeat** (`setInterval` console.log ~15s) — the "is it listening?" liveness signal (CONTEXT specifics / REQ-10 demo moment).
- **Address→SubjectId map** (Pitfall 6): `RatingRequested(subject)` carries an *address*; `rate()` takes a *ticker*. Build a frozen reverse lookup from `STATIC` (`agent/src/subjects/static.ts` — each entry has `.address`); reject unknown addresses, mirroring `cli.ts` exit-2 allow-list discipline (lines 78-82).

**Reuse from existing code:** `redactRpcError` (`rpc.ts` lines 64-67) on any caught RPC error before logging (the daemon logs continuously — must not leak the keyed RPC URL).

---

### `agent/src/mint-identity.ts` (utility/one-shot, write + event) — NEW — ⚠ partial analog

**Analogs (partial):** `script/Deploy.s.sol` (the "one-shot broadcast, log the result" shape) + `agent/src/cli.ts` (TS entrypoint with `main()`/error-to-stderr). No exact analog — this is a TS one-shot that does an on-chain write, which is net pattern territory, but it reuses `walletClient`/`publicClient`/`pin`/`parseEventLogs` from the pieces above.

**Core pattern** (RESEARCH §5 — runs FIRST, the ordering dependency):
```typescript
// register(string agentURI) returns (uint256 agentId), selector 0xf2c298be (CONTEXT pre-flight)
const IDENTITY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const; // Mantle Mainnet ONLY
const cardCid = await pin(canonicalAgentCardJson);   // pin the agent-card first
const agentURI = `ipfs://${cardCid}`;
const hash = await walletClient.writeContract({
  address: IDENTITY, abi: identityRegistryAbi, functionName: "register",
  args: [agentURI], account, chain: mantle,
});
const receipt = await publicClient.waitForTransactionReceipt({ hash });
const [reg] = parseEventLogs({ abi: identityRegistryAbi, eventName: "Registered", logs: receipt.logs });
console.log("agentId =", reg.args.agentId);          // bake into RatingRegistry constructor / AGENT_TOKEN_ID env
```
**Notes for planner:** capture `agentId` from `Registered(agentId, agentURI, owner)` OR the ERC-721 `Transfer(0x0→agent, agentId)` event (Assumption A1 — confirm at mint time by reading one log). Agent-card JSON shape per EIP-8004 registration-v1 (RESEARCH §5: `type`/`name`/`description`/`image`/`services`/`registrations`); `registrations` can be omitted at mint (Open Question 3 — chicken-and-egg with `agentId`). Error-to-stderr `main()` idiom mirrors `cli.ts` lines 96-104.

---

### `agent/src/publish-cli.ts` (utility/CLI) — NEW (or fold into `cli.ts`)

**Analog:** `agent/src/cli.ts` (108 lines, read in full) — EXACT match. Mirror verbatim: the `#!/usr/bin/env node` shebang, the `SUBJECT_IDS` allow-list (lines 28-32), `parseArgs` (lines 41-67) if flags are needed, the `main()` with usage-on-missing-arg (exit 2) + unknown-subject (exit 2) + try/catch-to-stderr (exit 1) structure (lines 69-105), and the `redactRpcUrl` boundary scrub (lines 25, 102).

**Core difference:** instead of `rate(...)`, call `publishRatingFor(subject)` (the D-03 shared pipeline). Reuse the identical allow-list so `pnpm publish-rating <subject>` rejects unknown tickers exactly as `pnpm rate` does.

**Wiring:** add a `"publish-rating": "tsx --env-file-if-exists=../.env src/publish-cli.ts"` script to `agent/package.json` (mirror the existing `"rate"` script, line 13). Add the IPFS pin package to `dependencies` (line 20-25: `pinata` or `@storacha/client`).

---

### `agent/src/fixtures/elixir-deusd.ts` (fixture/model, static SubjectFacts build) — NEW

**Analogs:** `agent/src/subjects/usdy.ts` (the `SubjectFacts` *construction* pattern — how `collateral`/`contract`/`oracle`/`liquidity` buckets are assembled, lines 88-208) + `agent/src/subjects/static.ts` `staticFact()` (lines 104-120, the static-provenance Fact builder). NOTE: existing `agent/tests/fixtures/*.fixture.ts` are *multicall ReadResult* fixtures (different shape — see `usdy.fixture.ts`), NOT `SubjectFacts`; do not mirror those.

**Critical (D-04, Pitfall 5):** the fixture supplies ONLY facts in the exact `SubjectFacts` shape (`agent/src/subjects/types.ts` lines 21-38). The UNMODIFIED engine (`rate()` or the dimension scorers + `synthesize` directly) does the grading — NO `if (subject === "elixir")` branch, no hand-authored grade. Keep it SEPARATE from `subjects/` live adapters (place under `agent/src/fixtures/`, NOT `agent/src/subjects/`).

**SubjectFacts shape to build** (`agent/src/subjects/types.ts` lines 21-38):
```typescript
export type SubjectFacts = {
  subject: { name: string; ticker: SubjectId; address: `0x${string}`; chainId: 5000 };
  ingestBlock: number;
  collateral: Fact[]; contract: Fact[]; oracle: Fact[]; liquidity: Fact[];
};
```
**Fact construction with provenance** — mirror `usdy.ts` `staticFact({ label, value, evidence })` calls (lines 88-110) but the four red flags map to the four dimensions (D-04 — encode verbatim: **$1.00 hardcoded oracle, 65% xUSD concentration, 4.1x leverage, $520M claimed vs $160M actual TVL gap**). Each red-flag Fact carries a `sources`/comment reference to its public source (e.g. CBB0FE 2025-10-28) — the `Fact.source` is `{ kind: "static"; file; version }` per types.ts lines 16-19; add the documented-source citation in the `evidence` string and/or a top-of-file comment block.

> ⚠ **`SubjectId` type constraint:** the live type is `"USDY" | "cmETH" | "FBTC"` (`types.ts` line 6). Elixir deUSD is not in this union. Planner must decide: widen the union, or build the fixture's `subject.ticker` against a separate type so the live allow-list (`cli.ts` line 28, `registry.ts`) stays unpolluted (keeps the "live ratings aren't curated" boundary — D-04). Flag: the fixture should NOT be reachable via `getAdapter()` / the live `pnpm rate` allow-list.

---

## Shared Patterns

### Reasoning-hash determinism (REUSE VERBATIM — single source)
**Source:** `agent/src/hash.ts` lines 31-39 (`canonicalizeDoc`) + lines 48-50 (`computeReasoningHash`).
**Apply to:** `publish.ts` (pin the canonical bytes), `mint-identity.ts` (pin the agent-card via the same `pin()`), and implicitly the Phase 4 verifier.
**Rule (D-02, Pitfall 1):** the pinned bytes MUST equal the hashed bytes. `rate()` already returns `{ doc, reasoningHash }` and `writeToFs` emits `canonicalizeDoc(doc)` (rate.ts line 299). In `publish.ts`, call `canonicalizeDoc(doc)` ONCE and pass that exact string to `pin()`. Never re-serialize.
```typescript
// hash.ts — DO NOT re-implement; import these
export function canonicalizeDoc(doc: ReasoningDocument): string { /* RFC 8785 JCS */ }
export function computeReasoningHash(doc: ReasoningDocument): Hex { return keccak256(toBytes(canonicalizeDoc(doc))); }
```

### RPC error redaction (REUSE on every new RPC call site)
**Source:** `agent/src/rpc.ts` lines 52-67 (`redactRpcUrl` + `redactRpcError`).
**Apply to:** `wallet.ts`/`publish.ts`/`watch.ts`/`mint-identity.ts` — every `try/catch` around a viem write/read, and the CLI stderr boundary (mirror `cli.ts` lines 96-104).
**Established idiom** (from `rate.ts` lines 146-152):
```typescript
try { /* viem call */ } catch (e) { throw redactRpcError(e); }
```

### Mantle chain + RPC fallback (REUSE)
**Source:** `agent/src/rpc.ts` lines 15-24.
**Apply to:** `wallet.ts` (same `chain: mantle` + `http(MANTLE_RPC_URL ?? "https://rpc.mantle.xyz", { retryCount: 2, timeout: 15_000 })`).

### Subject allow-list discipline (REUSE)
**Source:** `agent/src/cli.ts` lines 28-32 + lines 78-82 (exit-2 on unknown subject); `agent/src/subjects/registry.ts` lines 21-27 (throw on unknown id).
**Apply to:** `watch.ts` (address→SubjectId reverse map, reject unknowns) and `publish-cli.ts` (identical allow-list). Keeps an invalid ticker from ever reaching `rate()`/Claude (T-2-07).

### Root `.env` secret loading (REUSE — no agent-local `.env`)
**Source:** `agent/package.json` line 13 (`tsx --env-file-if-exists=../.env`); secrets read via `process.env.*` at import (`rpc.ts` line 15).
**Apply to:** all new agent entrypoints. New env keys (RESEARCH Runtime State): `RATING_REGISTRY_ADDRESS`, `AGENT_TOKEN_ID`, and pin creds (`PINATA_JWT` [+`PINATA_GATEWAY`] OR `STORACHA_KEY`+`STORACHA_PROOF`). `PRIVATE_KEY` reused unchanged. Add new keys to `.env.example` (names only — T-2-01).

### Solidity file header + error-revert style (REUSE)
**Source:** `src/RatingRegistry.sol` lines 1-2 (SPDX + pragma), lines 51-55 (named `error` declarations), the `if (cond) revert ErrorName();` idiom (lines 59, 85-86).
**Apply to:** `IIdentityRegistry.sol` (header) and all `RatingRegistry.sol` edits (reuse the existing `NotAgent`/`InvalidGrade`/`InvalidConfidence` errors — do not add new revert strings where a named error exists).

### TDD RED→GREEN (REUSE — process pattern)
**Source:** CONTEXT Established Patterns; `test/RatingRegistry.t.sol` per-test natspec citing verification-map IDs.
**Apply to:** the gate negative test FIRST (D-01 — "negative test first, in isolation"), then layer publish logic. Contracts via `forge`, agent via `vitest` (`agent/package.json` line 14).

---

## No Analog Found

Files with no close codebase match (planner should use RESEARCH.md patterns — §2 and §5 — instead of a copy-from analog):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `agent/src/watch.ts` | service/daemon | event-driven (poll) | No long-running daemon, event watcher, reconnect loop, or heartbeat exists anywhere in the repo. Build from RESEARCH §2 (Pattern 2). Reuses `publishRatingFor`/`publicClient`/`STATIC` map only structurally. |
| `agent/src/mint-identity.ts` | utility/one-shot | request-response (write+event) | No TS code performs an on-chain write today (Phase 1/2 writes were forge scripts). Partial analogs: `Deploy.s.sol` (one-shot broadcast+log) + `cli.ts` (main/stderr). Build the `register()` call from RESEARCH §5. |

---

## Metadata

**Analog search scope:** `src/` (Solidity contracts + interfaces + constants), `script/`, `test/`, `agent/src/` (rpc, rate, hash, cli, schema, subjects/{static,types,registry,usdy}), `agent/tests/fixtures/`, `agent/package.json`.
**Files scanned (read in full or targeted):** 14 source files + 1 package.json + 1 fixture + 1 glob.
**Pattern extraction date:** 2026-06-10
**Net-new patterns flagged:** 2 (watcher daemon, mint one-shot) — both have RESEARCH.md reference patterns (§2, §5).
