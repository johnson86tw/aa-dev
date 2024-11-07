// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {MyAccountFactory} from "../src/sa/MyAccountFactory.sol";

contract DeployMyAccountFactoryScript is Script {
    MyAccountFactory public factory;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        factory = new MyAccountFactory();

        vm.stopBroadcast();
    }
}
