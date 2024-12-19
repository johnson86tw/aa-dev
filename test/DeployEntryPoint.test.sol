// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import {EntryPoint} from "@account-abstraction/contracts/core/EntryPoint.sol";

contract DeployEntryPointTest is Test {
    function setUp() public {}

    function test() public {
        address deployer = vm.addr(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80);
        vm.startPrank(deployer);
        bytes32 salt = 0x90d8084deab30c2a37c45e8d47f49f2f7965183cb6990a98943ef94940681de3;
        EntryPoint entryPoint = new EntryPoint{salt: salt}();
        console.log("EntryPoint deployed at:", address(entryPoint));
    }
}
