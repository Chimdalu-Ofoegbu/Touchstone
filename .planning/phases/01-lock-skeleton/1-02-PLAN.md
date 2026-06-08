---
phase: 01-lock-skeleton
plan: 02
type: execute
wave: 2
depends_on: ["1-01"]
files_modified:
  - src/RatingRegistry.sol
  - test/RatingRegistry.t.sol
autonomous: true
requirements: [REQ-02]
must_haves:
  truths:
    - "RatingRegistry contract source matches CON-publishRating-signature, CON-requestRating-signature, CON-read-interface, CON-rating-schema, CON-grade-encoding."
    - "onlyAgent modifier reverts with NotAgent() for any caller other than the constructor-supplied agent address — proves Phase 3 can swap the modifier impl without an ABI break."
    - "publishRating reverts with InvalidGrade() if grade > 9, enforcing the locked DEC-grade-encoding-uint8 range."
    - "requestRating emits RatingRequested(subject, msg.sender, block.timestamp) for any caller including non-agent addresses."
    - "latestRating returns the last published Rating struct for a subject; ratingHistory returns the full Rating[] timeline."
    - "All 5 unit tests in 01-VALIDATION.md per-task verification map pass under `forge test`."
  artifacts:
    - path: "src/RatingRegistry.sol"
      provides: "Full Phase 1 skeleton contract per RESEARCH.md code example, with onlyAgent abstraction so Phase 3 swaps the gate without changing ABI"
      contains: "function publishRating"
      min_lines: 50
    - path: "test/RatingRegistry.t.sol"
      provides: "Five named unit tests matching the 01-VALIDATION.md per-task verification map (test_publishRating_rejectsNonAgent, test_publishRating_gradeRange, test_requestRating_emitsEvent, test_latestRating_returnsLast, test_ratingHistory_returnsAll)"
      contains: "function test_publishRating_rejectsNonAgent"
      min_lines: 60
  key_links:
    - from: "src/RatingRegistry.sol"
      to: "src/constants/GradeEnum.sol"
      via: "import {GradeEnum} from \"./constants/GradeEnum.sol\""
      pattern: "import.*GradeEnum"
    - from: "test/RatingRegistry.t.sol"
      to: "src/RatingRegistry.sol"
      via: "registry.publishRating(...) calls + vm.expectEmit + vm.expectRevert assertions"
      pattern: "registry\\.(publishRating|requestRating|latestRating|ratingHistory)"
---

<objective>
Replace the Plan-01 stubs with the full Phase 1 skeleton: the working `RatingRegistry.sol` contract per the RESEARCH.md "Stub RatingRegistry.sol" code example (exactly the surface CON-* constraints lock down), plus five named unit tests proving each public behavior. Every test in the 01-VALIDATION.md per-task verification map must pass before this plan closes.

Purpose: REQ-02 (skeleton subset). Phase 3 will swap the `onlyAgent` modifier implementation from "owner check" to "ERC-8004 NFT holder check" without changing the ABI — that forward-compatibility is the entire reason the abstraction exists, per Pitfall 5 in RESEARCH.md. The five unit tests lock that surface contract NOW so Phase 3 has a behavioral baseline to refactor against.

Output: A `forge test` run that emits all 5 named tests as PASS, with no warnings beyond stylistic. The contract is ready for Plan 03 to deploy to Mantle Sepolia.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/01-lock-skeleton/RESEARCH.md
@.planning/phases/01-lock-skeleton/01-VALIDATION.md
@.planning/phases/01-lock-skeleton/01-01-SUMMARY.md
@src/constants/GradeEnum.sol
</context>

<interfaces>
<!-- The full contract surface, locked by CON-* constraints in REQUIREMENTS.md REQ-02. -->
<!-- This is the EXACT shape Plan 03 will deploy and Phase 3 will extend. -->

Final src/RatingRegistry.sol (replaces the Plan-01 stub byte-for-byte):
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {GradeEnum} from "./constants/GradeEnum.sol";

/// @title Touchstone RatingRegistry — Phase 1 skeleton
/// @notice Stores published ratings keyed by subject. Public surface matches
///         CON-publishRating-signature, CON-requestRating-signature,
///         CON-read-interface, CON-rating-schema, CON-grade-encoding.
/// @dev The `onlyAgent` modifier is a Phase 1 stub that gates on a single
///      `agent` address set in the constructor. Phase 3 will swap the modifier
///      implementation to "msg.sender holds ERC-8004 Identity Registry NFT"
///      WITHOUT changing the contract ABI — see Pitfall 5 in RESEARCH.md.
contract RatingRegistry {
    /// @notice Rating schema per CON-rating-schema.
    struct Rating {
        address subject;
        uint8 grade;          // 0..9 → AAA..D per DEC-grade-encoding-uint8 / CON-grade-encoding
        bytes32 reasoningHash;
        uint8 confidence;
        uint256 timestamp;
        address agentIdentity; // Phase 1: same as agent; Phase 3: ERC-8004 identity address
    }

    /// @notice Address authorized to call publishRating. Phase 3 swaps the gate logic.
    address public agent;

    /// @dev Subject => append-only Rating history.
    mapping(address => Rating[]) private _history;

    /// @notice Emitted when the agent records a rating.
    event RatingPublished(
        address indexed subject,
        uint8 grade,
        bytes32 reasoningHash,
        uint8 confidence,
        uint256 timestamp
    );

    /// @notice Emitted when anyone requests the agent rate a subject.
    event RatingRequested(
        address indexed subject,
        address indexed requester,
        uint256 timestamp
    );

    error NotAgent();
    error InvalidGrade();

    /// @dev Phase 1 gate: simple address check. Phase 3: ERC-8004 NFT-holder check.
    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    /// @param initialAgent Address allowed to publish ratings in Phase 1.
    constructor(address initialAgent) {
        agent = initialAgent;
    }

    /// @notice Anyone can request a rating; off-chain agent listens for RatingRequested.
    /// @dev Per CON-requestRating-signature + DEC-onchain-trigger-requestRating.
    function requestRating(address subject) external {
        emit RatingRequested(subject, msg.sender, block.timestamp);
    }

    /// @notice Agent publishes a rating. Reverts InvalidGrade() if grade > 9.
    /// @dev Per CON-publishRating-signature. Phase 1 stub: records & emits, no validation
    ///      beyond the grade range. Phase 3 will add reasoningHash sourcing from IPFS.
    function publishRating(
        address subject,
        uint8 grade,
        bytes32 reasoningHash,
        uint8 confidence
    ) external onlyAgent {
        if (grade > GradeEnum.MAX) revert InvalidGrade();
        Rating memory r = Rating({
            subject: subject,
            grade: grade,
            reasoningHash: reasoningHash,
            confidence: confidence,
            timestamp: block.timestamp,
            agentIdentity: msg.sender // Phase 3: read from ERC-8004 Identity Registry
        });
        _history[subject].push(r);
        emit RatingPublished(subject, grade, reasoningHash, confidence, block.timestamp);
    }

    /// @notice Returns the most recent Rating for `subject`, or a zero-valued Rating if none.
    function latestRating(address subject) external view returns (Rating memory) {
        Rating[] storage h = _history[subject];
        if (h.length == 0) {
            return Rating(address(0), 0, bytes32(0), 0, 0, address(0));
        }
        return h[h.length - 1];
    }

    /// @notice Returns the full Rating timeline for `subject`.
    function ratingHistory(address subject) external view returns (Rating[] memory) {
        return _history[subject];
    }
}
```

Final test/RatingRegistry.t.sol (replaces the Plan-01 stub byte-for-byte):
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {RatingRegistry} from "../src/RatingRegistry.sol";
import {GradeEnum} from "../src/constants/GradeEnum.sol";

/// @notice Five unit tests per 01-VALIDATION.md per-task verification map.
contract RatingRegistryTest is Test {
    RatingRegistry internal registry;
    address internal agent;
    address internal subject = address(0xBEEF);
    address internal nonAgent = address(0xCAFE);

    // Re-declared so the test can use vm.expectEmit against the contract's events.
    event RatingPublished(
        address indexed subject,
        uint8 grade,
        bytes32 reasoningHash,
        uint8 confidence,
        uint256 timestamp
    );
    event RatingRequested(
        address indexed subject,
        address indexed requester,
        uint256 timestamp
    );

    function setUp() public {
        agent = address(this); // test contract is the agent
        registry = new RatingRegistry(agent);
    }

    /// 1-02-01 — onlyAgent gate rejects non-agent callers (T-1-01 mitigation proof).
    function test_publishRating_rejectsNonAgent() public {
        vm.prank(nonAgent);
        vm.expectRevert(RatingRegistry.NotAgent.selector);
        registry.publishRating(subject, GradeEnum.AAA, bytes32(uint256(1)), 100);
    }

    /// 1-02-02 — Grade enum 0-9 maps AAA-D, reverts above 9.
    function test_publishRating_gradeRange() public {
        // Boundary: grade == 9 (D) is allowed.
        registry.publishRating(subject, GradeEnum.D, bytes32(uint256(2)), 50);
        RatingRegistry.Rating memory latest = registry.latestRating(subject);
        assertEq(latest.grade, uint8(9));

        // Boundary: grade == 10 reverts.
        vm.expectRevert(RatingRegistry.InvalidGrade.selector);
        registry.publishRating(subject, 10, bytes32(uint256(3)), 50);
    }

    /// 1-02-03 — requestRating emits RatingRequested for any caller (including non-agent).
    function test_requestRating_emitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit RatingRequested(subject, nonAgent, block.timestamp);
        vm.prank(nonAgent);
        registry.requestRating(subject);
    }

    /// 1-02-04 — latestRating returns last published rating (and zero-valued struct when empty).
    function test_latestRating_returnsLast() public {
        // Empty case: returns zero-valued Rating.
        RatingRegistry.Rating memory empty = registry.latestRating(subject);
        assertEq(empty.subject, address(0));
        assertEq(empty.grade, uint8(0));
        assertEq(empty.timestamp, uint256(0));

        // Publish two ratings; latestRating must return the second.
        registry.publishRating(subject, GradeEnum.AAA, bytes32(uint256(1)), 90);
        registry.publishRating(subject, GradeEnum.BBB, bytes32(uint256(2)), 75);
        RatingRegistry.Rating memory latest = registry.latestRating(subject);
        assertEq(latest.grade, uint8(3)); // BBB
        assertEq(latest.confidence, uint8(75));
        assertEq(latest.reasoningHash, bytes32(uint256(2)));
        assertEq(latest.subject, subject);
        assertEq(latest.agentIdentity, agent);
    }

    /// 1-02-05 — ratingHistory returns full timeline.
    function test_ratingHistory_returnsAll() public {
        // Empty case: returns empty array.
        RatingRegistry.Rating[] memory empty = registry.ratingHistory(subject);
        assertEq(empty.length, 0);

        // Publish three; ratingHistory must return all three in order.
        registry.publishRating(subject, GradeEnum.AAA, bytes32(uint256(1)), 95);
        registry.publishRating(subject, GradeEnum.AA,  bytes32(uint256(2)), 88);
        registry.publishRating(subject, GradeEnum.A,   bytes32(uint256(3)), 80);
        RatingRegistry.Rating[] memory history = registry.ratingHistory(subject);
        assertEq(history.length, 3);
        assertEq(history[0].grade, uint8(0)); // AAA
        assertEq(history[1].grade, uint8(1)); // AA
        assertEq(history[2].grade, uint8(2)); // A
    }
}
```
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1-02-01: Replace RatingRegistry.sol stub with full Phase 1 skeleton contract</name>
  <read_first>
    - .planning/phases/01-lock-skeleton/RESEARCH.md (sections "Stub RatingRegistry.sol matching all CON-* constraints", "Pitfall 5: Stub publishRating permission gate", "Code Examples")
    - .planning/REQUIREMENTS.md (REQ-02 acceptance criteria — CON-publishRating-signature, CON-requestRating-signature, CON-read-interface, CON-rating-schema, CON-grade-encoding)
    - src/constants/GradeEnum.sol (confirms MAX = 9 and the AAA..D constants are available for import)
    - src/RatingRegistry.sol (current Plan-01 stub — confirm constructor signature is `constructor(address initialAgent)` so the replacement is ABI-compatible)
  </read_first>
  <files>src/RatingRegistry.sol</files>
  <behavior>
    Per CON-* constraints in REQ-02:
    - `publishRating(address subject, uint8 grade, bytes32 reasoningHash, uint8 confidence)` reverts NotAgent() when msg.sender != agent.
    - `publishRating` reverts InvalidGrade() when grade > 9.
    - `publishRating` appends a Rating to _history[subject] and emits RatingPublished(subject, grade, reasoningHash, confidence, block.timestamp).
    - `requestRating(address subject)` emits RatingRequested(subject, msg.sender, block.timestamp) for ANY caller.
    - `latestRating(address)` returns the most recent Rating for the subject, or a zero-valued Rating struct (subject=address(0), grade=0, reasoningHash=0, confidence=0, timestamp=0, agentIdentity=address(0)) when history is empty.
    - `ratingHistory(address)` returns the full Rating[] timeline (empty array when nothing published).
    - Constructor accepts `address initialAgent` and stores it in `agent` (public).
  </behavior>
  <action>
    1. Read the current `src/RatingRegistry.sol` to confirm its current shape (the Plan-01 stub with empty constructor body).

    2. Replace its contents ENTIRELY with the EXACT code in <interfaces> "Final src/RatingRegistry.sol" above. Use the Write tool, overwriting the file.

    3. The replacement is designed to be the FINAL Phase 1 surface. Phase 3 will modify the `onlyAgent` modifier body in place (swap address check for ERC-8004 NFT-holder check via the canonical Identity Registry at 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 per DEC-erc8004-canonical-addresses) without altering any external function signature, event, error, or state variable. This is enforced by the test suite (Task 1-02-02 — the 5 tests stay green across Phase 3).

    4. Critical implementation notes:
       - The `agentIdentity` field stores `msg.sender` (Phase 1 = same as `agent`). Phase 3 will swap to reading from the ERC-8004 registry. Do NOT change this in Phase 1.
       - Use `GradeEnum.MAX` (imported from `./constants/GradeEnum.sol`) for the grade-range check — do NOT hardcode `9` inline. This proves the constants file is wired.
       - Events are non-indexed past `subject` (and `requester` for RatingRequested) per the spec example in RESEARCH.md. Do not add `indexed` to grade/confidence/etc.
       - `_history` is `private` not `internal` — external readers go through `latestRating`/`ratingHistory` getters.

    5. Run `forge build` and confirm exit code 0. If a compile error appears, read the message and fix — the most likely issues are typos when transcribing the import path or modifier syntax. Do NOT proceed to verification until `forge build` is clean.

    Decision recorded per CON-publishRating-signature (signature locked), CON-requestRating-signature (signature locked), CON-rating-schema (struct fields locked), CON-grade-encoding (uint8 0-9), and DEC-grade-encoding-uint8 (consumed via GradeEnum import — single source of truth for the encoding).
  </action>
  <verify>
    <automated>forge build *>&amp;1 ; if ($LASTEXITCODE -ne 0) { exit 1 } ; $tokens = @('function publishRating','function requestRating','function latestRating','function ratingHistory','modifier onlyAgent','error NotAgent','error InvalidGrade','event RatingPublished','event RatingRequested','import {GradeEnum}','constructor(address initialAgent)','if (grade &gt; GradeEnum.MAX)') ; foreach ($t in $tokens) { if (-not (Select-String -Path src/RatingRegistry.sol -Pattern $t -SimpleMatch -Quiet)) { Write-Host "Missing token: $t" ; exit 1 } } ; exit 0</automated>
  </verify>
  <acceptance_criteria>
    - `forge build` exits 0 with no errors.
    - `src/RatingRegistry.sol` contains: `function publishRating`, `function requestRating`, `function latestRating`, `function ratingHistory`, `modifier onlyAgent`, `error NotAgent`, `error InvalidGrade`, `event RatingPublished`, `event RatingRequested`.
    - `src/RatingRegistry.sol` contains `import {GradeEnum} from "./constants/GradeEnum.sol";` (constants single-source-of-truth wired).
    - `src/RatingRegistry.sol` contains `constructor(address initialAgent)` (ABI-compatible with Plan 03 deploy script).
    - `src/RatingRegistry.sol` contains the literal grade-range guard `if (grade > GradeEnum.MAX)` (not a hardcoded `> 9`).
    - File line count is >= 50 (skeleton is intentionally compact but contains struct + 4 functions + events + errors + modifier + constructor).
  </acceptance_criteria>
  <done>Phase 1 skeleton contract is complete and compiles. Task 1-02-02 can now write tests against this surface.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 1-02-02: Write 5 unit tests matching 01-VALIDATION.md per-task verification map and prove forge test green</name>
  <read_first>
    - .planning/phases/01-lock-skeleton/01-VALIDATION.md (Per-Task Verification Map — confirm the 5 test names: test_publishRating_rejectsNonAgent, test_publishRating_gradeRange, test_requestRating_emitsEvent, test_latestRating_returnsLast, test_ratingHistory_returnsAll)
    - .planning/phases/01-lock-skeleton/RESEARCH.md (section "Minimum acceptable Foundry test")
    - src/RatingRegistry.sol (just written in Task 1-02-01 — confirm event/error names match what the tests expect)
    - test/RatingRegistry.t.sol (current Plan-01 stub — confirm setUp() shape)
  </read_first>
  <files>test/RatingRegistry.t.sol</files>
  <behavior>
    All 5 tests below pass under `forge test --match-contract RatingRegistryTest -vv`:
    - test_publishRating_rejectsNonAgent — vm.prank(nonAgent) + vm.expectRevert(NotAgent.selector) + publishRating call.
    - test_publishRating_gradeRange — grade 9 succeeds; grade 10 reverts InvalidGrade.
    - test_requestRating_emitsEvent — vm.prank(nonAgent), expect RatingRequested(subject, nonAgent, block.timestamp).
    - test_latestRating_returnsLast — empty case returns zero-valued struct; after 2 publishes, returns the second.
    - test_ratingHistory_returnsAll — empty case returns empty array; after 3 publishes, returns array of 3 in publication order.
  </behavior>
  <action>
    1. Read the current `test/RatingRegistry.t.sol` to confirm the Plan-01 stub.

    2. Replace its contents ENTIRELY with the EXACT code in <interfaces> "Final test/RatingRegistry.t.sol" above. Use the Write tool, overwriting the file.

    3. The test contract re-declares the events (`event RatingPublished` and `event RatingRequested`) at the top of the contract so `vm.expectEmit` can match against them — this is the standard forge-std pattern for matching contract events from a test file. Do NOT remove these re-declarations.

    4. Run `forge test --match-contract RatingRegistryTest -vv`. Expected: 5 tests pass, 0 fail. The `-vv` verbosity surfaces revert reasons if something fails.

    5. If any test fails:
       - Read the failure output carefully. Common issues:
         - Event arg mismatch in vm.expectEmit → confirm the contract's event signature matches the test's expected signature.
         - vm.prank not applying → confirm vm.prank precedes the call, not setUp.
         - Wrong selector for NotAgent/InvalidGrade → confirm test imports the contract type and uses `RatingRegistry.NotAgent.selector`.
       - Fix the failing test (or, if the contract has a bug from Task 1-02-01, fix the contract — but the contract code is locked by <interfaces>, so failures should be test-side only).

    6. Once all 5 are green, run the full suite once more (`forge test`) to confirm no other tests were broken. Expected: 5 passed, 0 failed.

    7. Run `forge test --gas-report --match-contract RatingRegistryTest` once to capture the gas envelope (informational; the report goes into the plan summary so we can compare against Phase 3's full impl).
  </action>
  <verify>
    <automated>forge test --match-contract RatingRegistryTest -q *>&amp;1 | Tee-Object -FilePath "$env:TEMP/forge-test.log" ; if ($LASTEXITCODE -ne 0) { exit 1 } ; $tests = @('test_publishRating_rejectsNonAgent','test_publishRating_gradeRange','test_requestRating_emitsEvent','test_latestRating_returnsLast','test_ratingHistory_returnsAll') ; foreach ($t in $tests) { forge test --match-test $t --match-contract RatingRegistryTest -q *>&amp;1 ; if ($LASTEXITCODE -ne 0) { Write-Host "Test failed: $t" ; exit 1 } } ; $testCount = (Get-Content test/RatingRegistry.t.sol | Where-Object { $_ -notmatch '^\s*//' } | Select-String -Pattern 'function test_' -SimpleMatch).Count ; if ($testCount -lt 5) { Write-Host "Expected &gt;= 5 test_ functions, found $testCount" ; exit 1 } ; exit 0</automated>
  </verify>
  <acceptance_criteria>
    - `forge test --match-contract RatingRegistryTest -q` reports "5 passed; 0 failed; 0 skipped".
    - Each of the five named tests (`test_publishRating_rejectsNonAgent`, `test_publishRating_gradeRange`, `test_requestRating_emitsEvent`, `test_latestRating_returnsLast`, `test_ratingHistory_returnsAll`) passes individually when run via `--match-test`.
    - `test/RatingRegistry.t.sol` contains at least 5 functions starting with `function test_` (verified by `grep -v '^//' test/RatingRegistry.t.sol | grep -c "function test_"` >= 5 — comment filter prevents the self-invalidating grep gate).
    - `forge test` (full suite, no filter) reports total passed == total tests, 0 failed.
  </acceptance_criteria>
  <done>RatingRegistry skeleton is locked by behavioral tests. Plan 03 can deploy with confidence that the contract surface is correct. Phase 3 has a behavioral baseline to refactor against without ABI breaks.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Untrusted caller → publishRating | Anyone on Mantle can call publishRating; only the agent must succeed. This is the core access-control invariant the onlyAgent modifier defends. |
| Untrusted caller → requestRating | Anyone can call requestRating by design (per DEC-onchain-trigger-requestRating). The only state effect is the emitted event, which is bounded — but the event log size is unbounded, so spam is a concern. |
| Untrusted input → grade range | uint8 grade is a free input on publishRating; must be guarded to <= 9 per DEC-grade-encoding-uint8. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-1-02-E1 | Elevation of Privilege | publishRating without onlyAgent | mitigate | onlyAgent modifier with NotAgent() revert; test_publishRating_rejectsNonAgent proves the gate. Phase 3 will swap modifier impl to ERC-8004 NFT-holder check (forward compatibility is the whole point of the abstraction per Pitfall 5 in RESEARCH.md). |
| T-1-02-T1 | Tampering | grade value > 9 corrupts the shared encoding | mitigate | `if (grade > GradeEnum.MAX) revert InvalidGrade();` guard at publishRating entry. test_publishRating_gradeRange asserts grade 9 succeeds and grade 10 reverts. |
| T-1-02-D1 | Denial of Service | requestRating spam fills event logs | accept | Event spam on Mantle is rate-limited by gas cost (caller pays). Phase 1 skeleton accepts this — the off-chain agent in Phase 3 will filter by subject and rate-limit downstream. CON-onchain-trigger-required forbids gating the public call. |
| T-1-02-I1 | Information Disclosure | _history mapping is private but Rating data is on-chain (always readable) | accept | All ratings are intended to be public — Touchstone's value prop is on-chain verifiable ratings. No PII; no need for privacy. |
| T-1-02-R1 | Repudiation | agentIdentity = msg.sender in Phase 1 stub vs ERC-8004 identity in Phase 3 | mitigate | Phase 1 records msg.sender (the agent address). Phase 3 will read the registered ERC-8004 identity from 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 — same address surface, different read source. The struct field name `agentIdentity` is forward-compatible. |
</threat_model>

<verification>
- `forge test` exits 0 with 5 passed.
- `forge build` exits 0.
- `src/RatingRegistry.sol` imports from `./constants/GradeEnum.sol` (single source of truth for grade encoding wired end-to-end).
- The onlyAgent modifier signature is the EXACT shape Phase 3 will swap (`if (msg.sender != agent) revert NotAgent();` → Phase 3 inserts `if (!IIdentityRegistry(IDENTITY).balanceOf(msg.sender) == 0) revert NotAgent();` or equivalent). ABI is unchanged.
</verification>

<success_criteria>
REQ-02 (skeleton portion) is satisfied:
- ✅ publishRating signature matches CON-publishRating-signature.
- ✅ requestRating signature matches CON-requestRating-signature.
- ✅ latestRating + ratingHistory exposed per CON-read-interface.
- ✅ Rating struct fields match CON-rating-schema.
- ✅ Grade encoded uint8 0-9 per CON-grade-encoding.
- ✅ 5 named unit tests pass per 01-VALIDATION.md.

Plan 03 is unblocked: the contract is ready for deployment to Mantle Sepolia and Blockscout verification.
</success_criteria>

<output>
After completion, create `.planning/phases/01-lock-skeleton/01-02-SUMMARY.md` documenting:
- Confirmation of `forge test` output (5/5 passed).
- The gas envelope from `forge test --gas-report` for publishRating, requestRating, latestRating, ratingHistory (informational; Phase 3 will compare).
- Confirmation that the `onlyAgent` modifier abstraction is in place and that Phase 3 will swap only the modifier BODY, not the function signatures or storage layout.
- Forward pointer: Plan 03 deploys this contract to Mantle Sepolia (chain 5003) with Blockscout verification and runs a smoke `requestRating` transaction to clear the 20 Project Deployment Award bar.
</output>
