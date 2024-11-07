// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {WebAuthnValidator} from "../src/modules/webauthn/WebAuthnValidator.sol";

// forge script --rpc-url $sepolia script/deploy_WebAuthnValidator.s.sol --account dev --via-ir --broadcast --verify

contract DeployWebAuthnValidatorScript is Script {
    WebAuthnValidator public validator;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        validator = new WebAuthnValidator();

        vm.stopBroadcast();
    }
}
