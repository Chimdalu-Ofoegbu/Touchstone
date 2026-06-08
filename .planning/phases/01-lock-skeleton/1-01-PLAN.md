---
phase: 01-lock-skeleton
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - foundry.toml
  - .gitignore
  - .env.example
  - lib/forge-std/
  - src/RatingRegistry.sol
  - src/constants/GradeEnum.sol
  - test/RatingRegistry.t.sol
  - script/Deploy.s.sol
  - remappings.txt
autonomous: true
requirements: [REQ-15]
must_haves:
  truths:
    - "Foundry project layout exists at repo root and `forge build` exits 0."
    - "Shared grade-encoding constants file exists at src/constants/GradeEnum.sol mapping uint8 0..9 to AAA..D per DEC-grade-encoding-uint8."
    - "Skeleton source files (RatingRegistry.sol, GradeEnum.sol), test file (RatingRegistry.t.sol), and deploy script (Deploy.s.sol) all compile cleanly under solc 0.8.24."
    - ".env.example documents PRIVATE_KEY and MANTLE_SEPOLIA_RPC_URL placeholders; .env is gitignored."
  artifacts:
    - path: "foundry.toml"
      provides: "Foundry config with solc 0.8.24, optimizer 200, [rpc_endpoints] mantle + mantle_sepolia, [etherscan] entries"
      contains: "solc = \"0.8.24\""
    - path: ".gitignore"
      provides: "Git ignore rules for Foundry artifacts and secrets"
      contains: ".env"
    - path: ".env.example"
      provides: "Documented env var placeholders for deployer key + Sepolia RPC URL"
      contains: "PRIVATE_KEY="
    - path: "lib/forge-std"
      provides: "forge-std library checked out under lib/"
    - path: "src/RatingRegistry.sol"
      provides: "Empty SPDX/pragma stub of contract RatingRegistry (real impl in Plan 02)"
      contains: "contract RatingRegistry"
    - path: "src/constants/GradeEnum.sol"
      provides: "Library GradeEnum with uint8 constants AAA=0..D=9 per DEC-grade-encoding-uint8"
      contains: "library GradeEnum"
    - path: "test/RatingRegistry.t.sol"
      provides: "Foundry test scaffold importing RatingRegistry, empty setUp"
      contains: "contract RatingRegistryTest"
    - path: "script/Deploy.s.sol"
      provides: "Forge script stub extending forge-std Script with empty run()"
      contains: "contract Deploy is Script"
    - path: "remappings.txt"
      provides: "forge-std remapping line"
      contains: "forge-std/=lib/forge-std/src/"
  key_links:
    - from: "foundry.toml"
      to: "lib/forge-std"
      via: "libs = [\"lib\"] in [profile.default]"
      pattern: "libs\\s*=\\s*\\[\"lib\"\\]"
    - from: "test/RatingRegistry.t.sol"
      to: "src/RatingRegistry.sol"
      via: "import {RatingRegistry} from \"../src/RatingRegistry.sol\""
      pattern: "import.*RatingRegistry"
    - from: "script/Deploy.s.sol"
      to: "src/RatingRegistry.sol"
      via: "import {RatingRegistry} from \"../src/RatingRegistry.sol\""
      pattern: "import.*RatingRegistry"
---

<objective>
Stand up the Foundry project scaffolding for the Touchstone contracts repo at the project root. This plan creates ONLY the directory layout, configuration files, and EMPTY/STUB source/test/script files — every file compiles under solc 0.8.24, but the contract logic, full test bodies, and deploy logic land in Plans 02 and 03. This is the Wave 0 foundation per 01-VALIDATION.md.

Purpose: Day 1 of a 5-day ship target. Plan 02 needs a working `forge test` loop; Plan 03 needs a working `forge script` deploy harness; both need a configured solc/RPC/verifier stack. Pre-building the scaffold in one focused pass means Plans 02-03 are pure content work (write the contract, write the tests, run the deploy).

Output: A Foundry project that `forge build` compiles successfully (with stub bodies). Repo root contains `foundry.toml`, `remappings.txt`, `.gitignore`, `.env.example`, and the `src/`, `src/constants/`, `test/`, `script/`, `lib/forge-std/` tree fully populated with stub files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-lock-skeleton/RESEARCH.md
@.planning/phases/01-lock-skeleton/01-VALIDATION.md
</context>

<interfaces>
<!-- Key contracts the executor needs. Embedded so no codebase exploration is required. -->

Solc version (locked by RESEARCH.md DEC-tech-stack + matches canonical ERC-8004 on Mantle):
```
solc 0.8.24
```

Final foundry.toml shape (executor writes this EXACTLY):
```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
test = "test"
script = "script"
solc = "0.8.24"
optimizer = true
optimizer_runs = 200
evm_version = "paris"

[rpc_endpoints]
mantle = "https://rpc.mantle.xyz"
mantle_sepolia = "https://rpc.sepolia.mantle.xyz"

[etherscan]
mantle = { key = "${MANTLE_EXPLORER_KEY}", url = "https://explorer.mantle.xyz/api/", chain = 5000 }
mantle_sepolia = { key = "${MANTLE_EXPLORER_KEY}", url = "https://explorer.sepolia.mantle.xyz/api/", chain = 5003 }
```

Final remappings.txt:
```
forge-std/=lib/forge-std/src/
```

Final .gitignore additions (must include all of):
```
# Foundry
out/
cache/
broadcast/

# Secrets
.env
.env.local
*.pem
*.key

# OS
.DS_Store
Thumbs.db

# Editor
.vscode/
.idea/
```

Final .env.example:
```
# Touchstone deployer secrets — copy to .env (gitignored) and fill in.
# DO NOT commit a populated .env file.

# Hex private key for the deployer wallet (0x...). Fund via https://faucet.sepolia.mantle.xyz/ for Sepolia.
PRIVATE_KEY=

# Mantle Sepolia RPC (default public endpoint is fine for iteration).
MANTLE_SEPOLIA_RPC_URL=https://rpc.sepolia.mantle.xyz

# Mantle Mainnet RPC (used on Day 5 — leave empty for Phase 1).
MANTLE_RPC_URL=https://rpc.mantle.xyz

# Optional: Etherscan/Blockscout key. Blockscout does NOT require one.
MANTLE_EXPLORER_KEY=
```

Final src/constants/GradeEnum.sol (per DEC-grade-encoding-uint8 — locked: 0=AAA, 1=AA, 2=A, 3=BBB, 4=BB, 5=B, 6=CCC, 7=CC, 8=C, 9=D):
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title GradeEnum
/// @notice Shared uint8 grade encoding per DEC-grade-encoding-uint8.
/// @dev Mirror this mapping in agent (TS) and frontend (TS) constants files in Phase 2+.
library GradeEnum {
    uint8 internal constant AAA = 0;
    uint8 internal constant AA  = 1;
    uint8 internal constant A   = 2;
    uint8 internal constant BBB = 3;
    uint8 internal constant BB  = 4;
    uint8 internal constant B   = 5;
    uint8 internal constant CCC = 6;
    uint8 internal constant CC  = 7;
    uint8 internal constant C   = 8;
    uint8 internal constant D   = 9;

    /// @notice Maximum valid grade value (inclusive). Anything > MAX is invalid.
    uint8 internal constant MAX = 9;
}
```

Final src/RatingRegistry.sol stub (Plan 02 replaces body — this file must compile cleanly now):
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title RatingRegistry (Phase 1 skeleton — Plan 02 fills implementation)
/// @notice Stub contract — real state, events, modifiers, and functions land in Plan 02.
contract RatingRegistry {
    // Plan 02 fills in: Rating struct, agent address, _history mapping,
    // RatingPublished/RatingRequested events, NotAgent/InvalidGrade errors,
    // onlyAgent modifier, constructor(address initialAgent),
    // requestRating, publishRating, latestRating, ratingHistory.
    constructor(address /* initialAgent */) {}
}
```

Final test/RatingRegistry.t.sol stub (Plan 02 fills in the 5 unit tests):
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {RatingRegistry} from "../src/RatingRegistry.sol";

/// @notice Plan 02 fills in the 5 unit tests per 01-VALIDATION.md per-task verification map.
contract RatingRegistryTest is Test {
    RatingRegistry internal registry;
    address internal agent;
    address internal subject = address(0xBEEF);

    function setUp() public {
        agent = address(this);
        registry = new RatingRegistry(agent);
    }
}
```

Final script/Deploy.s.sol stub (Plan 03 fills in vm.startBroadcast + new RatingRegistry(agent)):
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {RatingRegistry} from "../src/RatingRegistry.sol";

/// @notice Plan 03 fills in run() with vm.startBroadcast + new RatingRegistry(agent).
contract Deploy is Script {
    function run() external returns (RatingRegistry registry) {
        // Plan 03 implements.
    }
}
```
</interfaces>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1-01-01: Initialize Foundry project — config, remappings, gitignore, forge-std</name>
  <read_first>
    - .planning/phases/01-lock-skeleton/RESEARCH.md (sections "Recommended Project Structure", "Pattern 2: foundry.toml with named RPC endpoints", "Track B Stream 5")
    - .planning/phases/01-lock-skeleton/01-VALIDATION.md (Wave 0 Requirements section)
    - .planning/PROJECT.md (DEC-tech-stack + DEC-deployment-target-plan)
    - Existing repo root (verify there is no pre-existing foundry.toml / src / lib — confirm greenfield state). Use Glob "foundry.toml" and Glob "src/**" to confirm absence before writing.
  </read_first>
  <files>foundry.toml, remappings.txt, .gitignore, lib/forge-std/</files>
  <behavior>
    - foundry.toml compiles via `forge build` (even with no .sol files yet) and exposes mantle + mantle_sepolia RPC aliases.
    - remappings.txt maps forge-std/ to lib/forge-std/src/ so `import {Test} from "forge-std/Test.sol"` resolves.
    - .gitignore prevents committing .env, out/, cache/, broadcast/.
    - lib/forge-std contains the forge-std submodule checked out at the latest stable tag.
  </behavior>
  <action>
    Run all steps from the repo root: `C:\Users\Ben\Desktop\B3NSAG3\Hackathons\Mantle - Turing\Touchstone\`.

    1. Pre-flight check: confirm `forge --version` succeeds. If `forge` is not on PATH, STOP and surface to the user — installation instructions per RESEARCH.md: `curl -L https://foundry.paradigm.xyz | bash && foundryup`. Do NOT attempt to auto-install (requires shell init).

    2. Write `foundry.toml` at repo root with the EXACT content from <interfaces> "Final foundry.toml shape" above. Use the Write tool, not heredoc.

    3. Write `remappings.txt` at repo root with the EXACT content from <interfaces> "Final remappings.txt" above (single line: `forge-std/=lib/forge-std/src/`).

    4. Check for an existing `.gitignore` at repo root via Read. If it exists, use Edit to append the lines from <interfaces> "Final .gitignore additions" (do NOT duplicate lines already present — use Grep first to check which entries are missing). If it does not exist, Write the full block from <interfaces>.

    5. Install forge-std as a submodule. Per RESEARCH.md the canonical command is `forge install foundry-rs/forge-std --no-commit`. Execute:
       ```
       forge install foundry-rs/forge-std --no-commit
       ```
       This creates `lib/forge-std/` populated with the forge-std source. If the command fails because the directory is not yet a git repo, run `git init` first (note: the repo IS already a git repo per the harness git status — so this should not happen, but handle defensively).

    6. Verify install: `Glob lib/forge-std/src/Test.sol` must return a hit. If empty, retry the install once; if still empty, surface the failure.

    7. Run `forge build` from the repo root. With no .sol files in src/ yet, forge will still validate foundry.toml syntax and the remappings file. Expected: exit code 0, output mentioning "Nothing to compile" or compiling forge-std artifacts. If non-zero exit, read the error and fix foundry.toml syntax (most common issue: wrong quoting in [etherscan] section).

    Decision recorded per D-tech-stack (Foundry) and DEC-deployment-target-plan (Mantle Sepolia 5003 + Mantle Mainnet 5000 both pre-configured in foundry.toml so Plan 03 can deploy to either without further config edits).
  </action>
  <verify>
    <automated>forge build *>&amp;1 | Tee-Object -FilePath "$env:TEMP/forge-build.log" ; if ($LASTEXITCODE -ne 0) { exit 1 } ; if (-not (Test-Path foundry.toml)) { exit 1 } ; if (-not (Test-Path remappings.txt)) { exit 1 } ; if (-not (Test-Path .gitignore)) { exit 1 } ; if (-not (Test-Path lib/forge-std/src/Test.sol)) { exit 1 } ; if (-not (Select-String -Path foundry.toml -Pattern 'solc = "0\.8\.24"' -Quiet)) { exit 1 } ; if (-not (Select-String -Path foundry.toml -Pattern 'mantle_sepolia' -Quiet)) { exit 1 } ; if (-not (Select-String -Path .gitignore -Pattern '^\.env$' -Quiet)) { exit 1 } ; if (-not (Select-String -Path remappings.txt -Pattern 'forge-std/=lib/forge-std/src/' -SimpleMatch -Quiet)) { exit 1 } ; exit 0</automated>
  </verify>
  <acceptance_criteria>
    - `forge build` exits 0.
    - `foundry.toml` exists at repo root and contains the literal string `solc = "0.8.24"`.
    - `foundry.toml` contains both `mantle = "https://rpc.mantle.xyz"` and `mantle_sepolia = "https://rpc.sepolia.mantle.xyz"` in [rpc_endpoints].
    - `remappings.txt` exists and contains the literal line `forge-std/=lib/forge-std/src/`.
    - `.gitignore` contains `.env` on its own line (verified by `Select-String -Path .gitignore -Pattern '^\.env$' -Quiet`).
    - `.gitignore` contains `out/`, `cache/`, and `broadcast/`.
    - `lib/forge-std/src/Test.sol` exists (forge-std submodule materialized).
  </acceptance_criteria>
  <done>Foundry project compiles. forge-std is on disk. RPC aliases for both Mantle networks are configured. Secrets are gitignored.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 1-01-02: Scaffold src, test, script stubs + .env.example</name>
  <read_first>
    - .planning/phases/01-lock-skeleton/RESEARCH.md (sections "Stub RatingRegistry.sol matching all CON-* constraints", "Shared grade constants", "Minimum acceptable Foundry test", "Pattern 1: Mantle Foundry deploy script")
    - .planning/phases/01-lock-skeleton/01-VALIDATION.md (Wave 0 Requirements section)
    - .planning/PROJECT.md (DEC-grade-encoding-uint8 — confirm AAA=0 .. D=9 mapping)
    - foundry.toml (just written in Task 1-01-01) and remappings.txt — confirm forge-std import path
  </read_first>
  <files>src/RatingRegistry.sol, src/constants/GradeEnum.sol, test/RatingRegistry.t.sol, script/Deploy.s.sol, .env.example</files>
  <behavior>
    - All four .sol stub files compile cleanly under `forge build` (no errors, no warnings about unused imports beyond the deliberate stubs).
    - GradeEnum.sol exposes constants matching DEC-grade-encoding-uint8 byte-for-byte (0=AAA, 1=AA, 2=A, 3=BBB, 4=BB, 5=B, 6=CCC, 7=CC, 8=C, 9=D, MAX=9).
    - RatingRegistry stub exposes a constructor taking `address initialAgent` so Plan 02 can wire the field without changing the deploy script signature.
    - Test file imports RatingRegistry from `../src/RatingRegistry.sol` and instantiates it in setUp() with `address(this)` as the agent.
    - Deploy script imports RatingRegistry from `../src/RatingRegistry.sol` and has an empty run() returning the registry (Plan 03 fills the body).
    - .env.example documents the three env vars (PRIVATE_KEY, MANTLE_SEPOLIA_RPC_URL, MANTLE_RPC_URL) + optional MANTLE_EXPLORER_KEY.
  </behavior>
  <action>
    Run from the repo root.

    1. Create directory structure. The Foundry profile expects src/, test/, script/, plus src/constants/. Use the Write tool on the file paths directly — Windows/Node will materialize parent directories.

    2. Write `src/constants/GradeEnum.sol` with the EXACT content from <interfaces> "Final src/constants/GradeEnum.sol" above. This file is consumed by Plan 02 (contract) and (mirrored in TS) by Phase 2 (agent) and Phase 4 (frontend). Do NOT alter the mapping — it is locked by DEC-grade-encoding-uint8.

    3. Write `src/RatingRegistry.sol` with the EXACT content from <interfaces> "Final src/RatingRegistry.sol stub" above. The constructor signature `constructor(address initialAgent)` is REQUIRED so Plan 02's full implementation drops in without breaking the test setUp() or Deploy script.

    4. Write `test/RatingRegistry.t.sol` with the EXACT content from <interfaces> "Final test/RatingRegistry.t.sol stub" above. The file imports `forge-std/Test.sol` (resolved via remappings.txt) and `../src/RatingRegistry.sol`. setUp() must construct with `address(this)` so Plan 02's onlyAgent tests work without rewriting setUp().

    5. Write `script/Deploy.s.sol` with the EXACT content from <interfaces> "Final script/Deploy.s.sol stub" above. The empty run() body returning `registry` (which Solidity defaults to the zero address) will compile under 0.8.24 without warnings because the named return is uninitialized — confirm with `forge build` after writing. If a warning appears, change the body to a single `return RatingRegistry(address(0));` to silence it; Plan 03 replaces this entirely.

    6. Write `.env.example` at repo root with the EXACT content from <interfaces> "Final .env.example" above. Do NOT write `.env` — only `.env.example`. .env is gitignored from Task 1-01-01.

    7. Run `forge build` from repo root. Expected: exit code 0, four contracts compiled (RatingRegistry, GradeEnum, RatingRegistryTest, Deploy). If any compile error appears, read the error message and the failing file and fix — do not guess. Common pitfalls:
       - `forge-std/Test.sol` not found → remappings.txt missing or wrong (Task 1-01-01 issue).
       - `RatingRegistry not defined` → import path wrong; must be `"../src/RatingRegistry.sol"` from test/ and script/.

    8. Run `forge test` (with the empty test file). Expected: exit code 0, "No tests found in RatingRegistryTest" or "0 tests passed" (the contract is empty). This proves the test harness wires through.
  </action>
  <verify>
    <automated>forge build *>&amp;1 ; if ($LASTEXITCODE -ne 0) { exit 1 } ; forge test *>&amp;1 ; if ($LASTEXITCODE -ne 0) { exit 1 } ; if (-not (Test-Path src/RatingRegistry.sol)) { exit 1 } ; if (-not (Test-Path src/constants/GradeEnum.sol)) { exit 1 } ; if (-not (Test-Path test/RatingRegistry.t.sol)) { exit 1 } ; if (-not (Test-Path script/Deploy.s.sol)) { exit 1 } ; if (-not (Test-Path .env.example)) { exit 1 } ; if (Test-Path .env) { exit 1 } ; if (-not (Select-String -Path src/constants/GradeEnum.sol -Pattern 'library GradeEnum' -SimpleMatch -Quiet)) { exit 1 } ; if (-not (Select-String -Path src/constants/GradeEnum.sol -Pattern 'uint8 internal constant AAA = 0' -SimpleMatch -Quiet)) { exit 1 } ; if (-not (Select-String -Path src/constants/GradeEnum.sol -Pattern 'uint8 internal constant D   = 9' -SimpleMatch -Quiet)) { exit 1 } ; if (-not (Select-String -Path src/RatingRegistry.sol -Pattern 'contract RatingRegistry' -SimpleMatch -Quiet)) { exit 1 } ; if (-not (Select-String -Path src/RatingRegistry.sol -Pattern 'constructor(address' -SimpleMatch -Quiet)) { exit 1 } ; if (-not (Select-String -Path test/RatingRegistry.t.sol -Pattern 'contract RatingRegistryTest' -SimpleMatch -Quiet)) { exit 1 } ; if (-not (Select-String -Path test/RatingRegistry.t.sol -Pattern 'import {Test} from "forge-std/Test.sol"' -SimpleMatch -Quiet)) { exit 1 } ; if (-not (Select-String -Path script/Deploy.s.sol -Pattern 'contract Deploy is Script' -SimpleMatch -Quiet)) { exit 1 } ; if (-not (Select-String -Path .env.example -Pattern '^PRIVATE_KEY=' -Quiet)) { exit 1 } ; exit 0</automated>
  </verify>
  <acceptance_criteria>
    - `forge build` exits 0 and reports compiling 4 files (or more, counting forge-std deps).
    - `forge test` exits 0 (empty test contract still passes — "0 tests").
    - `src/constants/GradeEnum.sol` exists and contains the literal lines `uint8 internal constant AAA = 0;`, `uint8 internal constant D   = 9;`, and `uint8 internal constant MAX = 9;`.
    - `src/RatingRegistry.sol` exists and contains `contract RatingRegistry` and `constructor(address`.
    - `test/RatingRegistry.t.sol` exists and contains `import {Test} from "forge-std/Test.sol"` and `contract RatingRegistryTest is Test`.
    - `script/Deploy.s.sol` exists and contains `contract Deploy is Script` plus `function run()`.
    - `.env.example` exists and starts with a `PRIVATE_KEY=` line (verified by `Select-String -Path .env.example -Pattern '^PRIVATE_KEY=' -Quiet`).
    - `.env` does NOT exist (verify with `if (Test-Path .env) { exit 1 }`).
  </acceptance_criteria>
  <done>Scaffold complete. Plan 02 has a working `forge test` loop. Plan 03 has a working `forge script` harness. Every Wave-0 row of 01-VALIDATION.md is satisfied.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Filesystem → git | .env file holding deployer private key must NEVER cross into git history |
| Public RPC → contract | Mantle Sepolia/Mainnet public RPCs are untrusted-by-default infra; deploy script trusts whatever address they report |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-1-01-S1 | Information Disclosure | `.env` deployer private key | mitigate | `.gitignore` contains `.env` and `.env.local` on dedicated lines (verified in Task 1-01-01 acceptance). `.env.example` is the only env file committed; it contains placeholder values, no secrets. |
| T-1-01-S2 | Information Disclosure | foundry.toml [etherscan] block reads ${MANTLE_EXPLORER_KEY} | accept | Blockscout verification (locked in DEC-deployment-target-plan) does not require a key. The interpolation is left in foundry.toml so a key can be added later without re-editing config. Plan 03 verifies via Blockscout path. |
| T-1-01-T1 | Tampering | forge-std submodule pulled from GitHub | accept | forge-std is the de-facto standard test harness; `--no-commit` flag avoids accidental dirty-tree commits. Lock to whatever stable tag `forge install` resolves at execution time. Acceptable risk given Day 1 timeline and that forge-std is read-only test code, not production-deployed. |
</threat_model>

<verification>
- `forge build` exits 0 after Task 1-01-02.
- `forge test` exits 0 after Task 1-01-02 (no tests yet — that's Plan 02).
- `git status` should show new untracked files (foundry.toml, remappings.txt, src/, test/, script/, .env.example, lib/, possibly an updated .gitignore) but NOT a `.env` file in the tree.
- The Foundry project is self-contained at repo root — no Touchstone-specific dependencies are present yet (Plan 02 adds the real contract code, Plan 03 deploys it).
</verification>

<success_criteria>
Wave-0 scaffold per 01-VALIDATION.md is complete:
- foundry.toml ✓
- lib/forge-std/ ✓
- src/RatingRegistry.sol (stub, compiles) ✓
- src/constants/GradeEnum.sol (locked encoding) ✓
- test/RatingRegistry.t.sol (stub, compiles, setUp uses constructor) ✓
- .env.example (PRIVATE_KEY + MANTLE_SEPOLIA_RPC_URL placeholders) ✓
- script/Deploy.s.sol (stub, compiles) ✓
- .gitignore (.env, broadcast/, cache/, out/) ✓

Plans 02 and 03 are now unblocked.
</success_criteria>

<output>
After completion, create `.planning/phases/01-lock-skeleton/01-01-SUMMARY.md` documenting:
- Foundry version installed (output of `forge --version`).
- forge-std tag/commit checked out under lib/forge-std/.
- Confirmation that foundry.toml, remappings.txt, .gitignore, and the four stub .sol files compile under `forge build`.
- Confirmation that `forge test` exits 0 with "no tests found".
- Pointer forward: Plan 02 fills RatingRegistry.sol + RatingRegistry.t.sol; Plan 03 wires Deploy.s.sol and deploys to Mantle Sepolia.
</output>
