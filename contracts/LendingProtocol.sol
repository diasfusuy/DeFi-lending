// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "hardhat/console.sol";

/**
 * @title IMintableERC20
 * @notice Minimal ERC20 interface extension used by the protocol to mint tokens.
 * @dev
 * The protocol treats the USDC mock and ETH mock as mintable ERC20s in test/dev environments.
 * In production, a protocol would typically not have mint permissions on real tokens.
 */
interface IMintableERC20 is IERC20 {
        function mint(address to, uint256 amount) external;
    } 

/**
 * @title LendingProtocol
 * @notice A simplified DeFi lending prototype that allows users to deposit mock ETH as collateral
 *         and borrow mock USDC against it, using a Chainlink-style price feed for valuation.
 *
 * @dev Key Concepts
 * - Collateral: mETH (mock ETH ERC20)
 * - Debt asset: mUSDC (mock USDC ERC20)
 * - Price oracle: Chainlink AggregatorV3Interface for ETH/USD price
 *
 * @dev Risk Parameters
 * - COLLATERAL_RATIO (150%): borrowing requires collateral value >= 150% of debt value (in USD terms).
 * - LIQUIDATION_THRESHOLD (120): if health factor falls below 120, account becomes liquidatable.
 * - STALE_PRICE_TOLERANCE (30 minutes): oracle price must be updated recently or actions revert.
 *
 * @dev Accounting Model
 * - balanceOf[user]: tracks deposited collateral amount (mETH)
 * - debtOf[user]: tracks borrowed amount (mUSDC)
 *
 * @dev Notes / Simplifications
 * - No repay function is implemented (liquidation reduces debt, but users cannot voluntarily repay).
 * - Liquidation reward is hardcoded (5% bonus via 105/100 multiplier).
 * - In real protocols, liquidation seizes collateral without transferring debt tokens into the protocol
 *   unless they are burned / accounted for; this prototype keeps it simple for learning/testing.
 */
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
    IMintableERC20 public mEthMintable;
    IERC20 public mUsdc;
    IERC20 public mEth;
    mapping (address => uint256) public balanceOf;
    mapping(address => uint256) public debtOf;
    AggregatorV3Interface public priceFeed;


/**
 * @notice Initializes the protocol with collateral token, debt token, and a price oracle.
 * @dev
 * - `usdcAddress` and `ethAddress` must be ERC20-compatible tokens.
 * - These same addresses are also cast into IMintableERC20 to allow minting in dev/testing.
 * - `oracleDecimals` is cached from the price feed at deployment.
 *
 * @param usdcAddress Address of the mock USDC ERC20 (mintable).
 * @param ethAddress Address of the mock ETH ERC20 used as collateral (mintable).
 * @param _priceFeed Address of the Chainlink AggregatorV3Interface (ETH/USD).
 */
    constructor(address usdcAddress, address ethAddress , address _priceFeed) {
        mUsdc = IERC20(usdcAddress);
        mUsdcMintable = IMintableERC20(usdcAddress);
        mEth = IERC20(ethAddress);
        mEthMintable = IMintableERC20(ethAddress);
        priceFeed = AggregatorV3Interface(_priceFeed);
        oracleDecimals = priceFeed.decimals();
    }

/**
 * @notice Deposits collateral (mETH) into the protocol.
 * @dev
 * Requirements:
 * - `amount` must be greater than zero.
 * - Caller must approve the protocol to spend at least `amount` of mETH beforehand.
 *
 * Effects:
 * - Transfers `amount` mETH from caller to the protocol.
 * - Increases `balanceOf[msg.sender]` by `amount`.
 * - Emits {CollateralDeposited}.
 *
 * @param amount Amount of collateral tokens (mETH) to deposit.
 */
    function depositCollateral(uint256 amount) external {
        require(amount > 0, "Amount must be more than 0");
        mEth.safeTransferFrom(msg.sender, address(this), amount); 
        
        balanceOf[msg.sender] += amount;
        emit CollateralDeposited(msg.sender, amount);
    }

/**
 * @notice Borrows mock USDC against deposited collateral.
 * @dev
 * Uses the latest oracle ETH/USD price to value collateral in USD terms.
 *
 * Requirements:
 * - Oracle price must not be stale (see {getLatestPrice}).
 * - Collateral value (USD) must be >= borrowedAmount * COLLATERAL_RATIO / 100.
 *
 * Effects:
 * - Increases `debtOf[msg.sender]` by `borrowedAmount`.
 * - Mints `borrowedAmount` of mock USDC to the borrower.
 * - Emits {Borrowed}.
 *
 * @param borrowedAmount Amount of mock USDC to borrow (protocol treats this as USD-denominated).
 */
   function borrow(uint256 borrowedAmount) external {
        uint256 collateral = balanceOf[msg.sender];
        // replace old logic with the live price
        // uint256 requiredCollateral = borrowedAmount * COLLATERAL_RATIO / 100;
        // require(collateral >= requiredCollateral, "Less than required");
        uint256 price = getLatestPrice();
        uint256 adjustedPrice = uint256(price) * 1e18 / (10 ** oracleDecimals);
        uint256 collateralValueUSD = (collateral * adjustedPrice) / 1e18;
        uint256 requiredCollateralUSD = borrowedAmount * COLLATERAL_RATIO / 100;

        require(collateralValueUSD >= requiredCollateralUSD, "Less than required");


        debtOf[msg.sender] += borrowedAmount;
        mUsdcMintable.mint(msg.sender, borrowedAmount);

        emit Borrowed(msg.sender, borrowedAmount);        
    }

/**
 * @notice Calculates the maximum borrowable amount of mock USDC for a user based on current collateral value.
 * @dev
 * - Reads collateral from `balanceOf[user]`.
 * - Uses oracle ETH/USD price (must not be stale).
 * - Applies COLLATERAL_RATIO to determine borrow capacity.
 *
 * Requirements:
 * - Oracle price must be positive.
 *
 * @param user Address of the account to evaluate.
 * @return borrowable Maximum borrowable amount (in mock USDC units) under current oracle price.
 */
    function getBorrowableAmount(address user) public view returns (uint256){
        uint256 collateral = balanceOf[user];
        uint256 price = getLatestPrice();
        uint256 adjustedPrice = uint256(price) * 1e18 / (10 ** oracleDecimals);
        uint256 collateralValueUSD = (collateral * adjustedPrice) / 1e18;
        uint256 borrowable = collateralValueUSD * 100 / COLLATERAL_RATIO;
        
        require(price > 0, "price needs to be positive");

        return borrowable;
    }

/**
 * @notice Returns a simplified "health factor" for a user's position.
 * @dev
 * Health is defined as: (collateralValueUSD * 100) / debt
 * - If debt is 0, returns type(uint256).max (treated as infinitely healthy).
 *
 * Oracle Handling:
 * - Pulls price directly from `latestRoundData()` and normalizes to 1e18.
 *
 * @param user Address of the account to evaluate.
 * @return health Health factor in percent-style units (e.g., 150 means 150% collateralization).
 */
    function getAccountHealth(address user) public view returns (uint256) {
    uint256 collateral = balanceOf[user];
    uint256 debt = debtOf[user];

    if (debt == 0) {
        return type(uint256).max;
    }

    (, int256 price,,,) = priceFeed.latestRoundData(); // ETH/USD
    uint8 decimals = priceFeed.decimals();
    uint256 adjustedPrice = uint256(price) * 1e18 / (10 ** decimals);

    uint256 collateralValueInUSD = collateral * adjustedPrice / 1e18;

    return collateralValueInUSD * 100 / debt;
    }

    /**
 * @notice Fetches the latest oracle price from the price feed.
 * @dev
 * Reverts if the price is stale based on STALE_PRICE_TOLERANCE.
 *
 * @return price Latest oracle answer as an unsigned integer (raw oracle decimals).
 */
    function getLatestPrice() public view returns (uint256) {
        (, int256 price, , uint256 updatedAt ,) = priceFeed.latestRoundData();
        require(updatedAt >= block.timestamp - STALE_PRICE_TOLERANCE, "Stale price feed");
        return uint256(price);
    }

    /**
 * @notice Returns a summary of a user's position: collateral, debt, and borrowable amount.
 * @dev
 * Borrowable amount is computed using {getBorrowableAmount}, which depends on the oracle price.
 *
 * @param user Address of the account to query.
 * @return collateral Amount of collateral deposited (mETH).
 * @return debt Amount of debt borrowed (mUSDC).
 * @return borrowable Maximum additional borrow capacity (in mUSDC) at current oracle price.
 */
    function getAccountSummary(address user) public view returns(uint256, uint256, uint256) {
        uint256 collateral = balanceOf[user];
        uint256 debt = debtOf[user];
        uint256 amountBorrowed = getBorrowableAmount(user);

        return (collateral, debt, amountBorrowed);
    }

/**
 * @notice Liquidates an undercollateralized account by repaying part (or all) of its debt and receiving collateral + bonus.
 * @dev
 * Liquidation Conditions:
 * - `repayAmount` must be <= user's current debt.
 * - User must be liquidatable according to {isLiquidatable}.
 *
 * Token Flow:
 * - Liquidator transfers `repayAmount` of mUSDC to the protocol (must approve first).
 * - User's debt is reduced by `repayAmount`.
 * - Liquidator receives collateral reward in mETH: `repayAmount * 105 / 100` (5% bonus).
 *
 * Requirements:
 * - Protocol must be able to seize at least `reward` collateral from the user’s recorded balance.
 *
 * Emits {Liquidated}.
 *
 * @param user Address of the borrower being liquidated.
 * @param repayAmount Amount of debt token (mUSDC) the liquidator repays on behalf of the borrower.
 */
    function liquidate(address user, uint256 repayAmount) external {
        require(repayAmount <= debtOf[user], "Repay amount exceeds user's debt");
        require(isLiquidatable(user), "Account is not liquidatable");

        // Transfer mETH from liquidator to contract
        mUsdc.safeTransferFrom(msg.sender, address(this), repayAmount);

        // Burn user debt
        debtOf[user] -= repayAmount;

        // Calculate collateral reward 
        uint256 reward = repayAmount * 105 / 100;
        console.log("User balance: %s", balanceOf[user]);
        console.log("Reward needed: %s", reward);

        require(balanceOf[user] >= reward, "Insufficent collateral to reward liquidator");

        // Transfer collateral reward to liquidator
        balanceOf[user] -= reward;
        mEth.safeTransfer(msg.sender, reward);

        emit Liquidated(user, msg.sender, repayAmount, reward);
    }

/**
 * @notice Checks whether an account is eligible for liquidation.
 * @dev
 * An account is liquidatable when its health factor returned by {getAccountHealth} is below LIQUIDATION_THRESHOLD.
 *
 * @param user Address of the borrower to check.
 * @return True if the account can be liquidated, false otherwise.
 */
    function isLiquidatable(address user) public view returns (bool) {
        uint256 health = getAccountHealth(user);
        return health < LIQUIDATION_THRESHOLD;
    }
}