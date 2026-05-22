// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract XCupFaucet {
    IERC20 public immutable xusdt;
    uint256 public immutable dripAmount = 1000 * 10 ** 18;
    uint256 public immutable cooldownTime = 1 days;
    mapping(address => uint256) public nextRequestAt;

    error CooldownActive();
    error InsufficientFaucetBalance();
    error TokenTransferFailed();

    constructor(address xusdt_) {
        xusdt = IERC20(xusdt_);
    }

    function requestTokens() external {
        if (block.timestamp < nextRequestAt[msg.sender]) {
            revert CooldownActive();
        }

        if (xusdt.balanceOf(address(this)) < dripAmount) {
            revert InsufficientFaucetBalance();
        }

        nextRequestAt[msg.sender] = block.timestamp + cooldownTime;

        bool success = xusdt.transfer(msg.sender, dripAmount);
        if (!success) {
            revert TokenTransferFailed();
        }
    }
}
