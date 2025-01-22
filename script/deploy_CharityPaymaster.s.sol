// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {CharityPaymaster} from "../src/CharityPaymaster.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";

/*

sepolia:
forge script script/deploy_CharityPaymaster.s.sol --rpc-url $sepolia --broadcast --account dev

*/

contract SetupScript is Script {
    function setUp() public {}

    function run() public {
        bytes32 salt = vm.envBytes32("SALT");
        console.logBytes32(salt);

        vm.startBroadcast();

        CharityPaymaster paymaster = new CharityPaymaster{salt: salt}();
        console.log("CharityPaymaster deployed at", address(paymaster));

        IEntryPoint(0x0000000071727De22E5E9d8BAf0edAc6f37da032).depositTo{value: 0.1 ether}(address(paymaster));
        console.log("Deposited 1 ETH to EntryPoint for paymaster");

        vm.stopBroadcast();
    }
}
