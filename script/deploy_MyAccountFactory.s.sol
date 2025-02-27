// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {MyAccountFactory} from "../src/sa/MyAccountFactory.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";

/*
forge script --rpc-url $devnet5 script/deploy_MyAccountFactory.s.sol --account dev --broadcast
forge script --rpc-url $devnet5 script/deploy_MyAccountFactory.s.sol --account dev --broadcast --verify --verifier-url https://eth-sepolia.blockscout.com/api
*/

contract DeployMyAccountFactoryScript is Script {
    MyAccountFactory public factory;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        factory = new MyAccountFactory(IEntryPoint(0x0000000071727De22E5E9d8BAf0edAc6f37da032));
        console.log("MyAccountFactory deployed at", address(factory));

        console.log("MyAccountImpl deployed at", address(factory.accountImplementation()));

        vm.stopBroadcast();
    }
}
