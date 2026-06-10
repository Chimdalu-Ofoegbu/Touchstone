---
phase: 03-onchain-publish-erc8004
plan: 01
subsystem: contracts
tags: [solidity, foundry, erc-8004, erc-721, ownerOf, ipfs, cid, forge, vm.mockCall, vm.etch]

# Dependency graph
requires:
  - phase: 01-lock-skeleton
    provides: "RatingRegistry.sol skeleton (immutable EOA agent gate, Rating struct, RatingPublished event), Deploy.s.sol, forge test triad, GradeEnum"
  - phase: 02-rating-engine-core
    provides: "agent rating engine + canonical reasoning-hash contract (the off-chain producer of reasoningHash + cid this contract now stores)"
provides:
  - "Live ERC-8004 ownerOf(agentTokenId) == msg.sender publish gate on RatingRegistry (replaces the Phase-1 EOA gate)"
  - "Minimal IIdentityRegistry interface (ownerOf only) — the single ERC-8004 dependency surface"
  - "string cid as a first-class field on the Rating struct + RatingPublished event + publishRating signature, written atomically with reasoningHash (D-02)"
  - "Frozen post-redeploy contract ABI shape (gate + cid) that Plan 03 redeploys and Phase 4 generates types from"
  - "Deploy.s.sol parameterized for the once-only Mainnet redeploy (canonical IDENTITY_REGISTRY constant + AGENT_TOKEN_ID env)"
affects: [03-02, 03-03, 04-frontend, registry-abi, phase-4-verifier]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Live cross-contract gate via a hand-declared minimal interface (ownerOf only, no OpenZeppelin)"
    - "Forge gate-test pattern: vm.etch(registryAddr, hex01) BEFORE vm.mockCall on ownerOf (Pitfall 4)"
    - "Atomic hash+pointer write: reasoningHash and cid land in one publishRating tx (D-02)"

key-files:
  created:
    - src/interfaces/IIdentityRegistry.sol
  modified:
    - src/RatingRegistry.sol
    - test/RatingRegistry.t.sol
    - script/Deploy.s.sol

key-decisions:
  - "IIdentityRegistry declares only ownerOf(uint256) — minimal surface, no OZ dependency (D-01 discretion; lib/ has only forge-std)"
  - "Negative gate test (revert from non-agent) written + RED first, in isolation, before the gate swap (D-01)"
  - "Registry address + agentTokenId are immutable constructor args (single source of reference), never hardcoded in the contract body; named IDENTITY_REGISTRY constant lives only in Deploy.s.sol with a Mantle-Mainnet-ONLY comment"
  - "cid stored in the struct AND emitted in the event, set atomically with reasoningHash (D-02) — never on-chain state with a hash but no retrievable reasoning"
  - "Deploy.s.sol constructor change made in Task 1 (not Task 2) because the new 2-arg constructor breaks Deploy.s.sol compilation and forge compiles scripts (Rule 3 blocking)"

patterns-established:
  - "Pattern 1: vm.etch before vm.mockCall for any test that exercises a cross-contract call to an address with no test-EVM bytecode"
  - "Pattern 2: _mockGateOwner(agent) helper + vm.prank(agent) wraps every positive-path publishRating test under the live ownerOf gate"

requirements-completed: [REQ-02, REQ-03]

# Metrics
duration: ~20min
completed: 2026-06-10
---

# Phase 3 Plan 01: RatingRegistry ERC-8004 ownerOf Gate + string cid Summary

**Swapped RatingRegistry's Phase-1 EOA gate for a live `registry.ownerOf(agentTokenId) == msg.sender` ERC-8004 cross-contract gate (negative test proven first, D-01) and added a `string cid` to the Rating struct + RatingPublished event + publishRating signature, written atomically with reasoningHash (D-02) — freezing the post-redeploy ABI shape.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-10T19:42Z (approx)
- **Completed:** 2026-06-10T20:02:23Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- Live ERC-8004 identity gate enforced in `publishRating`: a non-agent caller now reverts with `NotAgent`, a holder of `agentTokenId` passes — proven by `test_publishRating_revertsForNonAgent` (the load-bearing T-03-01 mitigation, written FIRST per D-01) and `test_publishRating_succeedsForAgent`.
- Minimal `IIdentityRegistry { ownerOf(uint256) }` interface — the only ERC-8004 dependency surface, hand-declared (no OpenZeppelin import).
- `string cid` added to the `Rating` struct, the `RatingPublished` event, and the `publishRating` signature — set in the SAME call as `reasoningHash` (atomic, D-02), round-tripping through `latestRating` (`test_latestRating_returnsCid`).
- Empty-`latestRating` sentinel updated to carry `cid == ""` (positional ctor gained the trailing `""`).
- `Deploy.s.sol` parameterized for the once-only Mainnet redeploy: passes the named `IDENTITY_REGISTRY` constant (`0x8004A169…`, Mantle Mainnet ONLY) + `vm.envUint("AGENT_TOKEN_ID")`.
- Full forge suite green: 8/8 tests pass; `forge build` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: IIdentityRegistry interface + gate NEGATIVE test FIRST (RED), then swap the gate (GREEN)** - `d88e8fc` (feat)
2. **Task 2: Add string cid to struct + event + signature (atomic with hash), update all tests + Deploy.s.sol** - `a2d0065` (feat)

_Note: This is a TDD plan (`tdd="true"` tasks). The RED state for Task 1 was a deliberate compile failure (the new 2-arg constructor / 5-arg signature did not exist yet), captured before the GREEN gate swap, per the plan's explicit "that compile failure IS the RED state" instruction. Because the contract and its tests share a single compilation unit in forge, RED (compile-fail) → GREEN (passing) was a single feat commit per task rather than separate test/feat commits._

## TDD Gate Compliance

This plan's tasks carry `tdd="true"` (not a plan-level `type: tdd` with a mandated `test(...)` → `feat(...)` commit split). The TDD discipline was honored at the step level, not as separate gate commits:

- **RED:** For Task 1, the negative gate test was written first and run in isolation; it failed to **compile** (the new constructor signature did not yet exist) — the plan explicitly defines this compile failure as the RED state ("Run `forge test --match-test test_publishRating_revertsForNonAgent` — it MUST fail to compile … That compile failure IS the RED state"). Verified: `forge test --match-test test_publishRating_revertsForNonAgent` exited 1 with `Wrong argument count … 2 arguments given but expected 1` BEFORE the contract was changed.
- **GREEN:** The gate swap (Task 1) and the cid additions (Task 2) made the tests pass (exit 0, 7→8 tests).

No standalone `test(...)` gate commit exists because the failing test and its implementation live in the same forge compilation unit and could not be committed in a compiling state separately. This is consistent with the plan's TDD-for-Solidity guidance.

## Files Created/Modified
- `src/interfaces/IIdentityRegistry.sol` (created) - Minimal ERC-8004 identity interface; declares only `ownerOf(uint256) external view returns (address)` — the single function the gate calls.
- `src/RatingRegistry.sol` (modified) - Replaced the `immutable agent` EOA with `IIdentityRegistry public immutable registry` + `uint256 public immutable agentTokenId`; swapped the `onlyAgent` body to `registry.ownerOf(agentTokenId) != msg.sender` (reusing `NotAgent`); added `string cid` to the struct, event, and `publishRating` signature (set atomically with `reasoningHash`); updated the sentinel to `Rating(address(0), 0, bytes32(0), 0, 0, address(0), "")`; refreshed contract-level natspec to reflect the gate-via-redeploy reality (D-01).
- `test/RatingRegistry.t.sol` (modified) - Added `IIdentityRegistry` import, `registryAddr` + `AGENT_TOKEN_ID`, `vm.etch` in `setUp` BEFORE any `vm.mockCall` (Pitfall 4), a `_mockGateOwner` helper; replaced the old direct-EOA gate test with `test_publishRating_revertsForNonAgent` (negative, FIRST) + `test_publishRating_succeedsForAgent`; mocked the gate + pranked the agent in every positive-path test; added `string cid` to the re-declared event, a cid arg to every `publishRating` call, and `test_latestRating_returnsCid`.
- `script/Deploy.s.sol` (modified) - Added the named `IDENTITY_REGISTRY = 0x8004A169…` constant (Mantle Mainnet ONLY comment), read `AGENT_TOKEN_ID` via `vm.envUint`, changed the constructor call to `new RatingRegistry(IDENTITY_REGISTRY, agentTokenId)`; updated natspec to reflect the one-time redeploy (D-01). `vm.envUint`/`vm.addr`/`console2.log`/`startBroadcast`/`stopBroadcast` structure preserved.

## Decisions Made
- **IIdentityRegistry is `ownerOf`-only** (D-01 Claude's-discretion): no OpenZeppelin IERC721 import — `lib/` carries only forge-std and only `ownerOf` is called.
- **Negative gate test written first, in isolation** (D-01): the cross-contract `ownerOf` call is the new failure surface; it was proven to revert before any other change.
- **Registry address as immutable arg + named Deploy constant**, never hardcoded in the contract body (D-01 single-source-of-reference + Sepolia-substitution guard).
- **cid in struct AND event, atomic with the hash** (D-02): the contract can never hold a `reasoningHash` with no retrievable `cid` pointer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Deploy.s.sol constructor change pulled forward into Task 1**
- **Found during:** Task 1 (gate swap GREEN step)
- **Issue:** The plan assigns the `Deploy.s.sol` constructor change to Task 2, but forge compiles the `script/` directory as part of the project. The moment `RatingRegistry`'s constructor changed from `(address)` to `(address, uint256)`, `script/Deploy.s.sol`'s `new RatingRegistry(deployer)` call failed to compile (`Wrong argument count: 1 given but expected 2`), which blocked running the Task 1 gate tests at all.
- **Fix:** Applied the full `Deploy.s.sol` change (named `IDENTITY_REGISTRY` constant + `AGENT_TOKEN_ID` env read + 2-arg constructor call + natspec update) during Task 1 instead of Task 2. This is exactly the change Task 2 specified, so Task 2's `Deploy.s.sol` acceptance criteria (`AGENT_TOKEN_ID` + registry-constant greps) were already satisfied when Task 2 ran.
- **Files modified:** script/Deploy.s.sol
- **Verification:** `forge test --match-test test_publishRating_revertsForNonAgent` and `…succeedsForAgent` both exit 0 after the fix; Task 2's `grep -F 'AGENT_TOKEN_ID' script/Deploy.s.sol` and registry-constant greps pass.
- **Committed in:** d88e8fc (Task 1 commit)

**2. [Rule 1 - Bug] Restored the `contract RatingRegistry {` opening line**
- **Found during:** Task 1 (gate swap GREEN step)
- **Issue:** While rewriting the contract-level natspec, my edit's replacement text ended at the `@dev` comment and dropped the `contract RatingRegistry {` declaration line, producing `Error (2314): Expected identifier but got 'public'` at the first state-variable declaration.
- **Fix:** Re-added `contract RatingRegistry {` immediately after the closing natspec line.
- **Files modified:** src/RatingRegistry.sol
- **Verification:** `forge build` exit 0; the gate tests then compiled and passed.
- **Committed in:** d88e8fc (Task 1 commit — caught and fixed before the commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 self-introduced bug)
**Impact on plan:** Both auto-fixes were necessary to compile and run the planned tests. The Deploy.s.sol pull-forward did not change scope — it executed Task 2's `Deploy.s.sol` work one task early to unblock compilation. No scope creep.

## Issues Encountered
- `foundry.lock` showed as modified after `forge build` (a forge-managed dependency lockfile with no semantic diff — only a CRLF line-ending warning, no content hunk). Left unstaged as an out-of-scope generated file; not part of this plan's changes.
- A pre-existing forge lint advisory (`named-struct-fields`) fires on the positional sentinel `return Rating(address(0), 0, bytes32(0), 0, 0, address(0), "")`. This is a note, not an error (`forge build` exits 0), and the positional form is exactly what the plan's Task 2 acceptance criterion greps for — so it was kept positional by design. Same advisory was present on the baseline build.

## User Setup Required
None - no external service configuration required for this plan. (The live mint of `AGENT_TOKEN_ID`, the `PINATA_JWT` env var, and the once-only Mainnet redeploy are downstream plans 02/03, not this contract-only plan.)

## Next Phase Readiness
- The post-redeploy contract ABI shape (ownerOf gate + `string cid`) is frozen and fully tested on the mock path — ready for Plan 03 to perform the once-only Mainnet redeploy and for Phase 4 to generate FE types from the resulting ABI.
- No live deploy was performed in this plan (correct — that is Plan 03, `autonomous:false`).
- Downstream dependency: `Deploy.s.sol` now reads `AGENT_TOKEN_ID` from the env — the agent identity NFT must be minted (Plan 02, the ordering dependency) and `AGENT_TOKEN_ID` set in `.env` before the redeploy runs.

## Self-Check: PASSED

- Files verified on disk: `src/interfaces/IIdentityRegistry.sol`, `src/RatingRegistry.sol`, `test/RatingRegistry.t.sol`, `script/Deploy.s.sol`, `.planning/phases/03-onchain-publish-erc8004/03-01-SUMMARY.md` — all FOUND.
- Commits verified in git log: `d88e8fc` (Task 1), `a2d0065` (Task 2) — all FOUND.
- `forge test --match-path test/RatingRegistry.t.sol` → 8/8 pass (exit 0); `forge build` → exit 0.

---
*Phase: 03-onchain-publish-erc8004*
*Completed: 2026-06-10*
