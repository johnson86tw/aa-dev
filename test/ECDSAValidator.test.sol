// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import "forge-std/Test.sol";

contract ECDSAValidatorTest is Test {
    function setUp() public {}

    function test_should_not_install_with_zero_address() public {
        // TODO: 目前 data 如果用 abi.encode 會導致安裝 zero address，而 uninstall 又有檢查不能是 zero address，導致 module 不能用又無法移除！
    }
}
