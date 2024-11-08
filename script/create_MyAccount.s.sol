// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {MyAccountFactory} from "../src/sa/MyAccountFactory.sol";
import {MyAccount} from "../src/sa/MyAccount.sol";

// forge script --rpc-url $sepolia script/create_MyAccount.s.sol --account dev --broadcast --verify

contract DeployMyAccountFactoryScript is Script {
    MyAccountFactory public factory = MyAccountFactory(0x7cdf84c1d0915748Df0f1dA6d92701ac6A903E41);
    address ecdsaValidator = 0xd577C0746c19DeB788c0D698EcAf66721DC2F7A4;
    address owner = 0xd78B5013757Ea4A7841811eF770711e6248dC282;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        MyAccount account = factory.createAccount(1, address(ecdsaValidator), abi.encodePacked(owner));

        vm.stopBroadcast();
    }
}
