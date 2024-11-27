// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import "../src/modules/ECDSAValidator.sol";
import "../src/sa/MyAccountFactory.sol";
import "../src/sa/MyAccount.sol";
import "../src/lib/ModeLib.sol";
import "../src/lib/ExecutionLib.sol";
import "./utils/AAUtils.sol";
import "./utils/AATest.sol";
import "../src/core/AccountBase.sol";
import "../lib/sentinellist/src/SentinelListHelper.sol";

import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract MyAccountTest is AATest {
    using ExecutionLib for bytes;

    ECDSAValidator public validator;
    ECDSAValidator public validator2;
    MyAccountFactory public factory;
    MyAccount public account;
    address alice = vm.addr(0xbeef);

    function setUp() public {
        validator = new ECDSAValidator();
        validator2 = new ECDSAValidator();
        factory = new MyAccountFactory(entryPoint);
        account = factory.createAccount(1, address(validator), abi.encodePacked(alice));

        // prefund
        deal(address(account), 1 ether);
    }

    function testCreateAccount() public {
        address expected = factory.getAddress(1, address(validator), abi.encodePacked(alice));
        MyAccount account = factory.createAccount(1, address(validator), abi.encodePacked(alice));
        assertEq(address(account), expected);

        // check validator installed
        bool isValidatorInstalled = account.isModuleInstalled(MODULE_TYPE_VALIDATOR, address(validator), "");
        assertEq(isValidatorInstalled, true);
    }

    /**
     * isValidSignature's signature:
     * - [0:20] validator
     * - [20:] signature
     */
    function testIsValidSignature() public {
        bytes32 messageHash = keccak256("Hello, Ethereum!");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xbeef, messageHash);
        bytes memory sig = abi.encodePacked(bytes20(address(validator)), r, s, v);
        bytes4 result = account.isValidSignature(messageHash, sig);
        assertEq(result, ERC1271_MAGICVALUE);
    }

    function testInvalidSignature() public {
        bytes32 messageHash = keccak256("Hello, Ethereum!");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xdead, messageHash);
        bytes memory sig = abi.encodePacked(bytes20(address(validator)), r, s, v);
        bytes4 result = account.isValidSignature(messageHash, sig);
        console.logBytes4(result);
        assertEq(result, bytes4(0xffffffff));
    }

    function testSendUserOp() public {
        address bob = address(0xdead);

        ModeCode modeCode =
            ModeLib.encode(CALLTYPE_SINGLE, EXECTYPE_DEFAULT, MODE_DEFAULT, ModePayload.wrap(bytes22(0)));
        bytes memory executionCalldata = ExecutionLib.encodeSingle(bob, 0.001 ether, "");
        bytes memory callData = abi.encodeCall(MyAccount.execute, (modeCode, executionCalldata));
        handleUserOp(_createUserOp(callData));

        assertEq(bob.balance, 0.001 ether);
    }

    function test_installModule_revertWith_onlyEntryPointOfSelf() public {
        address bob = address(0xdead);
        vm.expectRevert(AccountBase.AccountAccessUnauthorized.selector);
        account.installModule(1, address(validator2), abi.encodePacked(bob));
    }

    function test_installModule() public {
        address bob = address(0xdead);

        bytes memory callData = abi.encodeCall(MyAccount.installModule, (1, address(validator2), abi.encodePacked(bob)));
        handleUserOp(_createUserOp(callData));

        assertEq(account.isModuleInstalled(MODULE_TYPE_VALIDATOR, address(validator2), ""), true);
    }

    function test_uninstallModule_revertWith_onlyEntryPointOfSelf() public {
        address bob = address(0xdead);
        bytes memory callData = abi.encodeCall(MyAccount.installModule, (1, address(validator2), abi.encodePacked(bob)));
        handleUserOp(_createUserOp(callData));

        vm.expectRevert(AccountBase.AccountAccessUnauthorized.selector);
        account.uninstallModule(1, address(validator2), "");
    }

    function test_uninstallModule() public {
        address bob = address(0xdead);
        bytes memory callData = abi.encodeCall(MyAccount.installModule, (1, address(validator2), abi.encodePacked(bob)));
        handleUserOp(_createUserOp(callData));

        // build deInitData: prev (address) ++ disableModuleData (bytes)
        (address[] memory validators,) = account.getValidatorsPaginated(address(0x1), 3);
        // for (uint256 i = 0; i < validators.length; i++) {
        //     console.log("Validator %d: %s", i, validators[i]);
        // }
        address prev = SentinelListHelper.findPrevious(validators, address(validator2));
        bytes memory deInitData = abi.encode(prev, bytes(""));

        // console.logBytes(deInitData);

        bytes memory callData2 = abi.encodeCall(MyAccount.uninstallModule, (1, address(validator2), deInitData));
        handleUserOp(_createUserOp(callData2));

        assertEq(account.isModuleInstalled(MODULE_TYPE_VALIDATOR, address(validator2), ""), false);
    }

    function _createUserOp(bytes memory _callData) internal view returns (PackedUserOperation memory) {
        PackedUserOperation memory userOp = createUserOp();
        uint192 nonceKey = uint192(bytes24(abi.encodePacked(bytes4(0), address(validator))));
        uint256 nonce = IEntryPoint(entryPoint).getNonce(address(account), nonceKey);
        userOp.sender = address(account);
        userOp.nonce = nonce;
        userOp.callData = _callData;
        bytes32 userOpHash = IEntryPoint(entryPoint).getUserOpHash(userOp);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xbeef, MessageHashUtils.toEthSignedMessageHash(userOpHash));
        userOp.signature = abi.encodePacked(r, s, v);
        return userOp;
    }
}
