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
