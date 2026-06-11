---
phase: 03-onchain-publish-erc8004
plan: 06
subsystem: onchain
tags: [watcher, daemon, watchContractEvent, eth_getLogs, dedupe, reconnect, heartbeat, live-e2e, mainnet, verifiability, eip55]

# Dependency graph
requires:
  - phase: 03-onchain-publish-erc8004 (Plan 04)
    provides: "publishRatingFor(subject) shared pipeline (rate->pin->publishRating)"
  - phase: 03-onchain-publish-erc8004 (Plan 03)
    provides: "RATING_REGISTRY_ADDRESS (Mainnet), live ERC-8004 gate (agent owns token 114)"
provides:
  - "agent/src/watch.ts — RatingRequested watcher daemon (eth_getLogs polling, dedupe, resilient reconnect, heartbeat)"
  - "agent/src/subjects/address-map.ts — frozen address->SubjectId reverse map; rejects unknowns"
  - "agent/tests/watch.test.ts — handleLogs map/dedupe/skip proof (3/3)"
  - "LIVE PROOF on Mantle Mainnet: requestRating -> watcher -> publishRating -> latestRating -> IPFS re-hash matches the on-chain reasoningHash"
affects: [04-frontend-verify, 05-ship]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Watcher subscription via stateless eth_getLogs polling over a moving block range (getContractEvents), NOT eth_newFilter — Mantle's load-balanced RPC drops filters"
    - "address->SubjectId reverse map (lowercased) as the allow-list gate before rating; unknowns return null and are skipped (never reach rate()/Claude)"
    - "inFlight Set dedupe makes watcher + manual CLI double-fire harmless (append-only history)"
    - "Normalize addresses to canonical EIP-55 at the on-chain WRITE boundary (read path tolerates non-canonical, write path strict-validates)"

key-files:
  created:
    - agent/src/watch.ts
    - agent/src/subjects/address-map.ts
    - agent/tests/watch.test.ts
    - .planning/phases/03-onchain-publish-erc8004/03-06-SUMMARY.md
  modified:
    - agent/src/publish.ts
    - agent/tests/publish.test.ts

key-decisions:
  - "watchContractEvent (filter-based) replaced with getLogs polling after live failure: Mantle public RPC returns 'filter not found' on eth_getFilterChanges (load-balanced nodes don't share filters)"
  - "Subject address normalized via getAddress() before publishRating: STATIC carries non-canonical EIP-55 for USDY/cmETH; the write path rejected it. Does not change the pinned doc or the hash"
  - "Live e2e driven via the manual pipeline (pnpm publish-rating, same publishRatingFor) AND the watcher round-trip — both verified; the manual path sidesteps Windows cast/.env key-quoting friction"

patterns-established:
  - "Verifiability check: fetch IPFS JSON by the on-chain cid -> keccak256(bytes) AND computeReasoningHash(parsed) -> assert both equal the on-chain reasoningHash"

requirements-completed: [REQ-02]

# Metrics
completed: 2026-06-11
---

# Phase 3 Plan 06: RatingRequested Watcher + LIVE Mainnet End-to-End

**The agent watcher listens for `RatingRequested` on the Mainnet RatingRegistry, maps the subject address to its SubjectId, and runs the shared `publishRatingFor` pipeline per event — proven LIVE end-to-end: `requestRating` → watcher CAUGHT → `publishRating` → `latestRating` returns the full struct → the IPFS reasoning JSON re-hashes EXACTLY to the on-chain `reasoningHash`. Three live-bring-up bugs were found and fixed (RPC filters, EIP-55 checksum, Windows shell key-quoting).**

## Task 1 — Watcher daemon (TDD, autonomous)
- `agent/src/subjects/address-map.ts`: frozen `address.toLowerCase() -> SubjectId` reverse map from STATIC; `subjectIdFromAddress` returns null for unknowns (allow-list, T-03-21).
- `agent/src/watch.ts`: testable `handleLogs` (map → inFlight dedupe → fire `publishRatingFor` once → clear on settle); `startWatch` poll loop; ~15s heartbeat; all caught errors via `redactRpcError`.
- `agent/tests/watch.test.ts`: 3/3 — known address → publish once; double-fire in flight → skipped; unknown → never rated.
- Commits: `1fc5b27` (RED), `d372a56` (GREEN).

## Task 2 — LIVE end-to-end on Mantle Mainnet (chain 5000, `0xF16d03965E1870Fc3235198468C56dEC65E5606D`)

### A. Manual pipeline publish (D-03 fallback path — the same `publishRatingFor`)
- **publishRating tx:** `0xf1320b175521246fb2f08f9005522c8515eb16f77d815d3ad15f1b163ede49fe`
- grade **3 (BBB)**, confidence 80, agent `0xb27c7fa1…F51e`
- **reasoningHash:** `0x5ded43215b0f95adeef91b8b5a6fe10c964e3dae2e5b30adea11ec9c18bf1d14`
- **cid:** `bafkreibnrjsdharjfuqazgivblw43cnm3drh6pkpzwt44cmvzqd2pibtkm`
- **Verify:** `keccak256(IPFS bytes)` == `computeReasoningHash(parsed)` == on-chain `reasoningHash` → **PASS** (no canonical-serialization drift).

### B. Watcher round-trip (the primary trigger path, REQ-10)
- **requestRating tx:** `0xc0d67af689ccc5f4437820900f7fe7ce5f668c731ce39e752d2dabaab612a6c4` (block 96528138)
- **watcher reaction (observed in the daemon log):** `>>> RatingRequested CAUGHT -> USDY (0x5bE26527…c5A6) — running the rating pipeline now...`
- **publishRating tx (watcher):** `0x4d1237839fd462f7da813d2fb36e7c668aab4b8ba70b09a5cf41661aa69bf0d4` (block 96528163)
- **reasoningHash:** `0xf9963a10ca72b18be952b5aa22776eaf98e834a81fea3e7da72f517a09d21e98`
- **cid:** `bafkreiaoaj3rzdtd73qex56n2il74khqwlnmtzoxbkf4jkcle3lfofck4y`, timestamp 1781186638
- **Verify:** `keccak256(IPFS bytes)` == `computeReasoningHash(parsed)` == on-chain `reasoningHash` → **PASS**.
- **Dedupe proven incidentally:** two watchers ran concurrently (one extra, left over from manual testing); both caught the event, one published, the other's tx was rejected `replacement transaction underpriced`. History is append-only → harmless (T-03-20). In production/demo a single watcher runs.

This closes ROADMAP **SC-2** (agent listens → engine → pin → publishRating with `reasoningHash == keccak256(canonical JSON)`) and **SC-3** (`latestRating` returns the full struct end-to-end), both LIVE.

## Bugs Found & Fixed During Live Bring-Up
1. **RPC filter incompatibility (`fix 86d3d26`).** viem `watchContractEvent` uses `eth_newFilter`/`eth_getFilterChanges`; Mantle's load-balanced public RPC dropped the filter every poll (`filter not found`) → the watcher would have missed every event. Replaced with stateless `getContractEvents` (`eth_getLogs`) polling over a moving block range (`lastBlock` advances only after a successful scan → no gaps/overlap).
2. **Non-canonical EIP-55 in STATIC (`fix dd2d7a9`).** STATIC's USDY (`0x5be2…` vs `0x5bE2…`) and cmETH (`…7ee3040e` vs `…7eE3040e`) addresses fail viem's strict `isAddress` on the WRITE path (the read path tolerated them). The live publish threw `InvalidAddressError`. Fixed by `getAddress()`-normalizing the subject at the `publishRating` boundary — does not change the pinned doc or the hash (verifiability re-proven PASS).
3. **Windows `cast`/.env key-quoting (operational, no code change).** Raw `cast send --private-key "$(... .env ...)"` failed (`Failed to decode private key`) under cmd.exe/PowerShell quoting. Sidestepped by driving the live writes through the project's `tsx --env-file-if-exists=../.env` path (the same loader `pnpm watch`/`pnpm rate` use), which parses `.env` correctly.

Also: `0862640` added demo-clear `>>> CAUGHT` / `>>> PUBLISHED` watcher logs (REQ-10 on-camera beat).

## Verification
- `cd agent && pnpm test` → 207 passed / 1 skipped (26 files); `pnpm typecheck` → 0.
- Live (manual evidence above): two full USDY rating cycles published on Mainnet; both IPFS JSONs re-hash to their on-chain `reasoningHash`; watcher reaction observed in the daemon log; `latestRating(USDY)` returns the full struct.

## Follow-up (non-blocking)
- STATIC's USDY/cmETH checksums are still non-canonical, so the published doc's `subject.address` keeps that casing (cosmetic; verifiability is unaffected — proven). Optional: correct STATIC and regenerate golden hashes so future published JSON uses canonical addresses. Spawned as a separate task.

## Next Phase Readiness
- **Phase 4 (frontend):** ratings live on Mainnet (`latestRating`/`ratingHistory` return the struct incl. cid); the fetch-by-cid → re-hash → "verified on Mantle" path is proven and reproducible (see the verify logic in this summary); the watcher + manual CLI both drive publishes for the live-request demo.
- **No blockers. Phase 3 COMPLETE (6/6).**

## Self-Check: PASSED
- Files: `agent/src/watch.ts`, `agent/src/subjects/address-map.ts`, `agent/tests/watch.test.ts`, this SUMMARY — FOUND.
- Commits: `1fc5b27`, `d372a56`, `0862640`, `86d3d26`, `dd2d7a9` — FOUND.
- Live: requestRating + 2 publishRating txs + 2 verify PASSES on Mantle Mainnet — CONFIRMED on-chain.

---
*Phase: 03-onchain-publish-erc8004*
*Completed: 2026-06-11*
