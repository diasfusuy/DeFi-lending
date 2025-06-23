// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

interface IMintableERC20 is IERC20 {
        function mint(address to, uint256 amount) external;
    } 

contract LendingProtocol {
    using SafeERC20 for IERC20; 

    // Will be replaced with dynamic collateral valuation via Chainlink oracle
    uint256 constant COLLATERAL_RATIO = 150;

    event CollateralDeposited(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 borrowedAmount);

    IMintableERC20 public mUsdcMintable;
    IERC20 public mUsdc;
    mapping (address => uint256) public balanceOf;
    mapping(address => uint256) public debtOf;
    AggregatorV3Interface public priceFeed;


    constructor(address usdcAddress, address _priceFeed) {
        mUsdc = IERC20(usdcAddress);
        mUsdcMintable = IMintableERC20(usdcAddress);
        priceFeed = AggregatorV3Interface(_priceFeed);
    }

    function depositCollateral(uint256 amount) external {
        require(amount > 0, "Amount must be more than 0");
        mUsdc.safeTransferFrom(msg.sender, address(this), amount); 
        
        balanceOf[msg.sender] += amount;
        emit CollateralDeposited(msg.sender, amount);
    }

   function borrow(uint256 borrowedAmount) external {
        uint256 collateral = balanceOf[msg.sender];
        uint256 requiredCollateral = borrowedAmount * COLLATERAL_RATIO / 100;
        require(collateral >= requiredCollateral, "Less than required");

        debtOf[msg.sender] += borrowedAmount;
        mUsdcMintable.mint(msg.sender, borrowedAmount);

        emit Borrowed(msg.sender, borrowedAmount);        
    }

    function getBorrowableAmount(address user) public view returns (uint256){
        uint256 collateral = balanceOf[user];
        return collateral * 100 / COLLATERAL_RATIO;
    }

    function getAccountHealth(address user) public view returns(uint256) {
        uint256 collateral = balanceOf[user];
        uint256 debt = debtOf[user];

        if ( debt == 0) {
           return type(uint256).max;
        } 
        return collateral * 100 / debt;        
    }

    function getLatestPrice() public view return (uint256) {
        (, int256 price, , ,) = priceFeed.latestRoundData();
        return uint256(price);
    }
}