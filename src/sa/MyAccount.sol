// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.27;

import "@account-abstraction/contracts/interfaces/IAccount.sol";
import "@account-abstraction/contracts/interfaces/IAccountExecute.sol";

import {IERC7579Account, Execution} from "../interfaces/IERC7579Account.sol";
import {ModuleManager, IValidator} from "../core/ModuleManager.sol";
import {ExecutionLib} from "../lib/ExecutionLib.sol";
import {ExecutionHelper} from "../core/ExecutionHelper.sol";
import {
    MODULE_TYPE_VALIDATOR,
    MODULE_TYPE_EXECUTOR,
    MODULE_TYPE_FALLBACK,
    MODULE_TYPE_HOOK,
    MODULE_TYPE_POLICY,
    MODULE_TYPE_SIGNER
} from "../types/Constants.sol";
import {
    ModeLib,
    CallType,
    ExecType,
    ModeCode,
    CALLTYPE_SINGLE,
    CALLTYPE_BATCH,
    CALLTYPE_DELEGATECALL,
    EXECTYPE_DEFAULT,
    EXECTYPE_TRY
} from "../lib/ModeLib.sol";

/**
 * @author mainly modified from https://github.com/bcnmy/nexus and https://github.com/erc7579/erc7579-implementation
 */
contract MyAccount is IAccount, IAccountExecute, IERC7579Account, ModuleManager, ExecutionHelper {
    using ExecutionLib for bytes;
    using ModeLib for ModeCode;

    event AccountInitialized(address indexed entryPoint);

    error OnlyAccessByEntryPoint();
    error ExecuteUserOpFailed();
    error UnsupportedCallType(CallType callType);
    error UnsupportedExecType(ExecType execType);

    function initialize(address validator, bytes calldata data) public {
        _initModuleManager();
        _installValidator(validator, data);
        require(_hasValidators(), NoValidatorInstalled());
    }

    /**
     * @inheritdoc IAccount
     *
     * nonce: | 4 bytes nothing | 20 bytes validator address | 8 bytes sequence |
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

    /**
     * @inheritdoc IERC7579Account
     * @dev Modified from MSABasic
     */
    function execute(ModeCode mode, bytes calldata executionCalldata) external payable onlyEntryPointOrSelf {
        CallType callType = mode.getCallType();

        if (callType == CALLTYPE_BATCH) {
            Execution[] calldata executions = executionCalldata.decodeBatch();
            _execute(executions);
        } else if (callType == CALLTYPE_SINGLE) {
            (address target, uint256 value, bytes calldata callData) = executionCalldata.decodeSingle();
            _execute(target, value, callData);
        } else {
            revert UnsupportedCallType(callType);
        }
    }

    /**
     * @inheritdoc IERC7579Account
     * @dev Modified from MSABasic
     */
    function executeFromExecutor(ModeCode mode, bytes calldata executionCalldata)
        external
        payable
        onlyExecutorModule
        returns (
            bytes[] memory returnData // TODO returnData is not used
        )
    {
        CallType callType = mode.getCallType();

        if (callType == CALLTYPE_BATCH) {
            Execution[] calldata executions = executionCalldata.decodeBatch();
            returnData = _execute(executions);
        } else if (callType == CALLTYPE_SINGLE) {
            (address target, uint256 value, bytes calldata callData) = executionCalldata.decodeSingle();
            returnData = new bytes[](1);
            returnData[0] = _execute(target, value, callData);
        } else {
            revert UnsupportedCallType(callType);
        }
    }

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

    /**
     * @dev Modified from https://github.com/bcnmy/nexus Nexus
     */
    function supportsExecutionMode(ModeCode mode) external view virtual returns (bool isSupported) {
        (CallType callType, ExecType execType,,) = mode.decode();

        // Return true if both the call type and execution type are supported.
        return (callType == CALLTYPE_SINGLE || callType == CALLTYPE_BATCH || callType == CALLTYPE_DELEGATECALL)
            && (execType == EXECTYPE_DEFAULT || execType == EXECTYPE_TRY);
    }

    function supportsModule(uint256 moduleTypeId) external view virtual returns (bool) {
        if (moduleTypeId == MODULE_TYPE_VALIDATOR) return true;
        else if (moduleTypeId == MODULE_TYPE_EXECUTOR) return true;
        else if (moduleTypeId == MODULE_TYPE_FALLBACK) return true;
        else if (moduleTypeId == MODULE_TYPE_HOOK) return false;
        else return false;
    }

    /**
     * @dev Modified from https://github.com/bcnmy/nexus ModuleManager
     */
    function isModuleInstalled(uint256 moduleTypeId, address module, bytes calldata additionalContext)
        public
        view
        override
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
