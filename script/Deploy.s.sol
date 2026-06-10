// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {RatingRegistry} from "../src/RatingRegistry.sol";

/// @notice Deploys RatingRegistry to Mantle Mainnet (forge script --rpc-url mantle).
///         Phase 3 is a one-time redeploy (D-01): the ERC-8004 identity gate is
///         baked in via immutable constructor args (canonical registry + minted
///         agent token id), NOT an in-place rotation. Treat as the clean ship
///         deploy — iterate other logic against an anvil fork, redeploy live once.
contract Deploy is Script {
    /// @dev Mantle Mainnet ONLY canonical ERC-8004 Identity Registry (D-01). Do NOT
    ///      point at Sepolia — the canonical registry is Mainnet-only. Single named
    ///      constant so no one later substitutes a Sepolia address.
    address constant IDENTITY_REGISTRY = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432;

    function run() external returns (RatingRegistry registry) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        uint256 agentTokenId = vm.envUint("AGENT_TOKEN_ID"); // minted FIRST (ordering dependency)
        console2.log("Deployer (rating agent, must own AGENT_TOKEN_ID):", deployer);
        console2.log("Identity registry:", IDENTITY_REGISTRY);
        console2.log("Agent token id:", agentTokenId);

        vm.startBroadcast(deployerKey);
        registry = new RatingRegistry(IDENTITY_REGISTRY, agentTokenId);
        vm.stopBroadcast();

        console2.log("RatingRegistry deployed at:", address(registry));
    }
}
