---
phase: 01-lock-skeleton
plan: 03
type: execute
wave: 3
depends_on: ["1-01", "1-02"]
files_modified:
  - script/Deploy.s.sol
  - .planning/STATE.md
  - .planning/PROJECT.md
  - .planning/phases/01-lock-skeleton/01-03-DEPLOYMENT.md
autonomous: false
requirements: [REQ-15]
user_setup:
  - service: mantle-sepolia
    why: "Deploy + verify the Phase 1 skeleton contract end-to-end. Plan 03 cannot complete without a funded deployer key on Mantle Sepolia (chain 5003). Verification via Blockscout requires no API key."
    env_vars:
      - name: PRIVATE_KEY
        source: "User-generated. Any new EVM wallet works (cast wallet new, MetaMask, etc.). MUST be a fresh wallet with negligible value — never reuse a mainnet key."
      - name: MANTLE_SEPOLIA_RPC_URL
        source: "Default public endpoint https://rpc.sepolia.mantle.xyz works without registration. Alternative RPCs on chainlist.org/chain/5003."
    dashboard_config:
      - task: "Fund deployer wallet with Sepolia MNT"
        location: "https://faucet.sepolia.mantle.xyz/ — paste deployer address, complete CAPTCHA, receive Sepolia MNT (deploy cost is well under 0.01 MNT per RESEARCH.md)."
must_haves:
  truths:
    - "RatingRegistry is deployed at a known address on Mantle Sepolia (chain 5003)."
    - "Source code is verified on the Blockscout-backed explorer at https://explorer.sepolia.mantle.xyz/ — Contract tab shows green checkmark + readable Solidity source."
    - "A smoke requestRating transaction was sent from a fresh wallet (NOT the agent) and the corresponding RatingRequested event is visible on-chain — proves the on-chain AI-trigger flow per CON-onchain-trigger-required."
    - "STATE.md Current Position is updated to reflect Phase 1 completion + the deployed Sepolia address."
    - "PROJECT.md has a new Deployed Addresses section recording the Sepolia address, deploy tx hash, and the agent address used at deploy time."
  artifacts:
    - path: "script/Deploy.s.sol"
      provides: "Forge deploy script reading PRIVATE_KEY from env, constructing RatingRegistry(deployer), broadcasting"
      contains: "vm.startBroadcast"
      min_lines: 15
    - path: ".planning/phases/01-lock-skeleton/01-03-DEPLOYMENT.md"
      provides: "Permanent deployment record — Sepolia address, deploy tx hash, smoke requestRating tx hash, explorer URLs, agent address, deploy block + timestamp"
      contains: "Mantle Sepolia"
    - path: ".planning/PROJECT.md"
      provides: "Updated with Deployed Addresses section appended after Locked Decisions"
      contains: "## Deployed Addresses"
    - path: ".planning/STATE.md"
      provides: "Current Position updated: Phase 1 complete, Sepolia address recorded, progress bar advanced"
      contains: "Phase 1"
  key_links:
    - from: "script/Deploy.s.sol"
      to: "src/RatingRegistry.sol"
      via: "new RatingRegistry(deployer) call inside vm.startBroadcast"
      pattern: "new RatingRegistry\\("
    - from: ".planning/STATE.md"
      to: ".planning/phases/01-lock-skeleton/01-03-DEPLOYMENT.md"
      via: "Current Position references the deployment record"
      pattern: "01-03-DEPLOYMENT"
    - from: ".planning/PROJECT.md"
      to: ".planning/phases/01-lock-skeleton/01-03-DEPLOYMENT.md"
      via: "Deployed Addresses section references the deployment record for tx hashes"
      pattern: "01-03-DEPLOYMENT"
---

<objective>
Finalize the Deploy.s.sol script, deploy RatingRegistry to Mantle Sepolia (chain 5003) with Blockscout verification, run a smoke requestRating transaction from a fresh non-agent wallet to prove the on-chain AI-trigger flow end-to-end, and record the deployed address in STATE.md + PROJECT.md.

Purpose: REQ-15 (Phase 0 award-bar deployment). This plan IS the 20 Project Deployment Award gate — by the end, Touchstone has a verified contract on Mantle Sepolia with an observed RatingRequested event from a non-deployer wallet. Per DEC-deployment-target-plan, Mainnet deploy happens on Day 5 (Phase 5 — Ship); Days 1-4 iterate on Sepolia.

Output: A live, verified contract; a documented deployment record (01-03-DEPLOYMENT.md); updated STATE.md and PROJECT.md.

This plan contains ONE human checkpoint: confirming the Sepolia faucet was used to fund the deployer wallet. Everything else (deploy command, verification command, smoke transaction, state file updates) is fully automated by Claude via forge/cast.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/01-lock-skeleton/RESEARCH.md
@.planning/phases/01-lock-skeleton/01-VALIDATION.md
@.planning/phases/01-lock-skeleton/01-01-SUMMARY.md
@.planning/phases/01-lock-skeleton/01-02-SUMMARY.md
@src/RatingRegistry.sol
@foundry.toml
@.env.example
</context>

<interfaces>
Final script/Deploy.s.sol contents (replaces the Plan-01 stub):

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {RatingRegistry} from "../src/RatingRegistry.sol";

/// @notice Deploys RatingRegistry to whatever network forge script targets via --rpc-url.
///         The deployer address becomes the initial `agent`. Phase 3 will swap to
///         ERC-8004 NFT-holder gate without a redeploy.
contract Deploy is Script {
    function run() external returns (RatingRegistry registry) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        console2.log("Deployer (will be initial agent):", deployer);

        vm.startBroadcast(deployerKey);
        registry = new RatingRegistry(deployer);
        vm.stopBroadcast();

        console2.log("RatingRegistry deployed at:", address(registry));
    }
}
```

Mantle Sepolia parameters (locked by RESEARCH.md Track B Stream 5 + DEC-deployment-target-plan):
- Chain ID: 5003
- Public RPC: https://rpc.sepolia.mantle.xyz
- Blockscout explorer: https://explorer.sepolia.mantle.xyz
- Blockscout API base: https://explorer.sepolia.mantle.xyz/api/
- Faucet: https://faucet.sepolia.mantle.xyz/
- Native gas: MNT (testnet)
- Verifier API key: NOT REQUIRED (Blockscout is keyless per docs.blockscout.com/devs/verification/foundry-verification)

Final deploy + verify command (Sepolia):

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $MANTLE_SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --verifier blockscout \
  --verifier-url https://explorer.sepolia.mantle.xyz/api/
```

Fallback explicit-verify command (run if --verify silently skipped per Pitfall 3):

```bash
forge verify-contract \
  --rpc-url $MANTLE_SEPOLIA_RPC_URL \
  --verifier blockscout \
  --verifier-url https://explorer.sepolia.mantle.xyz/api/ \
  --watch \
  --constructor-args $(cast abi-encode "constructor(address)" $DEPLOYER_ADDRESS) \
  $DEPLOYED_ADDRESS \
  src/RatingRegistry.sol:RatingRegistry
```

Smoke requestRating transaction (sent from a SECOND wallet that is NOT the agent — proves "anyone can trigger"):

```bash
# Generate a throwaway second wallet (only used for the smoke tx).
cast wallet new
# Fund it from the faucet (separate request) OR send 0.001 MNT from the deployer.

# Send the smoke transaction. Sentinel address used as a literal address argument so the Phase 1 smoke event is distinguishable from Phase 2+ real ratings of subjects like USDY.
cast send $DEPLOYED_ADDRESS "requestRating(address)" 0xdEaD000000000000000022d473030F116dDEE9F6B \
  --rpc-url $MANTLE_SEPOLIA_RPC_URL \
  --private-key $SMOKE_TX_KEY
```

Smoke-test sentinel address (per Phase 1 smoke distinguishability concern — a non-subject address keeps the Phase 1 smoke event from being confused with Phase 2+ real ratings of subjects like USDY at 0x5bE26527e817998A7206475496fDE1E68957c5A6): 0xdEaD000000000000000022d473030F116dDEE9F6B

PROJECT.md "Deployed Addresses" section template (Claude appends this AFTER the closing `</decisions>` tag and BEFORE the "## Scope Cuts Already Baked Into This Plan" heading). The angle-bracket placeholders are filled with real values at execution time:

  ## Deployed Addresses

  | Contract | Network | Address | Deploy Tx | Verified |
  |----------|---------|---------|-----------|----------|
  | RatingRegistry (Phase 1 skeleton) | Mantle Sepolia (5003) | DEPLOYED_ADDRESS | DEPLOY_TX_HASH (link to explorer.sepolia.mantle.xyz/tx/DEPLOY_TX_HASH) | link to explorer.sepolia.mantle.xyz/address/DEPLOYED_ADDRESS |

  Agent address (initial, Phase 1): DEPLOYER_ADDRESS — Phase 3 will swap onlyAgent modifier to ERC-8004 NFT-holder gate without redeploy.

  Mainnet deploy: scheduled for Day 5 / Phase 5 per DEC-deployment-target-plan. The Sepolia artifact above clears the 20 Project Deployment Award technical bar today.

  See .planning/phases/01-lock-skeleton/01-03-DEPLOYMENT.md for the full deployment record (block number, gas used, smoke-tx hash, verification log).

STATE.md Current Position block (Claude replaces the existing Current Position block with this — values in angle brackets filled at execution time):

  ## Current Position

  - Phase: 1 — Lock + Skeleton COMPLETE 2026-06-08
  - Plan: 1-03 complete; Phase 1 closed.
  - Status: Skeleton RatingRegistry deployed + verified on Mantle Sepolia. Smoke requestRating transaction observed on-chain. 20 Project Deployment Award technical bar CLEARED.
  - Deployed (Sepolia): DEPLOYED_ADDRESS — see .planning/phases/01-lock-skeleton/01-03-DEPLOYMENT.md for tx hashes.
  - Progress: 1/5 phases complete
  - Next: /gsd-plan-phase 2 — Rating Engine Core (Day 2).
</interfaces>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1-03-01: Implement Deploy.s.sol and dry-run against Mantle Sepolia</name>
  <read_first>
    - .planning/phases/01-lock-skeleton/RESEARCH.md (section "Pattern 1: Mantle Foundry deploy script" and "Pitfall 3: --verify silently skips when API key absent")
    - script/Deploy.s.sol (the Plan-01 stub — confirm it is the placeholder shape and replace it)
    - src/RatingRegistry.sol (constructor signature — confirm constructor(address initialAgent))
    - foundry.toml (confirm [rpc_endpoints] mantle_sepolia entry exists)
  </read_first>
  <files>script/Deploy.s.sol</files>
  <behavior>
    - Deploy.s.sol reads PRIVATE_KEY from env (vm.envUint), derives the deployer address (vm.addr), broadcasts a single new RatingRegistry(deployer) call.
    - Deploys cleanly against `forge script ... --rpc-url SEPOLIA --broadcast` AND against `forge script ... --rpc-url SEPOLIA` (dry-run mode — no --broadcast).
    - console2.log lines emit the deployer address and the deployed contract address so the executor can grep them out of the run-latest.json broadcast file.
  </behavior>
  <action>
    1. Replace the contents of script/Deploy.s.sol ENTIRELY with the EXACT code in the interfaces block above ("Final script/Deploy.s.sol contents"). Use the Write tool.

    2. Run `forge build` from repo root. Expected: exit 0, no errors.

    3. Dry-run the script against Mantle Sepolia (NO --broadcast flag, so nothing is sent — this is the simulation). This requires PRIVATE_KEY to be set in the environment. Two paths:
       a. If a `.env` file exists at repo root (created by user), load it. In PowerShell: `Get-Content .env | ForEach-Object { if ($_ -match '^([^=]+)=(.*)$') { Set-Item -Path "env:$($Matches[1])" -Value $Matches[2] } }`. In Bash: `set -a; . ./.env; set +a`.
       b. If no .env exists yet, generate a throwaway private key for the dry-run only: `cast wallet new` returns address + key; export the key as PRIVATE_KEY. The dry-run does not need funds — it only simulates.

    4. Run the dry-run:
       `forge script script/Deploy.s.sol:Deploy --rpc-url https://rpc.sepolia.mantle.xyz`
       Expected: forge outputs "SIMULATION COMPLETE", logs the deployer address and a simulated deployed address, and reports gas cost. Exit code 0.

    5. Common failures and fixes:
       - "PRIVATE_KEY not set" → confirm env var is exported in the same shell.
       - RPC error → confirm internet + that https://rpc.sepolia.mantle.xyz responds (`cast block-number --rpc-url https://rpc.sepolia.mantle.xyz` isolates).
       - Compile error → most likely a transcription typo; re-Write the file from the interfaces block.

    6. Do NOT broadcast yet. The user-funded wallet check happens in the next checkpoint.
  </action>
  <verify>
    <automated>forge build *>&amp;1 ; if ($LASTEXITCODE -ne 0) { exit 1 } ; $tokens = @('vm.startBroadcast','new RatingRegistry(deployer)','vm.envUint("PRIVATE_KEY")','import {Script') ; foreach ($t in $tokens) { if (-not (Select-String -Path script/Deploy.s.sol -Pattern $t -SimpleMatch -Quiet)) { Write-Host "Missing token: $t" ; exit 1 } } ; exit 0</automated>
  </verify>
  <acceptance_criteria>
    - `forge build` exits 0.
    - script/Deploy.s.sol contains: vm.startBroadcast, new RatingRegistry(deployer), vm.envUint("PRIVATE_KEY"), and `import {Script` (forge-std import).
    - Dry-run `forge script script/Deploy.s.sol:Deploy --rpc-url https://rpc.sepolia.mantle.xyz` exits 0 and prints a simulated contract address starting with `0x`.
  </acceptance_criteria>
  <done>Deploy script is ready. The user-setup checkpoint can now confirm wallet funding, and the broadcast task can run.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1-03-02: USER — Fund deployer wallet on Mantle Sepolia</name>
  <what-built>
    Deploy.s.sol is implemented and dry-runs successfully against Mantle Sepolia. The deployer wallet derived from PRIVATE_KEY needs a small amount of Sepolia MNT (testnet token) before broadcasting the real deploy. The Mantle Sepolia faucet requires a human (CAPTCHA + wallet-connect UI) — Claude cannot complete this step.
  </what-built>
  <how-to-verify>
    1. Decide on the deployer wallet:
       - Option A (recommended): Generate a fresh wallet now via `cast wallet new`. Save the address and private key. NEVER reuse a key that ever held mainnet funds.
       - Option B: Use an existing testnet wallet you already own.

    2. Write the chosen PRIVATE_KEY into the .env file at the repo root (NOT .env.example — .env is gitignored from Plan 01):
       PRIVATE_KEY=0x...your-key...
       MANTLE_SEPOLIA_RPC_URL=https://rpc.sepolia.mantle.xyz

    3. Open https://faucet.sepolia.mantle.xyz/ in a browser.
    4. Paste the deployer ADDRESS (not the key) into the faucet form. Complete the CAPTCHA.
    5. Submit the request. Wait ~30 seconds.
    6. Confirm funding by running: `cast balance YOUR_ADDRESS --rpc-url https://rpc.sepolia.mantle.xyz` — expect a non-zero balance in MNT wei. Even 0.05 MNT is plenty (deploy cost is well under 0.01 MNT).

    7. If the faucet is rate-limited:
       - Try an alternative listed at https://chainlist.org/chain/5003
       - Or request via the Mantle Discord (slower but works as fallback).
  </how-to-verify>
  <resume-signal>Reply with "funded" (and optionally the deployer address) once `cast balance` shows a non-zero MNT balance on Sepolia. Then Claude continues with broadcast + verify in Task 1-03-03.</resume-signal>
</task>

<task type="auto" tdd="false">
  <name>Task 1-03-03: Broadcast deploy to Mantle Sepolia, verify on Blockscout, send smoke requestRating tx</name>
  <read_first>
    - script/Deploy.s.sol (final version from Task 1-03-01)
    - .env at repo root (confirm PRIVATE_KEY is set and the wallet is funded — Task 1-03-02 checkpoint)
    - .planning/phases/01-lock-skeleton/RESEARCH.md (Pitfall 3 — fallback explicit verify command if --verify silently skips; Track B Stream 5 — verification path)
    - foundry.toml (confirm mantle_sepolia RPC alias)
  </read_first>
  <files>broadcast/Deploy.s.sol/5003/run-latest.json (forge writes this), .planning/phases/01-lock-skeleton/01-03-DEPLOYMENT.md</files>
  <behavior>
    - forge script with --broadcast --verify --verifier blockscout deploys RatingRegistry to Mantle Sepolia and submits source for verification.
    - The Blockscout explorer at https://explorer.sepolia.mantle.xyz/address/DEPLOYED_ADDRESS shows the contract as verified (green checkmark + readable Solidity source on the Contract tab).
    - A second wallet (NOT the deployer/agent) sends a requestRating(USDY_ADDRESS) transaction; the corresponding RatingRequested event is visible on-chain.
    - A new deployment-record file 01-03-DEPLOYMENT.md captures: deployed address, deploy tx hash, deploy block number, deploy gas used, agent address, smoke-tx hash, smoke-tx sender, explorer URLs for all three artifacts.
  </behavior>
  <action>
    1. Load env vars from .env at repo root. PowerShell: `Get-Content .env | ForEach-Object { if ($_ -match '^([^=]+)=(.*)$') { Set-Item -Path "env:$($Matches[1])" -Value $Matches[2] } }`. Bash: `set -a; . ./.env; set +a`.

    2. Verify the wallet is funded: `cast balance $(cast wallet address --private-key $env:PRIVATE_KEY) --rpc-url https://rpc.sepolia.mantle.xyz` (PowerShell) or the equivalent Bash form. Expect non-zero wei. If zero, return to Task 1-03-02.

    3. Execute the deploy + verify in ONE command (per interfaces "Final deploy + verify command"):
       `forge script script/Deploy.s.sol:Deploy --rpc-url $MANTLE_SEPOLIA_RPC_URL --broadcast --verify --verifier blockscout --verifier-url https://explorer.sepolia.mantle.xyz/api/`
       Expected output: "ONCHAIN EXECUTION COMPLETE & SUCCESSFUL" followed by a "Verifier returned successfully" or "Contract successfully verified" line.

    4. Parse the broadcast result via PowerShell `ConvertFrom-Json` and export the values into env vars the rest of this task references:
       ```
       $broadcast = Get-Content broadcast/Deploy.s.sol/5003/run-latest.json -Raw | ConvertFrom-Json
       $env:DEPLOYED_ADDRESS = $broadcast.transactions[0].contractAddress
       $env:DEPLOY_TX_HASH   = $broadcast.transactions[0].hash
       $env:DEPLOYER_ADDRESS = (cast wallet address --private-key $env:PRIVATE_KEY)
       $env:DEPLOY_BLOCK     = $broadcast.receipts[0].blockNumber
       $env:DEPLOY_GAS_USED  = $broadcast.receipts[0].gasUsed
       Write-Host "RatingRegistry address: $($env:DEPLOYED_ADDRESS)"
       Write-Host "Deploy tx hash: $($env:DEPLOY_TX_HASH)"
       ```
       Assert the address shape is real (40 hex chars after 0x). If `$env:DEPLOYED_ADDRESS` does not match `^0x[0-9a-fA-F]{40}$`, halt and surface the failure -- the broadcast JSON is malformed and the deploy did not actually happen.

       Verify the deployed contract is live on-chain by reading the `agent()` getter (which the constructor populated). This is the on-chain assertion called out in 01-VALIDATION.md row 1-03-01:
       ```
       $onchainAgent = cast call $env:DEPLOYED_ADDRESS "agent()(address)" --rpc-url https://rpc.sepolia.mantle.xyz
       if ($onchainAgent -notmatch '^0x[0-9a-fA-F]{40}$') { Write-Host "On-chain agent() read failed: $onchainAgent" ; exit 1 }
       if ([System.Numerics.BigInteger]::Parse(($onchainAgent.Substring(2)), 'AllowHexSpecifier') -eq 0) { Write-Host "On-chain agent() returned zero address -- constructor did not run" ; exit 1 }
       Write-Host "On-chain agent() = $onchainAgent (matches deployer: $($env:DEPLOYER_ADDRESS))"
       ```
       These values feed step 7 (the deployment record).

    5. If the verify step silently skipped (per Pitfall 3 in RESEARCH.md), run the fallback:
       `forge verify-contract --rpc-url $MANTLE_SEPOLIA_RPC_URL --verifier blockscout --verifier-url https://explorer.sepolia.mantle.xyz/api/ --watch --constructor-args $(cast abi-encode "constructor(address)" $DEPLOYER_ADDRESS) $DEPLOYED_ADDRESS src/RatingRegistry.sol:RatingRegistry`
       Wait for "Contract successfully verified" output.

    6. Independent verification check via Blockscout API (PowerShell-native):
       ```
       $resp = Invoke-WebRequest -UseBasicParsing "https://explorer.sepolia.mantle.xyz/api/v2/smart-contracts/$($env:DEPLOYED_ADDRESS)"
       if (-not ($resp.Content -match '"is_verified"\s*:\s*true')) { Write-Host "Blockscout API did not report is_verified=true" ; exit 1 }
       ```
       If the API returns is_verified=false, manually open https://explorer.sepolia.mantle.xyz/address/$env:DEPLOYED_ADDRESS in a browser and confirm the Contract tab shows verified source before continuing.

    7. Send the smoke `requestRating` transaction. The point is to prove that a NON-AGENT wallet can trigger the public flow per DEC-onchain-trigger-requestRating. Two acceptable paths:
       a. Best: generate a second wallet (`cast wallet new`), fund it from the faucet or transfer 0.01 MNT from the deployer (`cast send SECOND_ADDRESS --value 0.01ether --private-key $env:PRIVATE_KEY --rpc-url https://rpc.sepolia.mantle.xyz`), then send the smoke tx from the second wallet.
       b. Acceptable fallback if the faucet is rate-limited or transfer is awkward: send from the deployer itself, but note in the deployment record that the smoke tx and the agent are the same address (still valid proof of the function path; just less clean as a "anyone can call" demo).

       Smoke tx command:
       `cast send $env:DEPLOYED_ADDRESS "requestRating(address)" 0xdEaD000000000000000022d473030F116dDEE9F6B --rpc-url $env:MANTLE_SEPOLIA_RPC_URL --private-key $env:SMOKE_TX_KEY`

       Capture the returned tx hash.

    8. Confirm the RatingRequested event was emitted. Run `cast logs --from-block BLOCK_OF_SMOKE_TX --to-block latest --address $DEPLOYED_ADDRESS --rpc-url $MANTLE_SEPOLIA_RPC_URL` and confirm at least one log entry with the RatingRequested event signature (the keccak256 of "RatingRequested(address,address,uint256)"). Alternative quick check: open https://explorer.sepolia.mantle.xyz/tx/SMOKE_TX_HASH in a browser and confirm the Logs tab shows RatingRequested.

    9. Write `.planning/phases/01-lock-skeleton/01-03-DEPLOYMENT.md` with the EXACT structure below (fill in real values for everything in ALL_CAPS):

       # Phase 1 Deployment Record — Mantle Sepolia

       Deployed: 2026-06-08
       Network: Mantle Sepolia (chain 5003)
       Plan: 01-03
       Requirement: REQ-15

       ## Contract

       - RatingRegistry address: DEPLOYED_ADDRESS
       - Deploy tx hash: DEPLOY_TX_HASH
       - Deploy block: DEPLOY_BLOCK
       - Gas used: GAS_USED
       - Agent address (initial, Phase 1): DEPLOYER_ADDRESS

       ## Explorer Links

       - Contract (Blockscout): https://explorer.sepolia.mantle.xyz/address/DEPLOYED_ADDRESS
       - Deploy tx: https://explorer.sepolia.mantle.xyz/tx/DEPLOY_TX_HASH
       - Verification status: VERIFIED via Blockscout (or NOTE if fallback verify-contract used)

       ## Smoke Test — On-chain AI-trigger flow

       - Caller wallet: SMOKE_TX_SENDER (note whether this is the deployer or a separate wallet)
       - Function called: requestRating(address) with subject = 0xdEaD000000000000000022d473030F116dDEE9F6B (sentinel address chosen specifically to be distinguishable from Phase 2+ real ratings of subjects like USDY at 0x5bE26527e817998A7206475496fDE1E68957c5A6 — no transfer; payload is a literal calldata address)
       - Smoke tx hash: SMOKE_TX_HASH
       - Event observed: RatingRequested(subject, requester, timestamp) — visible on Blockscout Logs tab

       ## Phase 3 Forward Compatibility

       The onlyAgent modifier is the Phase 1 stub (address check against `agent`). Phase 3 will swap the modifier body to "msg.sender holds ERC-8004 Identity Registry NFT" via the canonical Identity Registry at 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432. ABI is unchanged; no redeploy required.

       ## 20 Project Deployment Award

       The Mantle Sepolia artifact above clears the technical bar:
       - Contract deployed on Mantle: YES
       - Contract verified on Mantle Explorer: YES (Blockscout)
       - On-chain AI function callable: YES (requestRating + publishRating round-trip, requestRating proven by smoke tx)

       Mainnet artifact: Day 5 / Phase 5 per DEC-deployment-target-plan.

    10. Final compile-and-test sanity check: `forge build && forge test -q`. Both must exit 0.
  </action>
  <verify>
    <automated>if (-not (Test-Path .planning/phases/01-lock-skeleton/01-03-DEPLOYMENT.md)) { exit 1 } ; if (-not (Test-Path broadcast/Deploy.s.sol/5003/run-latest.json)) { exit 1 } ; if (-not (Select-String -Path .planning/phases/01-lock-skeleton/01-03-DEPLOYMENT.md -Pattern '^- RatingRegistry address: 0x[0-9a-fA-F]{40}$' -Quiet)) { Write-Host "Missing or malformed RatingRegistry address line" ; exit 1 } ; if (-not (Select-String -Path .planning/phases/01-lock-skeleton/01-03-DEPLOYMENT.md -Pattern '^- Deploy tx hash: 0x[0-9a-fA-F]{64}$' -Quiet)) { Write-Host "Missing or malformed Deploy tx hash line" ; exit 1 } ; if (-not (Select-String -Path .planning/phases/01-lock-skeleton/01-03-DEPLOYMENT.md -Pattern '^- Smoke tx hash: 0x[0-9a-fA-F]{64}$' -Quiet)) { Write-Host "Missing or malformed Smoke tx hash line" ; exit 1 } ; if (-not (Select-String -Path .planning/phases/01-lock-skeleton/01-03-DEPLOYMENT.md -Pattern 'VERIFIED' -SimpleMatch -Quiet)) { exit 1 } ; $broadcast = Get-Content broadcast/Deploy.s.sol/5003/run-latest.json -Raw | ConvertFrom-Json ; $deployed = $broadcast.transactions[0].contractAddress ; if ($deployed -notmatch '^0x[0-9a-fA-F]{40}$') { Write-Host "Broadcast JSON contractAddress malformed: $deployed" ; exit 1 } ; $onchainAgent = cast call $deployed "agent()(address)" --rpc-url https://rpc.sepolia.mantle.xyz ; if ($LASTEXITCODE -ne 0) { exit 1 } ; if ($onchainAgent -notmatch '^0x[0-9a-fA-F]{40}$') { Write-Host "agent() read returned non-address: $onchainAgent" ; exit 1 } ; if ([System.Numerics.BigInteger]::Parse(($onchainAgent.Substring(2)), 'AllowHexSpecifier') -eq 0) { Write-Host "agent() returned zero -- constructor did not initialize" ; exit 1 } ; forge build *>&amp;1 ; if ($LASTEXITCODE -ne 0) { exit 1 } ; forge test -q *>&amp;1 ; if ($LASTEXITCODE -ne 0) { exit 1 } ; exit 0</automated>
  </verify>
  <acceptance_criteria>
    - `forge script ... --broadcast --verify` exits 0 with "ONCHAIN EXECUTION COMPLETE & SUCCESSFUL".
    - broadcast/Deploy.s.sol/5003/run-latest.json exists and contains a `contractAddress` field with a real 0x... address.
    - https://explorer.sepolia.mantle.xyz/address/DEPLOYED_ADDRESS shows verified source (confirmed by curl against the Blockscout API or by manual browser check).
    - The smoke requestRating transaction is mined; cast logs (or the explorer Logs tab) shows a RatingRequested event from the smoke tx.
    - .planning/phases/01-lock-skeleton/01-03-DEPLOYMENT.md exists and contains all of: a 0x... contract address, a 0x... deploy tx hash, a 0x... smoke tx hash, the word VERIFIED, and the agent address.
    - `forge build` and `forge test -q` both exit 0 after deployment (no regressions).
  </acceptance_criteria>
  <done>Touchstone has a verified, callable RatingRegistry on Mantle Sepolia with proven on-chain AI-trigger flow. The 20 Project Deployment Award technical bar is CLEARED end of Day 1. Mainnet deploy is scheduled for Day 5.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 1-03-04: Update STATE.md + PROJECT.md with deployed addresses and Phase 1 closure</name>
  <read_first>
    - .planning/phases/01-lock-skeleton/01-03-DEPLOYMENT.md (just written — source of truth for the address values)
    - .planning/STATE.md (current Current Position block — Claude replaces it)
    - .planning/PROJECT.md (find the `</decisions>` closing tag — Claude inserts the Deployed Addresses section after it)
  </read_first>
  <files>.planning/STATE.md, .planning/PROJECT.md</files>
  <behavior>
    - STATE.md Current Position block reflects Phase 1 completion (status, deployed address, progress 1/5, next = `/gsd-plan-phase 2`).
    - PROJECT.md gains a new "## Deployed Addresses" section between the locked-decisions block and the "## Scope Cuts Already Baked Into This Plan" heading. The table lists the Sepolia address, deploy tx, verified explorer link.
    - Both files reference 01-03-DEPLOYMENT.md as the source-of-truth for full tx-hash detail (single source of truth for deployment artifacts).
    - STATE.md "Open Todos" — the unchecked "Phase 1 Track B" todo is checked off.
  </behavior>
  <action>
    1. Read 01-03-DEPLOYMENT.md to pull the real values for DEPLOYED_ADDRESS, DEPLOY_TX_HASH, DEPLOYER_ADDRESS.

    2. STATE.md update — use the Edit tool to REPLACE the existing `## Current Position` block (currently shows Phase 1 in-progress, 0/5 phases complete) with the block defined in the interfaces section ("STATE.md Current Position block"). Substitute DEPLOYED_ADDRESS with the real address. Also update the progress bar to indicate 1 of 5 phases complete.

    3. STATE.md Open Todos — use Edit to change the line `- [ ] Phase 1 Track B — deploy verified RatingRegistry.sol skeleton to Mantle Sepolia (Track A discovery complete).` to its checked variant: `- [x] ~~Phase 1 Track B — deploy verified RatingRegistry.sol skeleton to Mantle Sepolia~~ → DEPLOYED 2026-06-08 (see .planning/phases/01-lock-skeleton/01-03-DEPLOYMENT.md).`

    4. STATE.md Performance Metrics — update "Phases complete:" from 0 to 1.

    5. PROJECT.md update — use Edit to insert the "## Deployed Addresses" section (from the interfaces block above) between the closing `</decisions>` tag and the existing "## Scope Cuts Already Baked Into This Plan" heading. Substitute DEPLOYED_ADDRESS / DEPLOY_TX_HASH / DEPLOYER_ADDRESS with real values.

    6. Sanity check: re-read both files and confirm no other content was accidentally modified (Edit-tool diffs only the replaced regions). Both files must still pass markdown rendering (no broken tables, headings still in order).

    7. Final phase closure check: run `forge test -q` once more. Confirm exit 0 (5 tests passing). This is the Phase 1 final green.
  </action>
  <verify>
    <automated>if (-not (Select-String -Path .planning/STATE.md -Pattern 'Phase 1' -SimpleMatch -Quiet)) { exit 1 } ; if (-not (Select-String -Path .planning/STATE.md -Pattern '0x[0-9a-fA-F]{40}' -Quiet)) { exit 1 } ; if (-not (Select-String -Path .planning/STATE.md -Pattern '01-03-DEPLOYMENT' -SimpleMatch -Quiet)) { exit 1 } ; if (-not (Select-String -Path .planning/PROJECT.md -Pattern '## Deployed Addresses' -SimpleMatch -Quiet)) { exit 1 } ; if (-not (Select-String -Path .planning/PROJECT.md -Pattern 'Mantle Sepolia' -SimpleMatch -Quiet)) { exit 1 } ; if (-not (Select-String -Path .planning/PROJECT.md -Pattern 'RatingRegistry (Phase 1 skeleton)' -SimpleMatch -Quiet)) { exit 1 } ; if (-not (Select-String -Path .planning/STATE.md -Pattern 'Phases complete:\*\*\s+1' -Quiet)) { exit 1 } ; forge test -q *>&amp;1 ; if ($LASTEXITCODE -ne 0) { exit 1 } ; exit 0</automated>
  </verify>
  <acceptance_criteria>
    - .planning/STATE.md contains "Phase 1" with completion language (a string indicating Phase 1 closed), a 0x... address, and a reference to 01-03-DEPLOYMENT.
    - .planning/STATE.md "Phases complete:" line shows 1 (not 0).
    - .planning/STATE.md Open Todos shows the Phase 1 Track B entry as checked (strikethrough or `- [x]`).
    - .planning/PROJECT.md contains a "## Deployed Addresses" heading.
    - .planning/PROJECT.md contains the literal string "Mantle Sepolia" and the row "RatingRegistry (Phase 1 skeleton)" inside the deployed-addresses table.
    - The Deployed Addresses section is positioned between the closing `</decisions>` tag and the "## Scope Cuts Already Baked Into This Plan" heading (confirmed by Read).
    - `forge test -q` exits 0 (no regressions; 5 tests still passing).
  </acceptance_criteria>
  <done>STATE.md and PROJECT.md reflect Phase 1 completion. The single source of truth for tx hashes lives in 01-03-DEPLOYMENT.md, referenced from both project-state files. Next session can run `/gsd-plan-phase 2` cleanly.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Filesystem (.env) → broadcast | The deployer private key is loaded from .env into process memory and used to sign the deploy tx. Leakage = wallet compromise (Sepolia wallet — low value, but the principle stands). |
| Public RPC (rpc.sepolia.mantle.xyz) → contract bytecode | Public RPC returns the deployed bytecode + verification status. Trust is unauthenticated; we cross-check via the independent Blockscout API. |
| Smoke wallet → public requestRating | The smoke wallet is a fresh (or deployer) wallet — the intent is to prove the function is callable by anyone. No trust concerns: requestRating is permissionless by design. |
| Blockscout verification API → published source | Anyone reading the explorer trusts that the verification is real. Mitigation: Blockscout verifies by recompiling and matching bytecode — cryptographically grounded, not just a checkbox. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-1-03-I1 | Information Disclosure | .env containing PRIVATE_KEY | mitigate | .env is gitignored from Plan 01 Task 1-01-01; only .env.example (no secrets) is committed. The checkpoint instructions tell the user to use a FRESH wallet, never one that held mainnet funds. |
| T-1-03-T1 | Tampering | --verify silently skips verification | mitigate | Pitfall 3 in RESEARCH.md: --verify can silently skip if Foundry fails to resolve an API key. Mitigation: explicit fallback `forge verify-contract` command run in Task 1-03-03 step 5 if step 4 didn't surface "Contract successfully verified", AND an independent check via Blockscout API (`curl /api/v2/smart-contracts/ADDRESS`) in step 6. |
| T-1-03-D1 | Denial of Service | Mantle Sepolia faucet rate-limit blocks deploy | mitigate | Checkpoint Task 1-03-02 lists alternative faucets on chainlist.org/chain/5003 and the Mantle Discord. Even at worst case, the user can manually transfer testnet MNT from another address. |
| T-1-03-S1 | Spoofing | Smoke tx sent from deployer/agent address rather than a separate wallet | mitigate | Task 1-03-03 step 7 instructs generating a SEPARATE wallet for the smoke tx and explicitly notes in the deployment record if the fallback (same wallet) was used. Doesn't break the verification objective but degrades the "anyone can call" demo claim. |
| T-1-03-R1 | Repudiation | No record of who deployed / when / which block | mitigate | 01-03-DEPLOYMENT.md captures address, tx hash, block, gas, agent address, smoke-tx hash, smoke-tx sender. PROJECT.md cross-references this file. Permanent, version-controlled record. |
</threat_model>

<verification>
- `forge script script/Deploy.s.sol:Deploy --rpc-url ... --broadcast --verify ...` exits 0.
- broadcast/Deploy.s.sol/5003/run-latest.json exists with a real contractAddress.
- https://explorer.sepolia.mantle.xyz/address/DEPLOYED_ADDRESS shows verified source.
- A RatingRequested event from a non-deployer wallet (or same wallet with note) is observable on-chain.
- 01-03-DEPLOYMENT.md, STATE.md, PROJECT.md all reference the same address.
- `forge test -q` continues to exit 0 (no regressions from Plan 01/02).
</verification>

<success_criteria>
REQ-15 fully satisfied:
- Track A discovery items resolved (already done pre-planning — recorded in STATE.md "Phase 1 Discovery — RESOLVED 2026-06-07").
- Track B deploy: verified RatingRegistry.sol skeleton on Mantle Sepolia with observable on-chain AI-trigger flow.

End-of-day-1 outcome: 20 Project Deployment Award technical bar is CLEARED. Phase 2 (Rating Engine Core) can begin Day 2.
</success_criteria>

<output>
After completion, create `.planning/phases/01-lock-skeleton/01-03-SUMMARY.md` documenting:
- The deployed address on Mantle Sepolia.
- The deploy tx hash and the smoke tx hash.
- Confirmation that Blockscout shows the contract as verified (with the curl-or-manual check result).
- Confirmation that the RatingRequested event was emitted by a non-agent caller (or note if the fallback path was used).
- The agent address recorded at deploy time (Phase 3 needs this to set up the ERC-8004 NFT mint targeting the same address).
- Forward pointer: Phase 2 begins Day 2 (`/gsd-plan-phase 2`) — Rating Engine Core. Phase 5 (Day 5) re-runs this same Deploy.s.sol script against Mantle Mainnet (chain 5000) with `--rpc-url https://rpc.mantle.xyz` and a Mainnet-funded deployer key.
</output>
