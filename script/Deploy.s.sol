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
