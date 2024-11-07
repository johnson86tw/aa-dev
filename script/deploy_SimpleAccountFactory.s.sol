// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {SimpleAccountFactory} from "@account-abstraction/contracts/samples/SimpleAccountFactory.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";

contract DeploySimpleAccountFactoryScript is Script {
    SimpleAccountFactory public factory;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        address entrypointV07 = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
        factory = new SimpleAccountFactory(IEntryPoint(entrypointV07));

        vm.stopBroadcast();
    }
}
