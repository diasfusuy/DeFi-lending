// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


contract LendingProtocol {
    using SafeERC20 for IERC20;

    event CollateralDeposited(address indexed user, uint256 amount);

    IERC20 public mUsdc;
    mapping (address => uint256) public balanceOf;

    constructor(address usdcAddres) {
        mUsdc = IERC20(usdcAddres);
    }

    function depositColletoral(uint256 amount) external {
        require(amount > 0, "Amount must be more than 0");
        mUsdc.safeTransferFrom(msg.sender, address(this), amount); 
        
        balanceOf[msg.sender] += amount;
        emit CollateralDeposited(msg.sender, amount);
    }
}