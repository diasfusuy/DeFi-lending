// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

interface IMintableERC20 is IERC20 {
        function mint(address to, uint256 amount) external;
    } 

// Future Improvement 
// Currently, the same token (MockUSDC) is used for both collateral and debt.
// In a real-world DeFi lending protocol, these should be separate assets.
// - collateralToken: e.g., ETH, WBTC
// - debtToken: e.g., USDC, DAI (minted via IMintableERC20)
// Will be refactor in a later sprint to separate these concerns for better realism, extensibility, and security.

contract LendingProtocol {
    using SafeERC20 for IERC20; 

    uint256 constant COLLATERAL_RATIO = 150;
    uint256 public constant STALE_PRICE_TOLERANCE = 30 minutes;
    uint256 public constant LIQUIDATION_THRESHOLD = 120;
    uint8 public oracleDecimals;

    event CollateralDeposited(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 borrowedAmount);
    event Liquidated(address indexed user, address indexed liquidator, uint256 repayAmount, uint256 rewardAmount);

    IMintableERC20 public mUsdcMintable;
    IERC20 public mUsdc;
    mapping (address => uint256) public balanceOf;
    mapping(address => uint256) public debtOf;
    AggregatorV3Interface public priceFeed;


    constructor(address usdcAddress, address _priceFeed) {
        mUsdc = IERC20(usdcAddress);
        mUsdcMintable = IMintableERC20(usdcAddress);
        priceFeed = AggregatorV3Interface(_priceFeed);
        oracleDecimals = priceFeed.decimals();
    }

    function depositCollateral(uint256 amount) external {
        require(amount > 0, "Amount must be more than 0");
        mUsdc.safeTransferFrom(msg.sender, address(this), amount); 
        
        balanceOf[msg.sender] += amount;
        emit CollateralDeposited(msg.sender, amount);
    }

   function borrow(uint256 borrowedAmount) external {
        uint256 collateral = balanceOf[msg.sender];
        // replace old logic with the live price
        // uint256 requiredCollateral = borrowedAmount * COLLATERAL_RATIO / 100;
        // require(collateral >= requiredCollateral, "Less than required");
        uint256 price = getLatestPrice();
        uint256 collateralValueUSD = (collateral * price) / (10 ** oracleDecimals);
        uint256 requiredCollateralUSD = borrowedAmount * COLLATERAL_RATIO / 100;

        require(collateralValueUSD >= requiredCollateralUSD, "Less than required");


        debtOf[msg.sender] += borrowedAmount;
        mUsdcMintable.mint(msg.sender, borrowedAmount);

        emit Borrowed(msg.sender, borrowedAmount);        
    }

    function getBorrowableAmount(address user) public view returns (uint256){
        uint256 collateral = balanceOf[user];
        uint256 price = getLatestPrice();
        uint256 collateralValueUSD = (collateral * price) / (10 ** oracleDecimals);
        uint256 borrowable = collateralValueUSD * 100 / COLLATERAL_RATIO;
        
        require(price > 0, "price needs to be positive");

        return borrowable;
    }

    function getAccountHealth(address user) public view returns(uint256) {
        uint256 collateral = balanceOf[user];
        uint256 debt = debtOf[user];

        if ( debt == 0) {
           return type(uint256).max;
        } 
        return collateral * 100 / debt;        
    }

    // Fetches latest price
    function getLatestPrice() public view returns (uint256) {
        (, int256 price, , uint256 updatedAt ,) = priceFeed.latestRoundData();
        require(updatedAt >= block.timestamp - STALE_PRICE_TOLERANCE, "Stale price feed");
        return uint256(price);
    }

    // return summary object for a given user
    function getAccountSummary(address user) public view returns(uint256, uint256, uint256) {
        uint256 collateral = balanceOf[user];
        uint256 debt = debtOf[user];
        uint256 amountBorrowed = getBorrowableAmount(user);

        return (collateral, debt, amountBorrowed);
    }

    function liquidate(address user, uint256 repayAmount) external {
        require(repayAmount <= debtOf[user], "Repay amount exceeed debt");
        require(isLiquidatable(user), "Account is not liquidatable");

        // Transfer USDC from liquidator to contract
        mUsdc.safeTransferFrom(msg.sender, address(this), repayAmount);

        // Burn user debt
        debtOf[user] -= repayAmount;

        // Calculate collateral reward 
        uint256 reward = repayAmount * 105 / 100;
        require(balanceOf[user] >= reward, "Insufficent collateral");

        // Transfer collateral reward to liquidator
        balanceOf[user] -= reward;
        mUsdc.safeTransfer(msg.sender, reward);

        emit Liquidated(user, msg.sender, repayAmount, reward);
    }

    function isLiquidatable(address user) public view returns (bool) {
        uint256 health = getAccountHealth(user);
        return health < LIQUIDATION_THRESHOLD;
    }
}