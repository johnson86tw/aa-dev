// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {AllowlistPaymaster} from "../src/AllowlistPaymaster.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";

/*

local:
forge script script/deploy_Paymaster.s.sol --rpc-url http://localhost:8545 --broadcast --account anvil0
cast send --account anvil0 --rpc-url http://localhost:8545 0x0000000071727De22E5E9d8BAf0edAc6f37da032 "depositTo(address account)" 0x4f9B425965ee5D41900fEE4b4dAA481b362744e8 --value 0.1ether


sepolia:
forge script --rpc-url $sepolia script/deploy_Paymaster.s.sol --account dev --verify --broadcast
cast send --account dev  --rpc-url $sepolia \
    0x0000000071727De22E5E9d8BAf0edAc6f37da032 \
    "depositTo(address account)" \
    0x4f9B425965ee5D41900fEE4b4dAA481b362744e8 \
    --value 0.1ether


# Check balance of paymaster
cast call --rpc-url $sepolia \
    0x0000000071727De22E5E9d8BAf0edAc6f37da032 \
    "balanceOf(address account)" \
    0x4f9B425965ee5D41900fEE4b4dAA481b362744e8
*/

contract DeployAllowlistPaymasterScript is Script {
    AllowlistPaymaster public pm;

    function setUp() public {}

    function run() public {
        bytes32 salt = vm.envBytes32("SALT");
        vm.startBroadcast();

        address[] memory allowlist = new address[](1);
        allowlist[0] = 0x67CE34Bc421060B8594CdD361cE201868845045b; // MyAccount
        pm = new AllowlistPaymaster{salt: salt}(IEntryPoint(0x0000000071727De22E5E9d8BAf0edAc6f37da032), allowlist);
        console.log("Paymaster deployed at", address(pm));
        vm.stopBroadcast();
    }
}
