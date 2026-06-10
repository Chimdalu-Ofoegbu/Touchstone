---
phase: 03-onchain-publish-erc8004
plan: 02
subsystem: infra
tags: [viem, walletClient, pinata, ipfs, keccak256, mantle, erc8004, abi, tdd, vitest]

# Dependency graph
requires:
  - phase: 02-rating-engine-core
    provides: "hash.ts (canonicalizeDoc / computeReasoningHash — the single RFC 8785 JCS hash contract), schema.ts (ReasoningDocument), rpc.ts (publicClient + redactRpcError)"
provides:
  - "agent/src/wallet.ts — viem walletClient + account from PRIVATE_KEY on Mantle Mainnet (chain 5000), re-exporting redactRpcError"
  - "agent/src/ipfs.ts — pin(canonical): Promise<string> uploading the EXACT canonical bytes as a Pinata raw file, returning a bare CID that resolves directly to the JSON"
  - "agent/src/registry-abi.ts — ratingRegistryAbi (as const) matching the Plan 01 contract shape with the string cid arg + RatingPublished.cid"
  - "agent/tests/ipfs.test.ts — hermetic byte-exact pin test + RUN_LIVE-gated pin->gateway-fetch->re-hash round-trip"
  - "package.json script stubs (mint-identity / publish-rating / watch) + Pinata env declarations in .env.example"
affects: [03-03-mint-redeploy, 03-04-publish-pipeline, 03-06-live-e2e, 04-frontend-verify]

# Tech tracking
tech-stack:
  added: ["pinata ^2.5.6 (THE single locked IPFS pin provider — raw-file CID)"]
  patterns:
    - "walletClient as the write-side twin of publicClient — same chain/transport/RPC fallback, redactRpcError reused not duplicated"
    - "pin() = module-singleton-from-env-secret + one exported async fn (rpc.ts shape), with an injectable uploader seam for hermetic byte-exact testing"
    - "RUN_LIVE-gated live integration test (it.skipIf) keeps the default suite hermetic / no-PINATA_JWT"
    - "hand-authored as-const ABI as the D-02 freeze source, reconciled to the deployed artifact downstream"

key-files:
  created:
    - agent/src/wallet.ts
    - agent/src/ipfs.ts
    - agent/src/registry-abi.ts
    - agent/tests/ipfs.test.ts
  modified:
    - agent/package.json
    - .env.example

key-decisions:
  - "pin() uploads new Blob([canonical]) (the exact canonicalizeDoc bytes) wrapped as a File only at the Pinata boundary — byte-exactness preserved, no JSON.stringify, no re-serialization"
  - "Lazy PinataSDK init + injectable uploader so the hermetic suite needs no PINATA_JWT and never hits the network"
  - "registry-abi.ts hand-authored to the Plan 01 shape now (cid arg present); transient typecheck mismatch vs un-merged Plan 01 is expected and reconciled in Plan 03"

patterns-established:
  - "Write-path secret-scrub: every walletClient/pin catch funnels through redactRpcError / redactPinError (T-03-06/07)"
  - "Byte-exact pin guard: a fake uploader captures the Blob and asserts bytes === canonicalizeDoc(doc) (Pitfall 1 / T-03-05)"
  - "Isolated pin->fetch-by-CID->re-hash round-trip proven in RUN_LIVE BEFORE the pipeline consumes pin (Assumption A2 / T-03-25)"

requirements-completed: [REQ-04]

# Metrics
duration: 16min
completed: 2026-06-10
---

# Phase 3 Plan 02: Agent Write Infrastructure Summary

**viem walletClient (Mantle 5000), a byte-exact Pinata `pin(canonical)` returning a bare raw-file CID, and a frozen `ratingRegistryAbi` const — the reusable write primitives Plans 03/04/06 compose, with the pin->gateway->re-hash binding proven in isolation.**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-06-10T20:07:07Z
- **Completed:** 2026-06-10T20:23:25Z
- **Tasks:** 2 (Task 2 was TDD: RED → GREEN)
- **Files modified:** 6 (4 created, 2 modified; +1 lockfile)

## Accomplishments
- `wallet.ts`: viem `walletClient` signing from `PRIVATE_KEY` (`privateKeyToAccount`) on Mantle Mainnet chain 5000, mirroring `rpc.ts`'s transport + RPC fallback and re-exporting `redactRpcError` (no duplicated redact logic).
- `ipfs.ts`: `pin(canonical)` uploads the EXACT `canonicalizeDoc(doc)` bytes as a Pinata **raw file** (`upload.public.file`) and returns a **bare CID** that resolves directly to the JSON (no directory wrap) — the Phase 4 re-hash precondition.
- `agent/tests/ipfs.test.ts`: a hermetic byte-exact test proving the uploaded Blob bytes equal `canonicalizeDoc(doc)` (not `JSON.stringify(doc)`), plus a **RUN_LIVE-gated** standalone pin→fetch-by-CID-through-a-public-gateway→recompute-keccak256 round-trip proving direct-CID resolution + the on-chain hash binding **in isolation** before Plan 04 wires pin into the pipeline.
- `registry-abi.ts`: `ratingRegistryAbi` (`as const`) covering `publishRating(... , string cid)`, `RatingPublished` (with `cid`), `RatingRequested`, `latestRating`, `ratingHistory`, the immutable getters, and the `NotAgent`/`InvalidGrade`/`InvalidConfidence` errors — the D-02 ABI-freeze source.
- `.env.example` documents `PINATA_JWT` (+ optional `PINATA_GATEWAY`), `AGENT_TOKEN_ID`, `RATING_REGISTRY_ADDRESS` (names only, Pinata-only — no Storacha); `package.json` adds `mint-identity` / `publish-rating` / `watch` script stubs + the `pinata` dependency.

## Task Commits

Each task was committed atomically:

1. **Task 1: walletClient + registry-abi skeleton + new env-var declarations** — `837fcdb` (feat)
2. **Task 2 (TDD RED): failing byte-exact pin round-trip + RUN_LIVE re-hash test** — `a03e599` (test)
3. **Task 2 (TDD GREEN): implement pin(canonical) Pinata raw-file module** — `0f35cd0` (feat)

_REFACTOR phase skipped — the GREEN implementation was already clean._

## Files Created/Modified
- `agent/src/wallet.ts` (created) — viem walletClient + account on Mantle 5000; re-exports `redactRpcError`/`redactRpcUrl` from `rpc.ts`.
- `agent/src/ipfs.ts` (created) — `pin(canonical): Promise<string>` via Pinata raw-file path; injectable uploader seam; JWT-scrubbing error path; lazy SDK init.
- `agent/src/registry-abi.ts` (created) — `ratingRegistryAbi` const matching the Plan 01 contract shape (cid arg + RatingPublished.cid).
- `agent/tests/ipfs.test.ts` (created) — hermetic byte-exact pin test + RUN_LIVE-gated gateway-fetch→re-hash round-trip.
- `agent/package.json` (modified) — `pinata ^2.5.6` dep + `mint-identity`/`publish-rating`/`watch` script stubs.
- `.env.example` (modified) — `AGENT_TOKEN_ID`, `RATING_REGISTRY_ADDRESS`, `PINATA_JWT`, `PINATA_GATEWAY` (names only).

## Decisions Made
- **Byte-exact payload as a File at the Pinata boundary only.** Pinata's `upload.public.file` is typed to accept a `File`, not a `Blob`. `pin()` still builds `new Blob([canonical])` (the load-bearing byte-exact line); the `defaultUploader` wraps that Blob into a `File("reasoning.json")` solely to satisfy the type. A raw-file CID is content-addressed over the bytes (not the filename), so byte-exactness is fully preserved — confirmed by the hermetic test asserting `capturedBytes === canonical`.
- **Lazy SDK init + injectable uploader.** The PinataSDK is constructed on first real use, not at import, and the test injects a fake uploader. This keeps the default suite hermetic and runnable without `PINATA_JWT`.
- **ABI hand-authored ahead of Plan 01.** Per the plan NOTE, `registry-abi.ts` is written to the Plan 01 interface shape now (with `string cid`). It type-checks standalone (plain data), so Plans 04/06 can consume it; Plan 03 Task 3 reconciles it byte-for-byte against `out/RatingRegistry.sol/RatingRegistry.json` after the once-only Mainnet redeploy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pinata `upload.public.file` requires a `File`, not a `Blob`**
- **Found during:** Task 2 (GREEN, `pnpm typecheck`)
- **Issue:** `pnpm typecheck` failed with `TS2345: Argument of type 'Blob' is not assignable to parameter of type 'File'` — the installed `pinata` 2.5.6 types the upload arg as `File`. Passing the bare `Blob` (as the plan/RESEARCH sketch showed) does not type-check.
- **Fix:** Kept `new Blob([canonical])` as the payload in `pin()` (the byte-exact requirement / acceptance grep), and wrapped that exact Blob into `new File([blob], "reasoning.json", { type: "application/json" })` only inside the production `defaultUploader`. A File built from the canonical Blob carries identical bytes; the raw-file CID is content-addressed over the bytes, not the name.
- **Files modified:** `agent/src/ipfs.ts`
- **Verification:** `pnpm typecheck` exits 0; the hermetic byte-exact test still passes (`capturedBytes === canonical`); full suite green (193 passed, 1 skipped).
- **Committed in:** `0f35cd0` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** The fix was required to type-check against the real Pinata 2.5.6 API and preserves byte-exactness exactly. No scope creep — `new Blob([canonical])` remains the payload as the acceptance criteria require.

## Issues Encountered
- The worktree had no `node_modules` (fresh checkout). Ran `pnpm install` before the baseline typecheck/test, then `pnpm add pinata` as the Task 2 install step. Baseline typecheck + hash suite were green before any changes, confirming the plan's deltas are the only moving parts.

## Known Stubs
- **Script stubs** in `agent/package.json` (`mint-identity` / `publish-rating` / `watch`) point to files NOT yet created (`src/mint-identity.ts`, `src/publish-cli.ts`, `src/watch.ts`). Intentional per the plan — Plans 03/04/06 create those files; the script wiring is pre-staged so those plans only add the `.ts`.
- **`registry-abi.ts`** is hand-authored to the un-merged Plan 01 contract shape. Intentional and documented in the file header; Plan 03 Task 3 reconciles it against the deployed artifact (D-02 freeze). Not a data stub — it is real ABI data, just pending the parallel-wave contract merge.

These do not block REQ-04 (the pin byte-exactness + walletClient + ABI const are all fully implemented and verified).

## User Setup Required
**External service requires manual configuration before the live pipeline (Plan 04+) can pin.** The user must add to the root `.env`:
- `PINATA_JWT` — Pinata Dashboard → API Keys → create a key with pinning scope → copy the JWT.
- `PINATA_GATEWAY` (optional) — Pinata Dashboard → Gateways → dedicated gateway domain (the public gateway works if unset).

Verification once set: `cd agent && RUN_LIVE=1 pnpm test ipfs` runs the live pin→gateway-fetch→re-hash round-trip and asserts the fetched bytes re-hash to `computeReasoningHash(doc)`. The default `pnpm test ipfs` stays hermetic and needs no JWT.

## Next Phase Readiness
- **Plan 03 (mint + redeploy):** `walletClient`/`account` ready to sign `register(agentURI)` and the redeploy; `pin()` ready to pin the agent-card JSON; `registry-abi.ts` is the freeze target to reconcile against the deployed artifact.
- **Plan 04 (publish pipeline):** `pin(canonical)` + `walletClient` + `ratingRegistryAbi` are the exact primitives `publishRatingFor(subject)` composes; the pin→re-hash binding is already proven in isolation (RUN_LIVE), de-risking the pipeline integration.
- **Plan 06 / Phase 4 (verify):** the bare-CID-resolves-directly-to-JSON guarantee (T-03-25) is the precondition for the frontend's fetch-by-CID → re-hash → "verified on Mantle" path.
- **No blockers.** Only the parallel Plan 01 contract merge + the user's `PINATA_JWT` remain, both expected and documented.

## Self-Check: PASSED

- Files: `agent/src/wallet.ts`, `agent/src/ipfs.ts`, `agent/src/registry-abi.ts`, `agent/tests/ipfs.test.ts`, `.planning/phases/03-onchain-publish-erc8004/03-02-SUMMARY.md` — all FOUND.
- Commits: `837fcdb` (Task 1), `a03e599` (TDD RED), `0f35cd0` (TDD GREEN) — all FOUND.
- Verification: `pnpm typecheck` exits 0; `pnpm test ipfs` → 2 passed / 1 skipped (RUN_LIVE); full suite → 193 passed / 1 skipped.

---
*Phase: 03-onchain-publish-erc8004*
*Completed: 2026-06-10*
