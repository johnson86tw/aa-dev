// SPDX-License-Identifier: MIT

pragma solidity ^0.8.23;

import {ISessionValidator} from "./interfaces/ISessionValidator.sol";
import {ECDSAValidator, ECDSA} from "./modules/ECDSAValidator.sol";

contract ECDSASessionValidator is ISessionValidator, ECDSAValidator {
    function validateSignatureWithData(bytes32 hash, bytes calldata sig, bytes calldata data)
        external
        view
        returns (bool validSig)
    {
        address owner = address(bytes20(data[0:20]));
        if (owner == ECDSA.recover(hash, sig)) {
            return true;
        }
        bytes32 ethHash = ECDSA.toEthSignedMessageHash(hash);
        address recovered = ECDSA.recover(ethHash, sig);
        if (owner == recovered) {
            return true;
        }
        return false;
    }
}
