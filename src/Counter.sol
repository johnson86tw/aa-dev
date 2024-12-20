// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

/*

forge create --rpc-url $sepolia --account dev \
./src/Counter.sol:Counter --broadcast --verify

*/

contract Counter {
    uint256 public number;

    event NumberSet(address indexed caller, uint256 newNumber);
    event NumberIncremented(address indexed caller);

    function setNumber(uint256 newNumber) public {
        number = newNumber;
        emit NumberSet(msg.sender, newNumber);
    }

    function increment() public {
        number++;
        emit NumberIncremented(msg.sender);
    }
}
