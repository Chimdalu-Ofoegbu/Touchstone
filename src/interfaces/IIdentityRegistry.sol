// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IIdentityRegistry
/// @notice Minimal surface of the canonical ERC-8004 Identity Registry that
///         RatingRegistry depends on — only `ownerOf` is needed for the
///         identity gate (D-01: keep the interface minimal). The canonical
///         registry is an ERC-721 (`supportsInterface(0x80ac58cd) == true`),
///         so `ownerOf(uint256)` is a valid call.
/// @dev Hand-declared (no OpenZeppelin dependency — `lib/` carries only
///      forge-std). Declare ONLY the functions actually called, mirroring the
///      inline `parseAbi` minimal-surface discipline used in the agent adapters.
interface IIdentityRegistry {
    function ownerOf(uint256 tokenId) external view returns (address);
}
