// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import "./utils/AATest.sol";
import "./utils/Wallet.sol";
import "../src/VoidAccount.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";

/**
 * forge test -vv --mp test/VoidAccount.t.sol --ffi
 */
contract VoidAccountTest is AATest {
    using WalletLib for Wallet;

    address account = address(new VoidAccount());

    function testExecuteUserOp() public {
        Wallet memory recipient = WalletLib.createRandomWallet(vm);

        entryPoint.depositTo{value: 1 ether}(account);
        deal(account, 1 ether);

        // Transfer 1 ether from account to recipient
        PackedUserOperation memory userOp = createUserOp();
        userOp.sender = account;
        userOp.callData = abi.encodeCall(VoidAccount.execute, (recipient.addr(), 1 ether, bytes("")));

        PackedUserOperation[] memory userOps = new PackedUserOperation[](1);
        userOps[0] = userOp;

        entryPoint.handleOps(userOps, payable(msg.sender));

        assertEq(recipient.balance(), 1 ether);
    }
}
