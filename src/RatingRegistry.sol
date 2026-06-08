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

    /// @notice Address authorized to call publishRating. Phase 3 swaps the gate logic
    ///         via redeploy (not in-place rotation) — see contract-level natspec.
    /// @dev `immutable` per WR-02: matches the documented "set once" intent, saves an
    ///      SLOAD per publishRating, and prevents a future patch from silently adding
    ///      a setAgent(...) rotation path.
    address public immutable agent;

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
    /// @notice Reverted by publishRating when confidence > 100 (per WR-01: confidence
    ///         is a 0-100 percentage, not the full uint8 range).
    error InvalidConfidence();

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

    /// @notice Agent publishes a rating. Reverts InvalidGrade() if grade > 9, or
    ///         InvalidConfidence() if confidence > 100.
    /// @dev Per CON-publishRating-signature. Phase 1 stub: records & emits, with
    ///      grade and confidence bounds enforced on-chain. Phase 3 will add
    ///      reasoningHash sourcing from IPFS.
    function publishRating(
        address subject,
        uint8 grade,
        bytes32 reasoningHash,
        uint8 confidence
    ) external onlyAgent {
        if (grade > GradeEnum.MAX) revert InvalidGrade();
        if (confidence > 100) revert InvalidConfidence();
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

    /// @notice Returns the most recent Rating for `subject`. If no rating has been
    ///         published, returns a zero-valued Rating where `timestamp == 0` is the
    ///         canonical "no rating" sentinel — `block.timestamp` is never 0 on a
    ///         live chain or Foundry default (Foundry starts at timestamp 1).
    /// @dev Per WR-03: don't rely on `subject == address(0)` as the sentinel —
    ///      a legitimate publishRating(address(0), ...) call would create a false
    ///      negative. `timestamp == 0` is the robust signal.
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
