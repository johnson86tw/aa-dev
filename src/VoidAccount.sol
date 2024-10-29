// SPDX-License-Identifier: MIT
/* solhint-disable no-inline-assembly */
pragma solidity 0.8.27;

import {IAccount} from "@account-abstraction/contracts/interfaces/IAccount.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";

contract VoidAccount is IAccount {
    function validateUserOp(
        PackedUserOperation calldata, /* userOp */
        bytes32, /* userOpHash */
        uint256 /* missingAccountFunds */
    ) external pure returns (uint256) {}

    function execute(address target, uint256 value, bytes calldata data) external {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }
}
