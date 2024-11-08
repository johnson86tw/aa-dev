// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import "@account-abstraction/contracts/core/EntryPoint.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@account-abstraction/contracts/samples/SimpleAccount.sol";
import {AAUtils} from "../test/utils/AAUtils.sol";

// forge script --rpc-url $sepolia script/SendUserOps.s.sol --broadcast

contract SendUserOps is Script {
    address constant entryPoint = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
    address constant account = 0xCb1B73E62150a8DC4A9b04206D6EB0d9E99984B9;
    address constant recipient = 0xd78B5013757Ea4A7841811eF770711e6248dC282;

    function run() public {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address owner = vm.addr(privateKey);

        PackedUserOperation memory userOp = PackedUserOperation({
            sender: account,
            nonce: IEntryPoint(entryPoint).getNonce(account, 0),
            initCode: bytes(""),
            callData: bytes(""),
            accountGasLimits: AAUtils.pack(80_000, 80_000),
            preVerificationGas: 0,
            gasFees: AAUtils.pack(1322204, 6900385),
            paymasterAndData: bytes(""),
            signature: bytes("")
        });

        // abi.encodeCall(SimpleAccount.execute, (recipient, 0.01 ether, ""))

        bytes memory callData =
            hex"b61d27f60000000000000000000000009e8f8c3ad87dbe7acffc5f5800e7433c8df409f200000000000000000000000000000000000000000000000000038d7ea4c6800000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000";
        userOp.callData = callData;

        bytes32 userOpHash = IEntryPoint(entryPoint).getUserOpHash(userOp);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, MessageHashUtils.toEthSignedMessageHash(userOpHash));
        userOp.signature = abi.encodePacked(r, s, v);

        AAUtils.logUserOp(userOp);

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = userOp;

        bytes memory rawInputData = abi.encodeCall(IEntryPoint.handleOps, (ops, payable(owner)));
        console.log("=========== rawInputData ===========");
        console.logBytes(rawInputData);

        vm.startBroadcast(privateKey);

        IEntryPoint(entryPoint).handleOps(ops, payable(owner));

        vm.stopBroadcast();
    }
}
