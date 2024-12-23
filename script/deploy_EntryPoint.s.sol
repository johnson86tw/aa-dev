// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import {EntryPoint} from "@account-abstraction/contracts/core/EntryPoint.sol";

contract DeployEntryPointScript is Script {
    function run() public {
        vm.startBroadcast();
        EntryPoint entryPoint =
            new EntryPoint{salt: 0x90d8084deab30c2a37c45e8d47f49f2f7965183cb6990a98943ef94940681de3}();
        console.log("EntryPoint deployed at:", address(entryPoint));
    }
}
