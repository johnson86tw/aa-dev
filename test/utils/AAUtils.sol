// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {console} from "forge-std/console.sol";
import "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";

library AAUtils {
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
