// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {ECDSAValidator} from "../src/modules/ECDSAValidator.sol";
import {WebAuthnValidator} from "../src/modules/webauthn/WebAuthnValidator.sol";
import {CharityPaymaster} from "../src/CharityPaymaster.sol";
import {MyAccountFactory} from "../src/sa/MyAccountFactory.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";

/*

local:
forge script script/deploy.s.sol --rpc-url http://localhost:8545 --broadcast --account anvil0

# deposit for CharityPaymaster
cast send --account anvil0 --rpc-url http://localhost:8545 0x0000000071727De22E5E9d8BAf0edAc6f37da032 "depositTo(address account)" 0x7c0BAD3f28E8823EF975b5e3d30fCefF81949989 --value 10ether


sepolia:
forge script script/deploy.s.sol --rpc-url $sepolia --broadcast --verify --account dev

mekong:
forge script script/deploy.s.sol --rpc-url $mekong --broadcast --account dev


*/

contract DeployScript is Script {
    function setUp() public {}

    function run() public {
        bytes32 salt = vm.envBytes32("SALT");

        vm.startBroadcast();

        ECDSAValidator validator = new ECDSAValidator{salt: salt}();
        console.log("ECDSAValidator deployed at", address(validator));

        WebAuthnValidator webauthn = new WebAuthnValidator{salt: salt}();
        console.log("WebAuthnValidator deployed at", address(webauthn));

        CharityPaymaster paymaster = new CharityPaymaster{salt: salt}();
        console.log("CharityPaymaster deployed at", address(paymaster));

        MyAccountFactory factory =
            new MyAccountFactory{salt: salt}(IEntryPoint(0x0000000071727De22E5E9d8BAf0edAc6f37da032));
        console.log("MyAccountFactory deployed at", address(factory));

        vm.stopBroadcast();
    }
}
