// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

error InsufficientLiquidity();
error InsufficientNativeLiquidity();
error TransferFailed();

contract XCupSwapRouter {
    IERC20 public immutable targetToken;

    constructor(address _targetToken) {
        targetToken = IERC20(_targetToken);
    }

    function swapNativeForExactTokens(uint256 amountOut) external payable {
        if (targetToken.balanceOf(address(this)) < amountOut) {
            revert InsufficientLiquidity();
        }

        bool success = targetToken.transfer(msg.sender, amountOut);
        if (!success) {
            revert TransferFailed();
        }
    }

    function swapTokensForNative(uint256 amountIn) external {
        uint256 amountOut = amountIn;

        if (address(this).balance < amountOut) {
            revert InsufficientNativeLiquidity();
        }

        bool received = targetToken.transferFrom(msg.sender, address(this), amountIn);
        if (!received) {
            revert TransferFailed();
        }

        (bool sent, ) = payable(msg.sender).call{value: amountOut}("");
        if (!sent) {
            revert TransferFailed();
        }
    }

    receive() external payable {}
}
