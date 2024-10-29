// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.27;

import "@account-abstraction/contracts/interfaces/IPaymaster.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";

contract Paymaster is IPaymaster {
    uint256 constant VALIDATION_FAILED = 1;
    uint256 constant VALIDATION_SUCCESS = 0;

    address public owner;

    // whitelist address
    mapping(address => bool) private allowlist;

    IEntryPoint public immutable entryPoint;

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    constructor(IEntryPoint _entryPoint, address[] memory _allowlist) {
        entryPoint = _entryPoint;

        for (uint256 i = 0; i < _allowlist.length; i++) {
            allowlist[_allowlist[i]] = true;
        }
    }

    error NotAllowed(address sender);

    /**
     * maxCost: equal to requiredPreFund
     */
    function validatePaymasterUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 maxCost)
        external
        returns (bytes memory context, uint256 validationData)
    {
        // check userOp.sender
        if (!allowlist[userOp.sender]) {
            // return ("", VALIDATION_FAILED);
            revert NotAllowed(userOp.sender);
        }

        return ("", VALIDATION_SUCCESS);
    }

    function postOp(PostOpMode mode, bytes calldata context, uint256 actualGasCost, uint256 actualUserOpFeePerGas)
        external
    {}

    function addAllowlist(address _address) external onlyOwner {
        allowlist[_address] = true;
    }

    function _onlyOwner() internal view {
        //directly from EOA owner, or through the account itself (which gets redirected through execute())
        require(msg.sender == owner || msg.sender == address(this), "only owner");
    }
}
