// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import "../src/modules/ECDSAValidator.sol";
import "../src/sa/MyAccountFactory.sol";
import "../src/sa/MyAccount.sol";
import "../src/lib/ModeLib.sol";
import "../src/lib/ExecutionLib.sol";
import "./utils/AAUtils.sol";
import "./utils/AATest.sol";

import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract MyAccountTest is AATest {
    using ExecutionLib for bytes;

    ECDSAValidator public validator;
    MyAccountFactory public factory;
    MyAccount public account;
    address alice = vm.addr(0xbeef);

    function setUp() public {
        validator = new ECDSAValidator();
        factory = new MyAccountFactory(entryPoint);
        account = factory.createAccount(1, address(validator), abi.encodePacked(alice));
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
        // prefund
        deal(address(account), 1 ether);
        // recipient
        address bob = address(0xdead);

        uint192 nonceKey = uint192(bytes24(abi.encodePacked(bytes4(0), address(validator))));
        uint256 nonce = IEntryPoint(entryPoint).getNonce(address(account), nonceKey);

        ModeCode modeCode =
            ModeLib.encode(CALLTYPE_SINGLE, EXECTYPE_DEFAULT, MODE_DEFAULT, ModePayload.wrap(bytes22(0)));

        bytes memory executionCalldata = ExecutionLib.encodeSingle(bob, 0.01 ether, "");
        bytes memory callData = abi.encodeCall(MyAccount.execute, (modeCode, executionCalldata));

        uint256 callGasLimit = 200_000;
        uint256 verificationGasLimit = 80_000;
        uint256 preVerificationGas = 0;
        uint256 maxPriorityFeePerGas = 1_000_000;
        uint256 maxFeePerGas = 1_000_000;

        PackedUserOperation memory userOp = PackedUserOperation({
            sender: address(account),
            nonce: nonce,
            initCode: bytes(""),
            callData: callData,
            accountGasLimits: AAUtils.pack(callGasLimit, verificationGasLimit),
            preVerificationGas: preVerificationGas,
            gasFees: AAUtils.pack(maxPriorityFeePerGas, maxFeePerGas),
            paymasterAndData: bytes(""),
            signature: bytes("")
        });

        bytes32 userOpHash = IEntryPoint(entryPoint).getUserOpHash(userOp);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xbeef, MessageHashUtils.toEthSignedMessageHash(userOpHash));
        userOp.signature = abi.encodePacked(r, s, v);

        AAUtils.logUserOp(userOp);

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = userOp;

        IEntryPoint(entryPoint).handleOps(ops, payable(alice));

        assertEq(bob.balance, 0.01 ether);
    }
}
