# 🚀 Project Overview

This project is a **simplified DeFi lending and borrowing protocol**, inspired by platforms like **Aave** and **Compound**. It is being developed as a portfolio project to demonstrate core blockchain development skills. The project will follow a **4-week Agile structure**, with weekly goals and deliverables.

### 🧩 Core Features

- ✅ Deposit collateral (e.g., ETH, WETH, or USDC)
- ✅ Borrow stablecoins based on collateral value
- ✅ Repay loans with interest
- ✅ Trigger liquidation when collateral value drops below a safety threshold

### 🛠️ Tech Stack

- **Solidity** for smart contracts  
- **Hardhat** for testing and local development  
- **Polygon Amoy testnet** for deployment  
- **React + Wagmi + RainbowKit** for the frontend and wallet interactions

---

## 📆 Agile Timeline

| Week | Focus                                  |
|------|----------------------------------------|
| 1    | Smart contract: basic lending logic    |
| 2    | Liquidation + security improvements    |
| 3    | Frontend dApp with wallet integration  |
| 4    | Polish, write blog post, and deploy    |

## Agile Timeline Adjustments

- Liquidation logic was moved from Sprint 2 to Sprint 3 due to the depth of oracle integration and testing.
- Frontend and wallet connection were rescheduled to Sprint 4 to align with deployment goals.

## 🧠 Oracle Integration (Chainlink Price Feed)

To support real-time collateral valuation, this lending protocal project integrates Chainlink's decentralized oracle network using the AggregatorV3Interface.

### What I Use It For

I used Chainlink price feed to fetch the latest price of the collareral token (USDC) in USD. This ensures that collateral requirements are dynamic and reflect real-world prices. 

### How It’s Used

Chainlink oracle is used in the following places:

- getBorrowableAmount(address)
    Calculates how much user can borrow, based on the real-time USD value of their collateral.

- borrow(uint256)
    Enforces that the user has sufficent collateral value in USD using the current Chainlink price.

- getAccountSummary(address)
    Provide a view of users collateral, debt, and borrowable value using live prices. 

### 📉 Price Staleness Handling

To protect against stale or frozen price feed

require(updateAt >= block.timestamp - STALE_PRICE_TOLERANCE, "Stale price feed");

This rejects outdated oracle prices that could be used to manipulate the borrowing logic.

### Decimal Normalization

Chainlink pricee feeds may have different decimals than the ERC20 token. To normalize:

(collateral * price) / (10 ** oracleDecimals)

This ensures that both price and collateral have the same decimals before calculation. 

### ✅ Assumptions
- The oracle always returns price in USD.

- The collateral asset uses 18 decimals.

- The system is not resilient yet to Chainlink feed outages — fallback logic is deferred to a future sprint.

### 🧱 Token Architecture Refactor
To increase realism and extensibility, the protocol now uses two distinct tokens:

- Collateral Token: MockETH (deposited by users to secure loans)

- Debt Token: MockUSDC (minted when borrowing, repaid during liquidation)

This replaces the earlier version where a single token (MockUSDC) was used for both collateral and debt.

### 🔄 Key Changes
- depositCollateral() now accepts MockETH, not USDC.

- borrow() still mints USDC (debt token) to the user.

- liquidate() transfers USDC from the liquidator and rewards them in ETH.

- Chainlink price feed is used to price ETH in USD for collateral valuation.

### 📦 Why This Matters
- Mirrors real-world DeFi design 

- Prevents circular token logic

- Enables clearer security boundaries and future token support

## 💥 Liquidation Mechanism

To ensure solvency and protect lenders, the protocol supports liquidation of undercollateralized positions.

### When Liquidation Happens
If a user’s **collateral-to-debt ratio** drops below a safety threshold (e.g., health factor < 1), their position becomes **liquidatable**.

### 🛠️ How Liquidation Works
- Anyone can call the liquidate(address user, uint256 repayAmount) function.

- The liquidator pays back part (or all) of the debt on behalf of the borrower.

- In return, the liquidator receives a proportional amount of the borrower’s collateral (e.g., mETH).

- This acts as an incentive to keep the system solvent and reduce protocol risk.

### 🌐 Live Demo
- 🔗 https://de-fi-lending.vercel.app

You can interact with the deployed frontend here.
Make sure your wallet is connected to the Polygon Amoy testnet and has test mETH and mUSDC.

### 🤔 Known Issues / Tradeoffs
Health factor is calculated but may not always update instantly due to frontend sync delays.

Chainlink price may return slightly outdated data on the Amoy testnet.

Not battle-tested for production — this is a proof-of-concept.