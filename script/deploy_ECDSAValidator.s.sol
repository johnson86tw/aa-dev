// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {ECDSAValidator} from "../src/modules/ECDSAValidator.sol";

contract DeployECDSAValidatorScript is Script {
    ECDSAValidator public factory;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        factory = new ECDSAValidator();

        vm.stopBroadcast();
    }
}
