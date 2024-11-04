// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.27;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import "./MyAccount.sol";

contract MyAccountFactory {
    MyAccount public immutable accountImplementation;

    constructor() {
        accountImplementation = new MyAccount();
    }

    /**
     * create an account, and return its address.
     * returns the address even if the account is already deployed.
     * Note that during UserOperation execution, this method is called only if the account is not deployed.
     * This method returns an existing account address so that entryPoint.getSenderAddress() would work even after account creation
     */
    function createAccount(uint256 salt, address validator, bytes calldata data) public returns (MyAccount ret) {
        address addr = getAddress(salt, validator, data);
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return MyAccount(payable(addr));
        }
        ret = MyAccount(
            payable(
                new ERC1967Proxy{salt: bytes32(salt)}(
                    address(accountImplementation), abi.encodeCall(MyAccount.initialize, (validator, data))
                )
            )
        );
    }

    /**
     * calculate the counterfactual address of this account as it would be returned by createAccount()
     */
    function getAddress(uint256 salt, address validator, bytes calldata data) public view returns (address) {
        return Create2.computeAddress(
            bytes32(salt),
            keccak256(
                abi.encodePacked(
                    type(ERC1967Proxy).creationCode,
                    abi.encode(address(accountImplementation), abi.encodeCall(MyAccount.initialize, (validator, data)))
                )
            )
        );
    }
}
