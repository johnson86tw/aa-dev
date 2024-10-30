// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.27;

// import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";

import "@account-abstraction/contracts/interfaces/IAccount.sol";
import "@account-abstraction/contracts/interfaces/IAccountExecute.sol";

import "../interfaces/IERC7579Account.sol";

contract MyAccount is IAccount, IAccountExecute {
    address public constant entryPoint = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    event AccountInitialized(address indexed entryPoint);

    error OnlyAccessByEntryPoint();
    error ExecuteUserOpFailed();

    modifier onlyEntryPoint() {
        if (msg.sender != entryPoint) {
            revert OnlyAccessByEntryPoint();
        }
        _;
    }

    receive() external payable {}

    function initialize() public {
        // install a validator
    }

    /**
     * @inheritdoc IAccount
     */
    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
        external
        override
        returns (uint256 validationData)
    {}

    /**
     * @inheritdoc IAccountExecute
     * @dev refer to MSABasic
     */
    function executeUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash) external override onlyEntryPoint {
        bytes calldata callData = userOp.callData[4:];
        (bool success,) = address(this).delegatecall(callData);
        if (!success) revert ExecuteUserOpFailed();
    }

    // function execute(ModeCode mode, bytes calldata executionCalldata) external payable;

    // function executeFromExecutor(ModeCode mode, bytes calldata executionCalldata)
    //     external
    //     payable
    //     returns (bytes[] memory returnData);

    // function installModule(uint256 moduleTypeId, address module, bytes calldata initData) external payable;

    // function uninstallModule(uint256 moduleTypeId, address module, bytes calldata deInitData) external payable;

    // function isValidSignature(bytes32 hash, bytes calldata data) external view returns (bytes4);

    // function supportsExecutionMode(ModeCode encodedMode) external view returns (bool);

    // function supportsModule(uint256 moduleTypeId) external view returns (bool);

    // function isModuleInstalled(uint256 moduleTypeId, address module, bytes calldata additionalContext)
    //     external
    //     view
    //     returns (bool);

    // function accountId() external view returns (string memory accountImplementationId);
}
