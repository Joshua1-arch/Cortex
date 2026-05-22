// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

error InsufficientLiquidity();
error InsufficientNativeLiquidity();
error TransferFailed();

contract XCupSwapRouter {
    IERC20 public immutable targetToken;
    uint256 public constant TOKEN_PER_NATIVE = 100_000;

    constructor(address _targetToken) {
        targetToken = IERC20(_targetToken);
    }

    function swapNativeForExactTokens(uint256 amountOut) external payable {
        uint256 quotedAmountOut = getNativeToTokenQuote(msg.value);

        if (amountOut != quotedAmountOut || targetToken.balanceOf(address(this)) < amountOut) {
            revert InsufficientLiquidity();
        }

        bool success = targetToken.transfer(msg.sender, amountOut);
        if (!success) {
            revert TransferFailed();
        }
    }

    function swapTokensForNative(uint256 amountIn) external {
        uint256 amountOut = getTokenToNativeQuote(amountIn);

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

    function getNativeToTokenQuote(uint256 amountIn) public pure returns (uint256) {
        return amountIn * TOKEN_PER_NATIVE;
    }

    function getTokenToNativeQuote(uint256 amountIn) public pure returns (uint256) {
        return amountIn / TOKEN_PER_NATIVE;
    }

    receive() external payable {}
}
