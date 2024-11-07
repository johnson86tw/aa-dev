// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {MyAccountFactory} from "../src/sa/MyAccountFactory.sol";
import {MyAccount} from "../src/sa/MyAccount.sol";

contract DeployMyAccountFactoryScript is Script {
    MyAccountFactory public factory = MyAccountFactory(0xC2Acdb852F4a1c8D09Ae3B1b53b093f13ea0cFA6);
    address ecdsaValidator = 0xd577C0746c19DeB788c0D698EcAf66721DC2F7A4;
    address owner = 0xd78B5013757Ea4A7841811eF770711e6248dC282;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        MyAccount account = factory.createAccount(1, address(ecdsaValidator), abi.encodePacked(owner));

        vm.stopBroadcast();
    }
}
