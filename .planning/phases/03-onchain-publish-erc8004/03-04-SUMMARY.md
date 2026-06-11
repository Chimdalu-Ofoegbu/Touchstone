---
phase: 03-onchain-publish-erc8004
plan: 04
subsystem: onchain
tags: [publish-pipeline, viem, writeContract, parseEventLogs, ipfs, keccak256, cli, anvil-fork, tdd, vitest, d-03]

# Dependency graph
requires:
  - phase: 02-rating-engine-core
    provides: "rate(subject) -> { doc, reasoningHash }; hash.ts canonicalizeDoc/computeReasoningHash; rpc.ts publicClient/redactRpcError/redactRpcUrl; cli.ts (the CLI analog)"
  - phase: 03-onchain-publish-erc8004 (Plan 02)
    provides: "wallet.ts walletClient/account; ipfs.ts pin(canonical); registry-abi.ts (frozen)"
  - phase: 03-onchain-publish-erc8004 (Plan 03)
    provides: "RATING_REGISTRY_ADDRESS (Mainnet contract) + the live ERC-8004 gate (agent owns token 114)"
provides:
  - "agent/src/publish.ts — publishRatingFor(subject): the ONE shared publish pipeline (D-03), injectable deps, D-02 event-match guard"
  - "agent/src/publish-cli.ts — pnpm publish-rating <subject> manual fallback calling the identical pipeline"
  - "agent/tests/publish.test.ts — mock-path proof (args + pin-bytes==canonical + divergence guard)"
  - "agent/tests/publish.live.test.ts — RUN_LIVE anvil-fork e2e (publish -> latestRating read-back -> re-hash), PROVEN 1/1 on a Mantle fork"
  - "agent/tests/setup-env.ts + vitest setupFiles — hermetic import of the write-path modules without real secrets"
  - "agent/vitest.live.config.ts + tests/setup-fork-env.ts + pnpm test:fork — runner for the *.live.test.ts files"
affects: [03-06-live-e2e, 04-frontend-verify]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ONE shared pipeline (D-03): publishRatingFor composes rate->pin->publishRating; both the watcher (Plan 06) and the CLI call it — publish logic written once"
    - "injectable deps (rate/pin/walletClient/publicClient/registry) default to the real imports → the pipeline is provable hermetically with zero network/gas"
    - "in-pipeline parsed-event guard: re-decode RatingPublished from the receipt and assert hash+cid === sent, else throw 'diverged' (D-02 silent-failure guard)"
    - "pin the SAME canonical string that fed the hash — never re-serialize (Pitfall 1); no second chain-head read in the publisher (CR-04)"
    - "RUN_LIVE *.live.test.ts gated by a dedicated vitest config (the default config excludes them from every run) + a setupFile that loadEnvFile('../.env')"

key-files:
  created:
    - agent/src/publish.ts
    - agent/src/publish-cli.ts
    - agent/tests/publish.test.ts
    - agent/tests/publish.live.test.ts
    - agent/tests/setup-env.ts
    - agent/tests/setup-fork-env.ts
    - agent/vitest.live.config.ts
    - .planning/phases/03-onchain-publish-erc8004/03-04-SUMMARY.md
  modified:
    - agent/package.json
    - agent/vitest.config.ts

key-decisions:
  - "publishRatingFor uses the reasoningHash returned by rate() (not a recompute) and pins canonicalizeDoc(doc) — the SAME bytes — so the hash sent, the pinned bytes, and the stored cid are one consistent provenance unit"
  - "Deps are injected, but the production write still passes wallet.ts `account` + chain mantle, so type-safety on the writeContract call is preserved (Pick<WalletClient,'writeContract'>)"
  - "The anvil-fork e2e was EXECUTED (not just written): proves ROADMAP SC-3 (latestRating returns the struct + re-hash) without a live Mainnet publish — de-risks Plan 06"

patterns-established:
  - "Hermetic write-path testing: a vitest setupFile seeds throwaway PRIVATE_KEY only when unset, so importing wallet.ts/publish.ts needs no real key"
  - "Live-fork testing: dedicated config + loadEnvFile setup + `pnpm test:fork` against `anvil --fork-url https://rpc.mantle.xyz --chain-id 5000`"

requirements-completed: [REQ-02, REQ-04]

# Metrics
completed: 2026-06-11
---

# Phase 3 Plan 04: The Shared Publish Pipeline (publishRatingFor)

**`publishRatingFor(subject)` is the ONE pipeline (D-03) that runs the Phase 2 engine, pins the EXACT canonical reasoning bytes (bare Pinata CID), calls `publishRating(... cid)` in a single atomic tx, and asserts the on-chain `RatingPublished` matches what was sent — proven hermetically against mocks AND end-to-end against a live Mantle fork (publish → `latestRating` read-back → re-hash, 1/1). The manual `pnpm publish-rating <subject>` CLI calls the identical function.**

## Performance
- **Completed:** 2026-06-11
- **Tasks:** 2 (Task 1 TDD RED→GREEN; Task 2 CLI + live-fork test)
- **Files:** 8 created, 2 modified

## Accomplishments

### Task 1 — publishRatingFor shared pipeline (TDD)
- `agent/tests/publish.test.ts` (RED, commit `00123e1`): mock-path proof injecting fake rate/pin/walletClient/publicClient. Asserts the `writeContract` args are `[subject, grade, reasoningHash, confidence, cid]` with `reasoningHash === computeReasoningHash(doc)` and `cid ===` the BARE pin cid; that the string handed to `pin` `=== canonicalizeDoc(doc)` (no re-serialization); and two divergence cases where a mismatched on-chain hash/cid makes the pipeline throw `"diverged"`. Real, decodable `RatingPublished` logs built with `encodeEventTopics` + `encodeAbiParameters`.
- `agent/src/publish.ts` (GREEN, commit `d470ac7`): `publishRatingFor(subject, deps?)` — `rate()` once → `canonicalizeDoc(doc)` → `pin(canonical)` → `walletClient.writeContract(publishRating, …cid)` → `waitForTransactionReceipt` → `parseEventLogs(RatingPublished)` → assert hash+cid match (D-02). Write catch funnels through `redactRpcError` (T-03-18); injectable deps default to the real imports; NO second chain-head/engine read (CR-04, grep-verified 0 `getBlock` calls).

### Task 2 — Manual CLI + anvil-fork e2e
- `agent/src/publish-cli.ts`: `pnpm publish-rating <SUBJECT>` mirrors `cli.ts` verbatim (USDY/cmETH/FBTC allow-list, usage/unknown exit 2, try/catch→stderr exit 1 via `redactRpcUrl`) and calls `publishRatingFor` — no duplicated publish logic (D-03). Prints subject/txHash/reasoningHash/cid.
- `agent/tests/publish.live.test.ts`: RUN_LIVE anvil-fork end-to-end. Injects fork wallet/public clients (`http://127.0.0.1:8545`, chain 5000) + a deterministic doc (no Anthropic) + a stub pin asserted to receive the canonical bytes; publishes via the REAL pipeline, then reads `latestRating(subject)` and asserts the struct `reasoningHash`/`cid`/`grade`/`subject` AND that `keccak256(toBytes(canonical))` reproduces the stored hash.
- **Executed and PASSED (1/1)** against `anvil --fork-url https://rpc.mantle.xyz --chain-id 5000`: forked state confirmed `ownerOf(114)==agent` + `agentTokenId()==114`; the gated publish succeeded and the read-back/re-hash held. ROADMAP SC-3 proven without a live Mainnet tx.

## Verification
- `cd agent && pnpm test` → **204 passed / 1 skipped (25 files)** (live test excluded by config). `pnpm typecheck` → 0.
- `cd agent && pnpm test publish` → mock pipeline 3/3.
- `pnpm test:fork` (with anvil running) → anvil-fork e2e **1/1** (executed this session).
- All Task 1 + Task 2 acceptance greps pass (`canonicalizeDoc(doc)`, `pin(canonical)`, `JSON.stringify`=0, `getBlock`=0, `functionName: "publishRating"`, `diverged`, `redactRpcError`; CLI `publishRatingFor`/allow-list/`process.exit(2)`/`"publish-rating"`; live test references `latestRating`).

## Deviations from Plan

**1. [infra] vitest setupFile for hermetic write-path import.**
`publish.ts` imports `wallet.ts`, which calls `privateKeyToAccount(process.env.PRIVATE_KEY)` at module load; the hermetic suite doesn't load `.env`, so the import would throw. Added `tests/setup-env.ts` (seeds throwaway `PRIVATE_KEY`/`RATING_REGISTRY_ADDRESS` only when unset) + `setupFiles` in `vitest.config.ts`. No production code touched; real runs are unaffected.

**2. [infra] Dedicated runner for the live test.**
The default `vitest.config.ts` excludes `tests/**/*.live.test.ts` from EVERY run (including `test:live`), so a `*.live.test.ts` file cannot run under it. Added `vitest.live.config.ts` (includes only the live files), `tests/setup-fork-env.ts` (`process.loadEnvFile('../.env')` for the real key), and the `test:fork` script. This is the only way to make the required `publish.live.test.ts` runnable.

**3. [test] Address checksum in the log builder.**
`encodeEventTopics` (and the fork `writeContract`) checksum-validate the indexed `subject` address; the doc fixtures use a lowercase USDY address (valid per the schema regex). Wrapped the subject in `getAddress(...)` in the mock log builder and the live-test doc.

**4. [positive] Live-fork e2e executed, not just written.**
The plan scoped the anvil-fork test as documented manual evidence. It was actually run this session (1/1) to prove the end-to-end publish→read-back→re-hash binding on real forked Mantle state — concrete de-risking for Plan 06.

**Total:** 4 (2 benign infra additions, 1 minor test fix, 1 positive over-delivery). No scope change to the pipeline contract.

## How to Run the Live Fork Test
```
# terminal 1
anvil --fork-url https://rpc.mantle.xyz --chain-id 5000
# terminal 2 (root .env must have PRIVATE_KEY + RATING_REGISTRY_ADDRESS)
cd agent && pnpm test:fork
# (on Windows PowerShell, if RUN_LIVE doesn't propagate via pnpm:
#  $env:RUN_LIVE=1; npx vitest run --config vitest.live.config.ts)
```

## Next Phase Readiness
- **Plan 06 (watcher live e2e):** `publishRatingFor` is the exact function the `RatingRequested` watcher invokes; the end-to-end publish→read path is already proven on a fork, so Plan 06 is the watcher daemon (dedupe/reconnect/heartbeat) + ONE real Mainnet publish.
- **Phase 4 (frontend verify):** the bare-CID + on-chain `reasoningHash` binding and the `latestRating` struct shape are confirmed; the FE fetch-by-CID → re-hash → "verified on Mantle" path has its contract.
- **No blockers.** Live Mainnet publish (real gas) remains a Plan 06 manual checkpoint.

## Self-Check: PASSED
- Files: `agent/src/publish.ts`, `agent/src/publish-cli.ts`, `agent/tests/publish.test.ts`, `agent/tests/publish.live.test.ts`, `agent/tests/setup-env.ts`, `agent/tests/setup-fork-env.ts`, `agent/vitest.live.config.ts`, this SUMMARY — all FOUND.
- Commits: `00123e1` (RED), `d470ac7` (GREEN Task 1), + Task 2 feat (this commit set).
- Verification: default suite 204 pass / 1 skip; typecheck 0; fork e2e 1/1 executed.

---
*Phase: 03-onchain-publish-erc8004*
*Completed: 2026-06-11*
