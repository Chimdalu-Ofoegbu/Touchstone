// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {RatingRegistry} from "../src/RatingRegistry.sol";
import {GradeEnum} from "../src/constants/GradeEnum.sol";
import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";

/// @notice Unit tests per 01/03-VALIDATION.md per-task verification map.
contract RatingRegistryTest is Test {
    RatingRegistry internal registry;
    address internal agent;
    address internal subject = address(0xBEEF);
    address internal nonAgent = address(0xCAFE);

    /// @dev Canonical ERC-8004 Identity Registry on Mantle Mainnet (D-01) — the
    ///      gate target. Etched with dummy code in setUp so vm.mockCall on
    ///      `ownerOf` works (Pitfall 4: Solidity emits extcodesize before the
    ///      external call). The mocked owner is `agent` for every test below.
    address internal registryAddr;
    uint256 internal constant AGENT_TOKEN_ID = 1;

    // Re-declared so the test can use vm.expectEmit against the contract's events.
    event RatingPublished(
        address indexed subject,
        uint8 grade,
        bytes32 reasoningHash,
        uint8 confidence,
        uint256 timestamp,
        string cid
    );
    event RatingRequested(
        address indexed subject,
        address indexed requester,
        uint256 timestamp
    );

    function setUp() public {
        agent = address(this); // mocked ERC-8004 NFT holder for the gate tests
        registryAddr = address(0x8004A169FB4a3325136EB29fA0ceB6D2e539a432);
        vm.etch(registryAddr, hex"01"); // Pitfall 4: code MUST exist before any vm.mockCall
        registry = new RatingRegistry(registryAddr, AGENT_TOKEN_ID);
    }

    /// @dev Mocks the gate's `ownerOf(AGENT_TOKEN_ID)` cross-contract call to
    ///      return `agent`, so a `vm.prank(agent)` publish passes the gate. Reused
    ///      by every positive-path test (the old `agent = address(this)` direct
    ///      check no longer satisfies the live ownerOf gate).
    function _mockGateOwner(address owner) internal {
        vm.mockCall(
            registryAddr,
            abi.encodeWithSelector(IIdentityRegistry.ownerOf.selector, AGENT_TOKEN_ID),
            abi.encode(owner)
        );
    }

    /// 3-01-01 — ownerOf gate reverts for a non-holder (D-01 load-bearing proof,
    ///           T-03-01). ownerOf returns the real agent, but a different address
    ///           calls → NotAgent. This is THE negative gate test, written FIRST.
    function test_publishRating_revertsForNonAgent() public {
        _mockGateOwner(agent); // ownerOf returns the real agent...
        vm.prank(nonAgent); // ...but a different address calls
        vm.expectRevert(RatingRegistry.NotAgent.selector);
        registry.publishRating(subject, GradeEnum.AAA, bytes32(uint256(1)), 100, "bafytest");
    }

    /// 3-01-02 — ownerOf gate succeeds for the NFT holder (mocked ownerOf → agent).
    function test_publishRating_succeedsForAgent() public {
        _mockGateOwner(agent);
        vm.prank(agent);
        registry.publishRating(subject, GradeEnum.BBB, bytes32(uint256(1)), 80, "bafytest");
    }

    /// 1-02-02 — Grade enum 0-9 maps AAA-D, reverts above 9 (under the ownerOf gate).
    function test_publishRating_gradeRange() public {
        _mockGateOwner(agent);
        vm.startPrank(agent);
        // Boundary: grade == 0 (AAA) is allowed (lower-boundary symmetry per IN-04).
        registry.publishRating(subject, GradeEnum.AAA, bytes32(uint256(1)), 50, "bafytest");

        // Boundary: grade == 9 (D) is allowed.
        registry.publishRating(subject, GradeEnum.D, bytes32(uint256(2)), 50, "bafytest");
        RatingRegistry.Rating memory latest = registry.latestRating(subject);
        assertEq(latest.grade, uint8(9));

        // Boundary: grade == 10 reverts.
        vm.expectRevert(RatingRegistry.InvalidGrade.selector);
        registry.publishRating(subject, 10, bytes32(uint256(3)), 50, "bafytest");
        vm.stopPrank();
    }

    /// 1-02-02b — Confidence must be 0..100 (WR-01 fix; under the ownerOf gate).
    function test_publishRating_confidenceRange() public {
        _mockGateOwner(agent);
        vm.startPrank(agent);
        // Boundary: confidence == 0 is allowed.
        registry.publishRating(subject, GradeEnum.AAA, bytes32(uint256(1)), 0, "bafytest");
        // Boundary: confidence == 100 is allowed.
        registry.publishRating(subject, GradeEnum.AAA, bytes32(uint256(2)), 100, "bafytest");
        RatingRegistry.Rating memory latest = registry.latestRating(subject);
        assertEq(latest.confidence, uint8(100));

        // Boundary: confidence == 101 reverts.
        vm.expectRevert(RatingRegistry.InvalidConfidence.selector);
        registry.publishRating(subject, GradeEnum.AAA, bytes32(uint256(3)), 101, "bafytest");

        // Boundary: confidence == 255 (uint8 max) reverts.
        vm.expectRevert(RatingRegistry.InvalidConfidence.selector);
        registry.publishRating(subject, GradeEnum.AAA, bytes32(uint256(4)), 255, "bafytest");
        vm.stopPrank();
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
        // Empty case: returns zero-valued Rating. Per WR-03, `timestamp == 0` is the
        // canonical "no rating" sentinel (block.timestamp is never 0 on a live chain
        // or Foundry default). Lead with the timestamp assertion; subject/grade asserts
        // remain as additional integrity checks.
        RatingRegistry.Rating memory empty = registry.latestRating(subject);
        assertEq(empty.timestamp, uint256(0));
        assertEq(empty.subject, address(0));
        assertEq(empty.grade, uint8(0));
        // Empty sentinel carries cid == "" (positional ctor gained the trailing "").
        assertEq(empty.cid, "");

        // Publish two ratings; latestRating must return the second.
        _mockGateOwner(agent);
        vm.startPrank(agent);
        registry.publishRating(subject, GradeEnum.AAA, bytes32(uint256(1)), 90, "bafyfirst");
        registry.publishRating(subject, GradeEnum.BBB, bytes32(uint256(2)), 75, "bafysecond");
        vm.stopPrank();
        RatingRegistry.Rating memory latest = registry.latestRating(subject);
        assertEq(latest.grade, uint8(3)); // BBB
        assertEq(latest.confidence, uint8(75));
        assertEq(latest.reasoningHash, bytes32(uint256(2)));
        assertEq(latest.subject, subject);
        // agentIdentity is msg.sender, which under the gate is the pranked agent.
        assertEq(latest.agentIdentity, agent);
    }

    /// 3-01-03 — cid round-trips through latestRating (D-02: the IPFS pointer is a
    ///           first-class on-chain field, written atomically with reasoningHash).
    function test_latestRating_returnsCid() public {
        _mockGateOwner(agent);
        vm.prank(agent);
        registry.publishRating(subject, GradeEnum.BBB, bytes32(uint256(7)), 80, "bafyxyz");
        RatingRegistry.Rating memory latest = registry.latestRating(subject);
        assertEq(latest.cid, "bafyxyz");
        // hash + cid land in the SAME call — both present, never a hash with no pointer.
        assertEq(latest.reasoningHash, bytes32(uint256(7)));
    }

    /// 1-02-05 — ratingHistory returns full timeline.
    function test_ratingHistory_returnsAll() public {
        // Empty case: returns empty array.
        RatingRegistry.Rating[] memory empty = registry.ratingHistory(subject);
        assertEq(empty.length, 0);

        // Publish three; ratingHistory must return all three in order.
        _mockGateOwner(agent);
        vm.startPrank(agent);
        registry.publishRating(subject, GradeEnum.AAA, bytes32(uint256(1)), 95, "bafytest");
        registry.publishRating(subject, GradeEnum.AA,  bytes32(uint256(2)), 88, "bafytest");
        registry.publishRating(subject, GradeEnum.A,   bytes32(uint256(3)), 80, "bafytest");
        vm.stopPrank();
        RatingRegistry.Rating[] memory history = registry.ratingHistory(subject);
        assertEq(history.length, 3);
        assertEq(history[0].grade, uint8(0)); // AAA
        assertEq(history[1].grade, uint8(1)); // AA
        assertEq(history[2].grade, uint8(2)); // A
    }
}
