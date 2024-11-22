// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {Paymaster} from "../src/Paymaster.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";

// forge script --rpc-url $sepolia script/deploy_Paymaster.s.sol --account dev --verify --broadcast

/* @note deposit to entrypoint for paymaster
cast send --account dev  --rpc-url $sepolia \
    0x0000000071727De22E5E9d8BAf0edAc6f37da032 \
    "depositTo(address account)" \
    0xA2E1944eD3294f0202a063cc971ECe09cbd02e43 \
    --value 0.1ether
*/

/* @note check balance of paymaster
cast call --rpc-url $sepolia \
    0x0000000071727De22E5E9d8BAf0edAc6f37da032 \
    "balanceOf(address account)" \
    0xA2E1944eD3294f0202a063cc971ECe09cbd02e43
*/

contract DeployPaymasterScript is Script {
    Paymaster public factory;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        address[] memory allowlist = new address[](1);
        allowlist[0] = 0x67CE34Bc421060B8594CdD361cE201868845045b; // MyAccount
        factory = new Paymaster(IEntryPoint(0x0000000071727De22E5E9d8BAf0edAc6f37da032), allowlist);

        vm.stopBroadcast();
    }
}
