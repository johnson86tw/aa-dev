// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract IsValidSignature {
    bytes4 internal constant MAGICVALUE = 0x1626ba7e;

    address public owner;

    error InvalidSignature(bytes32 hash, address recovered, bytes signature);

    constructor(address _owner) {
        owner = _owner;
    }

    function isValidSignature(bytes32 digest, bytes calldata signature) external view returns (bytes4) {
        bytes32 hash = MessageHashUtils.toEthSignedMessageHash(digest);
        if (owner != ECDSA.recover(hash, signature)) {
            revert InvalidSignature(hash, ECDSA.recover(hash, signature), signature);
        }
        return MAGICVALUE;
    }
}
