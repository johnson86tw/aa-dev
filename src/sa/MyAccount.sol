// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.27;

import "@account-abstraction/contracts/interfaces/IAccount.sol";
import "@account-abstraction/contracts/interfaces/IAccountExecute.sol";

import "../interfaces/IERC7579Account.sol";
import "../core/ModuleManager.sol";
import {
    MODULE_TYPE_VALIDATOR,
    MODULE_TYPE_EXECUTOR,
    MODULE_TYPE_FALLBACK,
    MODULE_TYPE_HOOK,
    MODULE_TYPE_POLICY,
    MODULE_TYPE_SIGNER
} from "../types/Constants.sol";

contract MyAccount is IAccount, IAccountExecute, ModuleManager {
    event AccountInitialized(address indexed entryPoint);

    error OnlyAccessByEntryPoint();
    error ExecuteUserOpFailed();

    function initialize(address validator, bytes calldata data) public {
        _initModuleManager();
        _installValidator(validator, data);
        require(_hasValidators(), NoValidatorInstalled());
    }

    /**
     * @inheritdoc IAccount
     */
    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
        external
        override
        onlyEntryPoint
        payPrefund(missingAccountFunds)
        returns (uint256 validationData)
    {
        uint256 nonce = userOp.nonce;
        address validator;
        assembly {
            validator := shr(96, shl(32, nonce))
        }

        if (_isValidatorInstalled(validator)) {
            revert ValidatorNotInstalled(validator);
        }

        validationData = IValidator(validator).validateUserOp(userOp, userOpHash);
    }

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

    /**
     * @dev only supports validator, exector, fallback
     * @dev Modified from https://github.com/bcnmy/nexus
     */
    function installModule(uint256 moduleTypeId, address module, bytes calldata initData) external payable {
        if (module == address(0)) revert ModuleAddressCanNotBeZero();
        if (moduleTypeId == MODULE_TYPE_VALIDATOR) {
            _installValidator(module, initData);
        } else if (moduleTypeId == MODULE_TYPE_EXECUTOR) {
            _installExecutor(module, initData);
        } else if (moduleTypeId == MODULE_TYPE_FALLBACK) {
            _installFallbackHandler(module, initData);
        } else {
            revert UnsupportedModuleType(moduleTypeId);
        }

        emit ModuleInstalled(moduleTypeId, module);
    }

    /**
     * @dev only supports validator, exector, fallback
     * @dev Modified from https://github.com/bcnmy/nexus
     */
    function uninstallModule(uint256 moduleTypeId, address module, bytes calldata deInitData) external payable {
        require(isModuleInstalled(moduleTypeId, module, deInitData), ModuleNotInstalled(moduleTypeId, module));

        if (moduleTypeId == MODULE_TYPE_VALIDATOR) {
            _uninstallValidator(module, deInitData);
        } else if (moduleTypeId == MODULE_TYPE_EXECUTOR) {
            _uninstallExecutor(module, deInitData);
        } else if (moduleTypeId == MODULE_TYPE_FALLBACK) {
            _uninstallFallbackHandler(module, deInitData);
        }

        emit ModuleUninstalled(moduleTypeId, module);
    }

    /**
     * @notice According to ERC-1271 standards
     * @dev First 20 bytes of signature will be validator address and rest of the bytes is complete signature.
     */
    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
        address validator = address(bytes20(signature[0:20]));
        require(_isValidatorInstalled(validator), ValidatorNotInstalled(validator));
        try IValidator(validator).isValidSignatureWithSender(msg.sender, hash, signature[20:]) returns (bytes4 res) {
            return res;
        } catch {
            return bytes4(0xffffffff);
        }
    }

    // function supportsExecutionMode(ModeCode encodedMode) external view returns (bool);

    // function supportsModule(uint256 moduleTypeId) external view returns (bool);

    /**
     * @dev Modified from https://github.com/bcnmy/nexus ModuleManager
     */
    function isModuleInstalled(uint256 moduleTypeId, address module, bytes calldata additionalContext)
        internal
        view
        returns (bool)
    {
        additionalContext;
        if (moduleTypeId == MODULE_TYPE_VALIDATOR) {
            return _isValidatorInstalled(module);
        } else if (moduleTypeId == MODULE_TYPE_EXECUTOR) {
            return _isExecutorInstalled(module);
        } else if (moduleTypeId == MODULE_TYPE_FALLBACK) {
            bytes4 selector;
            if (additionalContext.length >= 4) {
                selector = bytes4(additionalContext[0:4]);
            } else {
                selector = bytes4(0x00000000);
            }
            return _isFallbackHandlerInstalled(selector, module);
        } else {
            return false;
        }
    }

    function accountId() external pure virtual returns (string memory) {
        return "johnson86tw.0.0.1";
    }
}
