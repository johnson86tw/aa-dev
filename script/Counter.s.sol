// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {Counter} from "../src/Counter.sol";

contract CounterScript is Script {
    Counter public counter;

    function setUp() public {}

    function run() public {
        bytes32 salt = vm.envBytes32("SALT");
        vm.startBroadcast();
        counter = new Counter{salt: salt}();
        console.log("Counter deployed at", address(counter));
        vm.stopBroadcast();
    }
}
