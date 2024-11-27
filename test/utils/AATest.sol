// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {EntryPoint} from "@account-abstraction/contracts/core/EntryPoint.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {UserOperationLib} from "@account-abstraction/contracts/core/UserOperationLib.sol";

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";

import {Wallet, WalletLib} from "./Wallet.sol";

abstract contract AATest is Test {
    using UserOperationLib for PackedUserOperation;
    using WalletLib for Wallet;

    EntryPoint entryPoint = new EntryPoint();

    /**
     * custom params: sender, nonce, initCode, callData, paymasterAndData, signature
     */
    function createUserOp() internal pure returns (PackedUserOperation memory) {
        return PackedUserOperation({
            sender: address(0),
            nonce: 0,
            initCode: bytes(""),
            callData: bytes(""),
            accountGasLimits: pack(999_999, 999_999),
            preVerificationGas: 99_999,
            gasFees: pack(999_999, 999_999),
            paymasterAndData: bytes(""),
            signature: bytes("")
        });
    }

    function handleUserOp(PackedUserOperation memory userOp) internal {
        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = userOp;

        entryPoint.handleOps(ops, payable(msg.sender));
    }

    function expectRevertFailedOp(string memory reason) internal {
        vm.expectRevert(abi.encodeWithSelector(IEntryPoint.FailedOp.selector, 0, reason));
    }

    function signUserOp(Wallet memory signer, PackedUserOperation memory userOp) internal view {
        bytes32 userOpHash = getUserOpHash(userOp);
        (uint8 v, bytes32 r, bytes32 s) = signer.sign(userOpHash);
        userOp.signature = abi.encodePacked(r, s, v);
    }

    function getUserOpHash(PackedUserOperation memory userOp, address entrypoint) internal view returns (bytes32) {
        return this._getUserOpHash(userOp, entrypoint);
    }

    function getUserOpHash(PackedUserOperation memory userOp) internal view returns (bytes32) {
        return this._getUserOpHash(userOp, address(entryPoint));
    }

    function _getUserOpHash(PackedUserOperation calldata userOp, address entrypoint) public view returns (bytes32) {
        return keccak256(abi.encode(userOp.hash(), entrypoint, block.chainid));
    }

    function pack(uint256 a, uint256 b) internal pure returns (bytes32) {
        return bytes32((a << 128) | b);
    }

    function logUserOp(PackedUserOperation memory userOp) internal pure {
        console.log(userOp.sender);
        console.log(userOp.nonce);
        console.logBytes(userOp.initCode);
        console.logBytes(userOp.callData);
        console.logBytes32(userOp.accountGasLimits);
        console.log(toHexString(userOp.preVerificationGas));
        console.logBytes32(userOp.gasFees);
        console.logBytes(userOp.paymasterAndData);
        console.logBytes(userOp.signature);
    }

    function toHexDigit(uint8 d) internal pure returns (bytes1) {
        if (0 <= d && d <= 9) {
            return bytes1(uint8(bytes1("0")) + d);
        } else if (10 <= uint8(d) && uint8(d) <= 15) {
            return bytes1(uint8(bytes1("a")) + d - 10);
        }
        revert("Invalid hex digit");
    }

    function toHexString(uint256 a) internal pure returns (string memory) {
        uint256 count = 0;
        uint256 b = a;
        while (b != 0) {
            count++;
            b /= 16;
        }
        bytes memory res = new bytes(count);
        for (uint256 i = 0; i < count; ++i) {
            b = a % 16;
            res[count - i - 1] = toHexDigit(uint8(b));
            a /= 16;
        }
        return string.concat("0x", string(res));
    }
}
