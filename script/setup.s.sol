// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {ECDSAValidator} from "../src/modules/ECDSAValidator.sol";
import {WebAuthnValidator} from "../src/modules/webauthn/WebAuthnValidator.sol";
import {CharityPaymaster} from "../src/CharityPaymaster.sol";
import {MyAccountFactory} from "../src/sa/MyAccountFactory.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {Counter} from "../src/Counter.sol";
/*

local:
forge script script/setup.s.sol --rpc-url http://localhost:8545 --broadcast --account anvil0

*/

contract SetupScript is Script {
    function setUp() public {}

    function run() public {
        bytes32 salt = vm.envBytes32("SALT");
        console.logBytes32(salt);

        vm.startBroadcast();

        ECDSAValidator validator = new ECDSAValidator{salt: salt}();
        console.log("ECDSAValidator deployed at", address(validator));

        WebAuthnValidator webauthn = new WebAuthnValidator{salt: salt}();
        console.log("WebAuthnValidator deployed at", address(webauthn));

        Counter counter = new Counter{salt: salt}();
        console.log("Counter deployed at", address(counter));

        MyAccountFactory factory =
            new MyAccountFactory{salt: salt}(IEntryPoint(0x0000000071727De22E5E9d8BAf0edAc6f37da032));
        console.log("MyAccountFactory deployed at", address(factory));

        CharityPaymaster paymaster = new CharityPaymaster{salt: salt}();
        console.log("CharityPaymaster deployed at", address(paymaster));

        IEntryPoint(0x0000000071727De22E5E9d8BAf0edAc6f37da032).depositTo{value: 10 ether}(address(paymaster));
        console.log("Deposited 10 ETH to EntryPoint for paymaster");

        vm.stopBroadcast();
    }
}
