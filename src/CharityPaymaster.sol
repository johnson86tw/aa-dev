// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.27;

import "@account-abstraction/contracts/interfaces/IPaymaster.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";

/*
    deposit

    cast send --account dev  --rpc-url $sepolia \
        0x0000000071727De22E5E9d8BAf0edAc6f37da032 \
        "depositTo(address account)" \
        0x31aC948B6463f317fFafd9d8182D60A3B9Cd79c8 \
        --value 0.5ether
*/

contract CharityPaymaster is IPaymaster {
    uint256 constant VALIDATION_FAILED = 1;
    uint256 constant VALIDATION_SUCCESS = 0;

    IEntryPoint public entryPoint = IEntryPoint(0x0000000071727De22E5E9d8BAf0edAc6f37da032);

    /**
     * maxCost: equal to requiredPreFund
     */
    function validatePaymasterUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 maxCost)
        external
        returns (bytes memory context, uint256 validationData)
    {
        return ("", VALIDATION_SUCCESS);
    }

    function postOp(PostOpMode mode, bytes calldata context, uint256 actualGasCost, uint256 actualUserOpFeePerGas)
        external
    {}
}
