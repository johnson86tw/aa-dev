// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import "./utils/AATest.sol";
import "../src/Paymaster.sol";
import "../src/VoidAccount.sol";

/**
 *  1. deploy paymaster
 *  2. deposit to entrypoint for paymaster
 *  3. send a uo with paymaster
 *
 *  forge test --mp test/Paymaster.t.sol -vvvv
 */
contract PaymasterTest is AATest {
    VoidAccount account;
    Paymaster paymaster;

    function setUp() public {
        account = new VoidAccount();
    }

    function testSendUserOpWithPaymaster() public {
        address[] memory allowlist = new address[](1);
        allowlist[0] = payable(address(account));
        paymaster = new Paymaster(EntryPoint(payable(entryPoint)), allowlist);

        // deposit to entrypoint for paymaster
        entryPoint.depositTo{value: 1 ether}(address(paymaster));

        address recipient = address(0xBEEF);

        deal(address(account), 1 ether);

        PackedUserOperation memory userOp = createUserOp();
        userOp.sender = address(account);
        userOp.callData = abi.encodeCall(VoidAccount.execute, (recipient, 1 ether, bytes("")));
        userOp.paymasterAndData = abi.encodePacked(address(paymaster), uint128(999_999), uint128(999_999));

        handleUserOp(userOp);

        assertEq(address(account).balance, 0);
        assertEq(recipient.balance, 1 ether);

        console.log("paymaster deposit balance", entryPoint.balanceOf(address(paymaster)));
    }

    function testNotAllowedSendUserOpWithPaymaster() public {
        address[] memory allowlist = new address[](0);
        paymaster = new Paymaster(EntryPoint(payable(entryPoint)), allowlist);

        // deposit to entrypoint for paymaster
        entryPoint.depositTo{value: 1 ether}(address(paymaster));

        address recipient = address(0xBEEF);

        deal(address(account), 1 ether);

        PackedUserOperation memory userOp = createUserOp();
        userOp.sender = address(account);
        userOp.callData = abi.encodeCall(VoidAccount.execute, (recipient, 1 ether, bytes("")));
        userOp.paymasterAndData = abi.encodePacked(address(paymaster), uint128(999_999), uint128(999_999));

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = userOp;

        // vm.expectRevert(abi.encodeWithSelector(IEntryPoint.FailedOp.selector, 0, "AA34 signature error"));

        vm.expectRevert(
            abi.encodeWithSelector(
                IEntryPoint.FailedOpWithRevert.selector,
                0,
                "AA33 reverted",
                abi.encodeWithSelector(Paymaster.NotAllowed.selector, address(account))
            )
        );
        entryPoint.handleOps(ops, payable(msg.sender));

        console.log("paymaster deposit balance", entryPoint.balanceOf(address(paymaster)));
    }
}
