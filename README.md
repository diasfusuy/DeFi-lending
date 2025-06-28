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