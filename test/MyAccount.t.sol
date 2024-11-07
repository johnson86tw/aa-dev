// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import "../src/modules/ECDSAValidator.sol";
import "../src/sa/MyAccountFactory.sol";
import "../src/sa/MyAccount.sol";

contract MyAccountTest is Test {
    ECDSAValidator public validator;
    MyAccountFactory public factory;
    MyAccount public account;
    address alice = vm.addr(0xbeef);

    function setUp() public {
        validator = new ECDSAValidator();
        factory = new MyAccountFactory();
        account = factory.createAccount(1, address(validator), abi.encodePacked(alice));
    }

    function testCreateAccount() public {
        address expected = factory.getAddress(1, address(validator), abi.encodePacked(alice));
        MyAccount account = factory.createAccount(1, address(validator), abi.encodePacked(alice));
        assertEq(address(account), expected);
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
}
