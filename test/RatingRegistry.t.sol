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
        // Boundary: grade == 0 (AAA) is allowed (lower-boundary symmetry per IN-04).
        registry.publishRating(subject, GradeEnum.AAA, bytes32(uint256(1)), 50);

        // Boundary: grade == 9 (D) is allowed.
        registry.publishRating(subject, GradeEnum.D, bytes32(uint256(2)), 50);
        RatingRegistry.Rating memory latest = registry.latestRating(subject);
        assertEq(latest.grade, uint8(9));

        // Boundary: grade == 10 reverts.
        vm.expectRevert(RatingRegistry.InvalidGrade.selector);
        registry.publishRating(subject, 10, bytes32(uint256(3)), 50);
    }

    /// 1-02-02b — Confidence must be 0..100 (WR-01 fix).
    function test_publishRating_confidenceRange() public {
        // Boundary: confidence == 0 is allowed.
        registry.publishRating(subject, GradeEnum.AAA, bytes32(uint256(1)), 0);
        // Boundary: confidence == 100 is allowed.
        registry.publishRating(subject, GradeEnum.AAA, bytes32(uint256(2)), 100);
        RatingRegistry.Rating memory latest = registry.latestRating(subject);
        assertEq(latest.confidence, uint8(100));

        // Boundary: confidence == 101 reverts.
        vm.expectRevert(RatingRegistry.InvalidConfidence.selector);
        registry.publishRating(subject, GradeEnum.AAA, bytes32(uint256(3)), 101);

        // Boundary: confidence == 255 (uint8 max) reverts.
        vm.expectRevert(RatingRegistry.InvalidConfidence.selector);
        registry.publishRating(subject, GradeEnum.AAA, bytes32(uint256(4)), 255);
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
