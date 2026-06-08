---
phase: 01-lock-skeleton
plan: 01
subsystem: infra
tags: [foundry, solidity, forge-std, mantle, scaffolding, erc-8004-prep]

# Dependency graph
requires:
  - phase: 00-discovery
    provides: Locked decisions (DEC-tech-stack, DEC-grade-encoding-uint8, DEC-deployment-target-plan) and RESEARCH.md scaffold patterns
provides:
  - Foundry project rooted at repo root with solc 0.8.24, optimizer 200, paris EVM
  - Named RPC endpoints for mantle (5000) and mantle_sepolia (5003) usable via --rpc-url mantle_sepolia
  - Etherscan/Blockscout verifier endpoints pre-wired in foundry.toml for Plan 03
  - forge-std v1.16.1 installed under lib/forge-std (Test.sol and Script.sol resolvable via remappings)
  - Stub src/RatingRegistry.sol with constructor(address) signature locked for Plan 02 to drop into without test rewrites
  - Locked DEC-grade-encoding-uint8 mapping materialized as library GradeEnum (AAA=0 .. D=9, MAX=9) ready to be mirrored in TS in Phase 2/4
  - Stub test/RatingRegistry.t.sol with setUp() constructing registry as address(this) — Plan 02's onlyAgent tests slot in unchanged
  - Stub script/Deploy.s.sol extending forge-std Script — Plan 03 fills run() body without changing signature
  - .env.example documenting all four deployment env vars (PRIVATE_KEY, MANTLE_SEPOLIA_RPC_URL, MANTLE_RPC_URL, MANTLE_EXPLORER_KEY)
  - .gitignore covering Foundry artifacts (out/, cache/, broadcast/) and secrets (.env, .env.local, *.pem, *.key)
affects: [02-contract, 03-deploy, agent-phase, frontend-phase]

# Tech tracking
tech-stack:
  added:
    - "Foundry 1.5.1-stable (forge/cast/anvil)"
    - "forge-std v1.16.1 (commit 620536fa5277db4e3fd46772d5cbc1ea0696fb43)"
    - "Solidity 0.8.24 (compiler locked in foundry.toml)"
  patterns:
    - "Foundry project at repo root (no nested touchstone-contracts/ wrapper) — single git history for contracts + planning"
    - "Named [rpc_endpoints] in foundry.toml so deploy commands stay short (--rpc-url mantle_sepolia)"
    - "Stub constructors that pre-commit to the final ABI signature (constructor(address initialAgent)) so Plan 02 drops in without breaking test setUp() or Deploy script"
    - "Shared uint8 grade enum lives in src/constants/ — TS mirrors in Phase 2 (agent) and Phase 4 (frontend) reference this as the source of truth"
    - "Blockscout-first verification path locked in [etherscan] block (no API key required per DEC-deployment-target-plan)"

key-files:
  created:
    - "foundry.toml"
    - "remappings.txt"
    - ".gitignore"
    - ".gitmodules"
    - ".env.example"
    - "foundry.lock"
    - "lib/forge-std/ (submodule)"
    - "src/RatingRegistry.sol"
    - "src/constants/GradeEnum.sol"
    - "test/RatingRegistry.t.sol"
    - "script/Deploy.s.sol"
  modified: []

key-decisions:
  - "forge install foundry-rs/forge-std executed without --no-commit flag (forge 1.5.1 made --no-commit the default; passing the flag now errors). Behavior unchanged: clean working tree after install."
  - "foundry.lock added to git (forge 1.5.1 generates this to pin forge-std). Treated like package-lock.json — committed so Plan 02/03 and CI resolve the same forge-std build."
  - "Foundry project rooted at repo root (no touchstone-contracts/ subfolder) to keep contracts and .planning/ in one history. Matches the file paths the plan's <files_modified> frontmatter declared."
  - "evm_version = paris kept from the interfaces block — Mantle tracks Ethereum upgrades but paris is the conservative default and works for both 5000 and 5003."

patterns-established:
  - "Stub-with-locked-signature: every Phase 1 stub pre-commits to the final external ABI (constructor takes address, Deploy.run returns RatingRegistry, test setUp constructs with address(this)). Plan 02/03 fill bodies without breaking call sites."
  - "Atomic per-task commit boundary: Task 1-01-01 = scaffolding/lib only; Task 1-01-02 = source/test/script/env. Each leaves the repo in a forge-build-green state."

requirements-completed: [REQ-15]

# Metrics
duration: 5min
completed: 2026-06-08
---

# Phase 01 Plan 01: Lock + Skeleton — Foundry Scaffold Summary

**Foundry project at repo root with solc 0.8.24, forge-std v1.16.1, Mantle 5000/5003 RPC + Blockscout verifier wired, and stub RatingRegistry/Deploy/Test files all compiling — Plan 02 contract logic and Plan 03 deploy can drop in unblocked.**

## Performance

- **Duration:** 5 min (313s)
- **Started:** 2026-06-08T04:55:53Z
- **Completed:** 2026-06-08T05:01:06Z
- **Tasks:** 2 / 2
- **Files created:** 11 (6 in Task 1-01-01 + 5 in Task 1-01-02)

## Accomplishments

- Foundry project initialized at repo root: `forge build` exits 0, compiles 24 files (forge-std + 4 Touchstone stubs) under solc 0.8.24 with no warnings.
- forge-std v1.16.1 installed as git submodule (`lib/forge-std/`, commit `620536fa5277db4e3fd46772d5cbc1ea0696fb43`) with remappings.txt resolving `forge-std/Test.sol` and `forge-std/Script.sol`.
- Both Mantle networks pre-wired in `foundry.toml`: `mantle` (chain 5000, mainnet) and `mantle_sepolia` (chain 5003, testnet) under `[rpc_endpoints]`; Blockscout verifier endpoints in `[etherscan]` (no API key needed per DEC-deployment-target-plan, but `${MANTLE_EXPLORER_KEY}` interpolation accepted for forward compat).
- `src/constants/GradeEnum.sol` materializes the DEC-grade-encoding-uint8 mapping (0=AAA, 1=AA, 2=A, 3=BBB, 4=BB, 5=B, 6=CCC, 7=CC, 8=C, 9=D, MAX=9) as a Solidity library — single source of truth for the contract; TS mirrors land in Phase 2/4.
- Stub `RatingRegistry.sol`, `test/RatingRegistry.t.sol`, and `script/Deploy.s.sol` all compile cleanly and pre-commit to the final external ABI: Plan 02 fills the contract body without changing the constructor signature (`address initialAgent`); the test `setUp()` already constructs the registry with `address(this)` so onlyAgent tests work unchanged; the Deploy stub already imports RatingRegistry and exposes `run() returns (RatingRegistry registry)`.
- `forge test` exits 0 ("No tests found" — expected; Plan 02 adds the 5 unit tests per 01-VALIDATION.md).
- Secrets isolated: `.env.example` documents the four deployment env vars; `.env` is gitignored on a dedicated line; no `.env` file exists in the tree.

## Task Commits

1. **Task 1-01-01: Initialize Foundry project — config, remappings, gitignore, forge-std** — `29bbb13` (chore)
2. **Task 1-01-02: Scaffold src/test/script stubs + .env.example** — `c4faaf3` (feat)

_Plan metadata commit follows separately (docs)._

## Files Created/Modified

### Created — Task 1-01-01

- `foundry.toml` — Foundry profile with solc 0.8.24, optimizer 200 runs, evm_version paris; `[rpc_endpoints]` for mantle (5000) + mantle_sepolia (5003); `[etherscan]` block targeting Blockscout endpoints.
- `remappings.txt` — single line `forge-std/=lib/forge-std/src/`.
- `.gitignore` — covers Foundry artifacts (`out/`, `cache/`, `broadcast/`), secrets (`.env`, `.env.local`, `*.pem`, `*.key`), OS noise (`.DS_Store`, `Thumbs.db`), and editor folders (`.vscode/`, `.idea/`).
- `.gitmodules` + `lib/forge-std/` — forge-std v1.16.1 as git submodule, tag `v1.16.1`, commit `620536fa5277db4e3fd46772d5cbc1ea0696fb43`.
- `foundry.lock` — forge 1.5.1 lockfile pinning the forge-std commit (analog to package-lock.json; committed so future agents resolve the same build).

### Created — Task 1-01-02

- `src/constants/GradeEnum.sol` — `library GradeEnum` exposing internal constants AAA=0..D=9 + MAX=9 per DEC-grade-encoding-uint8.
- `src/RatingRegistry.sol` — `contract RatingRegistry` stub with `constructor(address /* initialAgent */) {}`. Plan 02 fills body with Rating struct, agent state, _history mapping, RatingPublished/RatingRequested events, NotAgent/InvalidGrade errors, onlyAgent modifier, requestRating/publishRating/latestRating/ratingHistory functions.
- `test/RatingRegistry.t.sol` — `contract RatingRegistryTest is Test` importing `forge-std/Test.sol` and `../src/RatingRegistry.sol`; setUp() sets `agent = address(this)` and constructs the registry. Plan 02 fills 5 unit tests per 01-VALIDATION.md table.
- `script/Deploy.s.sol` — `contract Deploy is Script` with empty `run() external returns (RatingRegistry registry)`. Plan 03 fills body with `vm.envUint("PRIVATE_KEY")` + `vm.startBroadcast` + `new RatingRegistry(agent)`.
- `.env.example` — placeholders for PRIVATE_KEY, MANTLE_SEPOLIA_RPC_URL (default `https://rpc.sepolia.mantle.xyz`), MANTLE_RPC_URL (default `https://rpc.mantle.xyz`), MANTLE_EXPLORER_KEY (optional).

## Decisions Made

- **Drop `--no-commit` flag from `forge install`** — forge 1.5.1-stable removed the flag (it's now the default behavior). Rule 3 auto-fix: ran `forge install foundry-rs/forge-std` instead. Outcome identical (clean working tree after install + no auto-commit), and lib/forge-std/ was successfully checked out at v1.16.1. Documented in Deviations below.
- **Commit `foundry.lock`** — forge 1.5.1 auto-generates this file to pin forge-std. Treated as a lock file analog to `package-lock.json`: committed so Plan 02, Plan 03, and any CI build resolve the identical forge-std code. The lock pins commit `620536fa5277db4e3fd46772d5cbc1ea0696fb43` (the same one in `.gitmodules`).
- **Foundry rooted at repo root, not in `touchstone-contracts/` subfolder** — the plan's `<files_modified>` frontmatter explicitly declares paths like `foundry.toml`, `src/RatingRegistry.sol` at the root, and PROJECT.md/STATE.md/.planning/ already live at root. One git history for contracts + planning artifacts.
- **`evm_version = paris`** — kept from the locked interfaces block. Mantle tracks Ethereum upgrades; paris is the conservative default. Plan 03 can override at deploy time if needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `forge install --no-commit` flag is no longer supported in forge 1.5.1**

- **Found during:** Task 1-01-01 (Step 5 — install forge-std).
- **Issue:** The plan's command `forge install foundry-rs/forge-std --no-commit` errored with `error: unexpected argument '--no-commit' found`. Forge 1.5.1-stable changed the flag semantics: `--no-commit` was removed and "do not auto-commit" is now the default behavior (the new flag is `--commit` to opt-in to auto-committing).
- **Fix:** Re-ran the install without the flag: `forge install foundry-rs/forge-std`. The same intent is achieved — forge-std v1.16.1 was checked out into `lib/forge-std/` and no automatic commit was created.
- **Files affected:** `.gitmodules`, `lib/forge-std/`, `foundry.lock` (all created as expected).
- **Verification:** `Test-Path lib/forge-std/src/Test.sol` returns True; `forge build` exits 0; submodule resolves to tag v1.16.1 / commit `620536fa5277db4e3fd46772d5cbc1ea0696fb43`.
- **Committed in:** `29bbb13` (Task 1-01-01 commit).

---

**Total deviations:** 1 auto-fixed (1 blocking — tooling version drift).
**Impact on plan:** Zero. Same artifacts on disk, same forge-std version, same git history shape. The plan was authored against an older forge release; the fix preserves the intent exactly.

## Issues Encountered

None beyond the deviation above. `forge build` was clean on first attempt with no compiler warnings on any of the four stub files (including the empty `run()` body in `Deploy.s.sol` — solc 0.8.24 accepts the uninitialized named return without complaint, so no follow-up patch needed).

## User Setup Required

None. `.env.example` is checked in for the user to copy to `.env` before Plan 03 deploy; no external service configuration needed for Phase 1 Plan 01 itself.

## Threat Flags

None. The threat-register entries from the plan are all addressed:

- T-1-01-S1 (mitigate): `.env` is on a dedicated line in `.gitignore`; `.env.example` is the only env file committed and contains placeholder values.
- T-1-01-S2 (accept): `${MANTLE_EXPLORER_KEY}` interpolation is left in `foundry.toml`; Blockscout path does not require a key per DEC-deployment-target-plan.
- T-1-01-T1 (accept): forge-std pinned to v1.16.1 in `.gitmodules` + `foundry.lock`; submodule is read-only test harness, not production-deployed.

## Next Phase Readiness

**Plan 02 (RatingRegistry contract body) is unblocked:**

- `forge test` loop is green-and-empty — Plan 02 just adds the 5 unit tests to `test/RatingRegistry.t.sol` and they will execute.
- `src/RatingRegistry.sol`'s constructor signature `constructor(address initialAgent)` is locked — Plan 02 fills the body without breaking the test `setUp()` (which already passes `address(this)`) or the Deploy script (which Plan 03 will wire).
- `src/constants/GradeEnum.sol` is in place — Plan 02's `publishRating` can reference `GradeEnum.MAX` directly for grade-range validation.

**Plan 03 (deploy) is unblocked:**

- `[rpc_endpoints]` for both 5000 + 5003 are configured — `forge script ... --rpc-url mantle_sepolia` works without extra config.
- `[etherscan]` block points at Blockscout — `--verify --verifier blockscout` resolves the URL from foundry.toml.
- `script/Deploy.s.sol` already imports `RatingRegistry` and has the right return type — Plan 03 just fills `vm.envUint("PRIVATE_KEY") + vm.startBroadcast(...) + new RatingRegistry(agent)`.
- `.env.example` documents the deployment vars — user copies to `.env`, fills `PRIVATE_KEY`, and Plan 03 reads from `vm.envUint`.

**Wave 0 of 01-VALIDATION.md is complete** — every "❌ W0" row that depended on scaffolding is now resolvable.

## Self-Check

Verifying claims against disk and git history before declaring complete.

### Files exist on disk

- FOUND: `foundry.toml`
- FOUND: `remappings.txt`
- FOUND: `.gitignore`
- FOUND: `.gitmodules`
- FOUND: `.env.example`
- FOUND: `foundry.lock`
- FOUND: `lib/forge-std/src/Test.sol`
- FOUND: `lib/forge-std/src/Script.sol`
- FOUND: `src/RatingRegistry.sol`
- FOUND: `src/constants/GradeEnum.sol`
- FOUND: `test/RatingRegistry.t.sol`
- FOUND: `script/Deploy.s.sol`
- ABSENT (as required): `.env`

### Commits exist in git log

- FOUND: `29bbb13` (chore(01-01): initialize Foundry project with forge-std)
- FOUND: `c4faaf3` (feat(01-01): scaffold src/test/script stubs and .env.example)

### Build/test gates

- `forge build` exits 0 with "Compiler run successful!" (24 files compiled, no warnings).
- `forge test` exits 0 with "No tests found in project!" (expected — Plan 02 adds them).

## Self-Check: PASSED

---
*Phase: 01-lock-skeleton*
*Plan: 01*
*Completed: 2026-06-08*
