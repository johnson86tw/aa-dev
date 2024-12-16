// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

contract Counter {
    uint256 public number;

    event NumberSet(uint256 newNumber);
    event NumberIncremented();

    function setNumber(uint256 newNumber) public {
        number = newNumber;
        emit NumberSet(newNumber);
    }

    function increment() public {
        number++;
        emit NumberIncremented();
    }
}
