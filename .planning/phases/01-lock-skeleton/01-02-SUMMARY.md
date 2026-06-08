---
phase: 01-lock-skeleton
plan: 02
subsystem: contract
tags: [solidity, foundry, forge-std, ratingregistry, erc-8004-prep, unit-tests, mantle]

# Dependency graph
requires:
  - phase: 01-lock-skeleton
    provides: "Plan 1-01 Foundry scaffold (foundry.toml, forge-std v1.16.1, GradeEnum library, stub RatingRegistry + stub test + stub Deploy, constructor(address initialAgent) signature locked)"
provides:
  - "Full Phase 1 RatingRegistry.sol contract body matching CON-publishRating-signature, CON-requestRating-signature, CON-read-interface, CON-rating-schema, CON-grade-encoding"
  - "Rating struct (subject, grade, reasoningHash, confidence, timestamp, agentIdentity) — the exact ABI Plan 03 deploys and Phase 3 extends without breaking"
  - "onlyAgent modifier abstraction: Phase 3 swaps the modifier BODY (address check → ERC-8004 NFT-holder check at 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432) without changing any external function signature, event, error, or storage layout"
  - "Grade-range guard wired to GradeEnum.MAX (single source of truth for the 0..9 encoding per DEC-grade-encoding-uint8) — not a hardcoded 9"
  - "Five named unit tests (test_publishRating_rejectsNonAgent, test_publishRating_gradeRange, test_requestRating_emitsEvent, test_latestRating_returnsLast, test_ratingHistory_returnsAll) locking the surface contract behaviorally before deploy"
  - "Gas envelope baseline: deployment 429,131 gas / 1,806 bytes; publishRating avg 119,583; requestRating 23,333; latestRating avg 10,488; ratingHistory avg 19,572 (Phase 3 will compare against full impl)"
affects: [03-deploy, 03-onchain-publish, 03-erc8004-mint, 04-frontend, 04-track-record-view]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Re-declared-events-in-test pattern: contract events re-declared in the test contract so vm.expectEmit matches against them — standard forge-std convention, locked here so Phase 3 tests stay consistent"
    - "Forward-compat modifier abstraction: onlyAgent body is the ONLY thing Phase 3 modifies; same selector, same revert error (NotAgent), same gas profile shape — ABI-stable across the lock-skeleton → real-publish transition"
    - "GradeEnum.MAX as single source of truth: contract uses `if (grade > GradeEnum.MAX)` instead of `> 9`, so any future grade-scheme widening touches one library constant and the contract recompiles correctly"
    - "Zero-valued struct returned from latestRating when history is empty (not a revert) — Phase 3 frontend can rely on `latest.subject == address(0)` as the empty sentinel without a try/catch"

key-files:
  created:
    - ".planning/phases/01-lock-skeleton/01-02-SUMMARY.md"
  modified:
    - "src/RatingRegistry.sol (stub → full Phase 1 skeleton, 102 lines)"
    - "test/RatingRegistry.t.sol (stub → 5 named unit tests, 102 lines)"

key-decisions:
  - "Linter notes left unaddressed by design — the plan's <interfaces> block locks the contract source byte-for-byte. The two solc 0.8.24 forge-lint notes (unwrapped-modifier-logic, named-struct-fields) are stylistic `note` severity, not warnings or errors, and the plan's objective explicitly accepts 'no warnings beyond stylistic'. Touching the contract to silence them would diverge from the locked interface, which Plan 03 deploys verbatim."
  - "Phase 3 modifier swap = body only. The `onlyAgent` modifier's external surface (selector, NotAgent revert, no args, applied to publishRating only) is the forward-compat contract. Phase 3 will replace the body `if (msg.sender != agent) revert NotAgent();` with an ERC-8004 NFT-holder check against 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 (canonical Identity Registry on Mantle Mainnet per DEC-erc8004-canonical-addresses), and the 5 unit tests above stay green by re-pranking the agent identity correctly. Same address, same ABI, no re-deploy."

patterns-established:
  - "Per-task atomic commits: Task 1-02-01 = contract source (feat); Task 1-02-02 = test suite (test). Each leaves the repo in a forge-build-green AND forge-test-green state."
  - "Token-presence + linecount gate: the plan's automated verify checks for 12 named source tokens AND a line count floor — both protect against accidental partial replacements during a Write."

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-06-08
---

# Phase 01 Plan 02: Lock + Skeleton — RatingRegistry Contract Body Summary

**Full Phase 1 RatingRegistry.sol skeleton landed with the onlyAgent abstraction Phase 3 will swap without ABI breakage, plus 5 named unit tests proving the locked surface — forge test green 5/5, contract 1,806 bytes, ready for Plan 03 to deploy to Mantle Sepolia.**

## Performance

- **Duration:** ~3 min (195s)
- **Started:** 2026-06-08T05:08:21Z
- **Completed:** 2026-06-08T05:11:36Z
- **Tasks:** 2 / 2
- **Files modified:** 2 (src/RatingRegistry.sol, test/RatingRegistry.t.sol)

## Accomplishments

- `src/RatingRegistry.sol` rewritten end-to-end from the Plan-01 stub to the full Phase 1 skeleton per the plan's locked `<interfaces>` block. All 12 required tokens present: `function publishRating`, `function requestRating`, `function latestRating`, `function ratingHistory`, `modifier onlyAgent`, `error NotAgent`, `error InvalidGrade`, `event RatingPublished`, `event RatingRequested`, `import {GradeEnum}`, `constructor(address initialAgent)`, `if (grade > GradeEnum.MAX)`.
- `test/RatingRegistry.t.sol` rewritten end-to-end with the five named unit tests per 01-VALIDATION.md per-task verification map: `test_publishRating_rejectsNonAgent`, `test_publishRating_gradeRange`, `test_requestRating_emitsEvent`, `test_latestRating_returnsLast`, `test_ratingHistory_returnsAll`.
- `forge build` exits 0 (3 files compiled). Two `note`-severity forge-lint hints surfaced (unwrapped-modifier-logic, named-struct-fields) — both stylistic, both inside the byte-for-byte locked interface block, intentionally left as-is to keep Plan 03's deploy artifact identical to spec.
- `forge test` exits 0 with **5 passed, 0 failed, 0 skipped** on first run (no test iteration required). Each of the five tests also passes individually via `forge test --match-test` per the plan's verification gate.
- Gas envelope captured (forge-std --gas-report) — baseline for Phase 3 comparison against the full impl with ERC-8004 swap.
- onlyAgent abstraction in place exactly as specified: same selector + same NotAgent revert + same modifier name, applied only to publishRating. Phase 3 swaps the body (address check → ERC-8004 NFT-holder check at 0x8004A169...432) without touching any external surface; the 5 unit tests stay green by re-pranking the registered agent identity.

## Task Commits

Each task was committed atomically:

1. **Task 1-02-01: Replace RatingRegistry.sol stub with full Phase 1 skeleton contract** — `6ca550b` (feat)
2. **Task 1-02-02: Write 5 unit tests matching 01-VALIDATION.md per-task verification map and prove forge test green** — `7f84073` (test)

_Plan metadata commit follows separately (docs)._

## Files Created/Modified

### Created
- `.planning/phases/01-lock-skeleton/01-02-SUMMARY.md` — this file.

### Modified
- `src/RatingRegistry.sol` (12 lines → 102 lines) — replaced the empty-body stub with the full Phase 1 skeleton: `Rating` struct (6 fields), `agent` address (public), private `_history` mapping, `RatingPublished` + `RatingRequested` events, `NotAgent` + `InvalidGrade` custom errors, `onlyAgent` modifier (Phase 1 address check), `constructor(address initialAgent)`, `requestRating(address)` (any-caller event emit), `publishRating(address,uint8,bytes32,uint8) external onlyAgent` (range-guarded, appends to history, emits), `latestRating(address) view` (returns zero-valued struct when empty), `ratingHistory(address) view` (returns full array).
- `test/RatingRegistry.t.sol` (17 lines → 102 lines) — added the 5 named unit tests with re-declared events at test scope (`event RatingPublished`, `event RatingRequested`) so `vm.expectEmit` matches; `GradeEnum` imported so tests reference `GradeEnum.AAA`/`AA`/`A`/`BBB`/`D` instead of hardcoded ints; existing `setUp()` preserved (agent = address(this); registry = new RatingRegistry(agent)).

## Gas Envelope (informational — Phase 3 will compare)

From `forge test --gas-report --match-contract RatingRegistryTest`:

| Function | Min | Avg | Median | Max | # Calls |
|----------|-----|-----|--------|-----|---------|
| Deployment | — | 429,131 (size 1,806 bytes) | — | — | — |
| publishRating | 24,329 | 119,583 | 142,782 | 159,882 | 8 |
| requestRating | 23,333 | 23,333 | 23,333 | 23,333 | 1 |
| latestRating (view) | 3,168 | 10,488 | 14,148 | 14,148 | 3 |
| ratingHistory (view) | 2,817 | 19,572 | 19,572 | 36,328 | 2 |

publishRating's spread (24k floor for the revert path, 160k ceiling for a fresh-storage push) is the right shape — Phase 3 adds an ERC-8004 SLOAD inside the modifier (~2,100 gas) plus IPFS-hash sourcing; expect the avg to land around 122k-125k post-swap, still under Mantle's per-block budget by orders of magnitude.

## Decisions Made

- **Linter `note` hints left as-is** — the plan's `<interfaces>` block locks the contract source byte-for-byte (Step 2 of Task 1-02-01: "Replace its contents ENTIRELY with the EXACT code"). forge-lint surfaced two `note`-severity hints (unwrapped-modifier-logic asking to extract the modifier check into an internal function, and named-struct-fields asking for named-arg syntax on the empty-Rating return). Both are stylistic, both are explicitly accepted by the plan's objective ("no warnings beyond stylistic"), and modifying them would diverge from the locked interface that Plan 03 will deploy verbatim. They will not affect Plan 03 verification on Blockscout.
- **agentIdentity = msg.sender preserved in Phase 1** — per the plan's critical implementation notes, this field stores `msg.sender` in Phase 1 (which equals `agent` because of the onlyAgent gate). Phase 3 will swap to reading from the canonical ERC-8004 Identity Registry, but the struct shape and the field NAME stay identical — forward-compat by design.
- **REQ-02 NOT marked complete** — the plan's frontmatter lists `requirements: [REQ-02]`, but REQUIREMENTS.md (traceability table) tracks REQ-02 as spanning Phase 1 (skeleton) → Phase 3 (real publish). The REQ-02 owning phase is 3, not 1, so we do NOT mark it complete here. The skeleton subset is satisfied; the real publish (with IPFS reasoningHash sourcing and ERC-8004 identity enforcement) is Phase 3's. Result: `requirements-completed: []` in the frontmatter, and REQ-02 stays "Pending" in REQUIREMENTS.md until Phase 3 closes it.

## Deviations from Plan

None — plan executed exactly as written. Both tasks produced green on first attempt.

- Task 1-02-01: `forge build` exited 0 on the first compile of the rewritten contract. The two forge-lint hints are not deviations — they're stylistic `note`s on intentionally-locked source.
- Task 1-02-02: All 5 unit tests passed on the first `forge test` run. No test-side debugging needed; no contract-side fixes needed.

## Issues Encountered

None.

## Threat Flags

None. The plan's threat register entries are all addressed in the shipped code:

- **T-1-02-E1 (Elevation of Privilege — mitigate):** `onlyAgent` modifier reverts with `NotAgent()` for any non-agent caller; `test_publishRating_rejectsNonAgent` asserts this is the actual behavior. Selector-stable for Phase 3 swap.
- **T-1-02-T1 (Tampering — mitigate):** `if (grade > GradeEnum.MAX) revert InvalidGrade();` guard wired at publishRating entry; `test_publishRating_gradeRange` asserts grade 9 succeeds and grade 10 reverts.
- **T-1-02-D1 (DoS — accept):** requestRating spam accepted per CON-onchain-trigger-required; gas cost is the rate limiter; off-chain agent in Phase 3 will filter and rate-limit downstream.
- **T-1-02-I1 (Info Disclosure — accept):** _history is `private`, but all ratings are intended-public by design; no PII; verifiable on-chain reasoning hashes are the value prop.
- **T-1-02-R1 (Repudiation — mitigate):** `agentIdentity = msg.sender` in Phase 1 (== `agent`), forward-compat to Phase 3's ERC-8004 identity read. Field name unchanged, same surface.

No new surface introduced beyond what's in the threat model.

## TDD Gate Compliance

Both tasks were marked `tdd="true"` in the plan; the plan's <interfaces> block locks the contract AND test source byte-for-byte, so the conventional RED → GREEN cycle was collapsed into a single drop-in for each. The two commits land in the natural TDD order anyway:

- Task 1-02-01 (`6ca550b`, feat) — writes the implementation that the locked tests will exercise.
- Task 1-02-02 (`7f84073`, test) — writes the locked tests; all 5 pass against the contract from `6ca550b`.

A strict RED-first cycle (commit failing tests against the stub first, then implement) was not performed because the test file imports `GradeEnum` and references `RatingRegistry.Rating`/`RatingRegistry.NotAgent.selector`/`RatingRegistry.InvalidGrade.selector` — all of which require the full contract surface to be present for the test contract to even compile. With the Plan-01 stub still in place, the test file would fail to compile (not RED-fail at runtime), which would not be a valid RED gate. Reversing the task order (test first) would have produced compile errors, not behavioral failures. The plan's locked interface block is internally consistent with the green-on-first-run outcome observed.

## User Setup Required

None. Plan 03 will require a `.env` with `PRIVATE_KEY` populated for Mantle Sepolia deploy, but `.env.example` from Plan 1-01 already documents that — no new user action needed for Plan 02 itself.

## Next Phase Readiness

**Plan 03 (deploy + verify on Mantle Sepolia) is unblocked:**

- `forge build` green: deployable artifact at `out/RatingRegistry.sol/RatingRegistry.json` (1,806-byte runtime, 429,131-gas deploy — well under any Mantle block budget).
- `forge test` green: 5/5 unit tests prove the surface contract before the artifact ever hits a public RPC.
- `script/Deploy.s.sol` from Plan 1-01 already imports `RatingRegistry` and exposes `run() returns (RatingRegistry registry)` — Plan 03 fills the body with `vm.envUint("PRIVATE_KEY") → vm.startBroadcast → new RatingRegistry(deployer)` and runs `forge script ... --rpc-url mantle_sepolia --broadcast --verify --verifier blockscout`.
- foundry.toml's `[rpc_endpoints]` (mantle_sepolia → https://rpc.sepolia.mantle.xyz) and `[etherscan]` Blockscout verifier endpoints are pre-wired — Plan 03 does NOT need to touch foundry.toml.
- Constructor's `address initialAgent` matches what the deploy script will pass (the deployer address loaded from `vm.envUint("PRIVATE_KEY")` — Plan 03 may also pass a separate agent address if the deployer != agent operationally).

**Phase 3 readiness (later):**

- onlyAgent abstraction is locked at the selector level. Phase 3 will modify the body to read from `IIdentityRegistry(0x8004A169FB4a3325136EB29fA0ceB6D2e539a432).balanceOf(msg.sender) > 0` (or equivalent ERC-8004 check). All 5 unit tests stay green by re-pranking the registered agent identity. No ABI break, no re-deploy needed.
- `agentIdentity` field semantics will shift from `msg.sender` to "ERC-8004 identity address registered to msg.sender" — same field type (address), no struct layout change.

**Wave 1 of 01-VALIDATION.md is complete** — every per-task verification row tagged `1-02-02-*` is now ✅ green: all 5 unit tests pass under `forge test`.

## Self-Check

Verifying claims against disk and git history before declaring complete.

### Files exist on disk

- FOUND: `src/RatingRegistry.sol` (102 lines, all 12 required tokens present)
- FOUND: `test/RatingRegistry.t.sol` (5 `test_*` functions present)
- FOUND: `.planning/phases/01-lock-skeleton/01-02-SUMMARY.md` (this file)

### Commits exist in git log

- FOUND: `6ca550b` (feat(01-02): implement RatingRegistry Phase 1 skeleton)
- FOUND: `7f84073` (test(01-02): add 5 unit tests per 01-VALIDATION.md verification map)

### Build/test gates

- `forge build` exits 0 ("Compiler run successful!", 3 files compiled, 2 stylistic `note` hints, 0 warnings, 0 errors).
- `forge test` exits 0 ("5 passed; 0 failed; 0 skipped").
- Each of the 5 named unit tests passes individually via `forge test --match-test ... --match-contract RatingRegistryTest` (exit 0 for all five).

## Self-Check: PASSED

---
*Phase: 01-lock-skeleton*
*Plan: 02*
*Completed: 2026-06-08*
