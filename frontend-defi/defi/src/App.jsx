import "tailwindcss"
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useWriteContract } from "wagmi";
import { useChainId } from "wagmi";
import { wagmiConfig } from "./lib/wagmi.js";
import { MockETH_ABI, MockETH_Address } from './lib/MockETH.js';
import { MockUSDC_ABI, MockUSDC_Address } from "./lib/MockUSDC.js";
import {Lending_ABI, Lending_Address }  from "./lib/LendingProtocol.js";
import { useReadContract } from 'wagmi';
import { polygonAmoy } from "viem/chains";
import { formatUnits, parseUnits } from 'viem';
import { useState } from "react";
import { MaxUint256 } from "ethers";

function App() {

  const account = useAccount({
    wagmiConfig,
  });
  
  const [depositAmount, setDepositAmount] = useState(''); 

  const [borrowAmount, setBorrowAmount] = useState('');

  const [targetUser, setTargetUser] = useState('');

  const [repayAmount, setRepayAmount] = useState('');

  const chainId = useChainId({
    wagmiConfig,
  });

  const { data: accountSummary, refetch: refetchSummary, } = useReadContract({
  abi: Lending_ABI,
  address: Lending_Address,
  functionName: 'getAccountSummary',
  args: [account.address],
  chainId: polygonAmoy.id,
  query: { enabled: !!account.address }
});

  const { data: usdcBalance } = useReadContract({
  abi: MockUSDC_ABI,
  address: MockUSDC_Address.MockUSDC,
  functionName: "balanceOf",
  args: [account.address],
  chainId: polygonAmoy.id,
  query: { enabled: !!account.address }
});

const { data: ethBalance } = useReadContract({
  abi: MockETH_ABI,
  address: MockETH_Address,
  functionName: "balanceOf",
  args: [account.address],
  chainId: polygonAmoy.id,
  query: { enabled: !!account.address }
});

const {data: healthFactor } = useReadContract({
  abi: Lending_ABI,
  address: Lending_Address,
  functionName: 'getAccountHealth',
  args: [account.address],
  chainId: polygonAmoy.id,
  query: { enabled: !!account.address},
});

const { writeContract} = useWriteContract();

const handleDeposit = async () => {
  const parsedAmount = parseUnits(depositAmount, 18);

try{
  await writeContract({
  abi: MockETH_ABI,
  address: MockETH_Address.MockETH,
  functionName: 'approve',
  args: [Lending_Address, parsedAmount],
});

await writeContract({
  abi: Lending_ABI,
  address: Lending_Address,
  functionName: 'depositCollateral',
  args: [parsedAmount],
  });

  refetchSummary?.();
    setDepositAmount('');
  } catch (err) {
    console.error("Deposit failed:", err);
  }
};

const handleBorrow = async () => {
  try {
    const parsedAmount = parseUnits(borrowAmount, 18);

    await writeContract({
      abi: Lending_ABI,
      address:Lending_Address,
      functionName: 'borrow',
      args: [parsedAmount],
    });

    refetchSummary?.();
    setBorrowAmount('');
  } catch (err) {
    console.error("Borrow failed", err);
  }
};

const handleLiquidate = async () => {
  try {
    const parsedAmount = parseUnits(repayAmount, 18);

    await writeContract({
      abi: MockUSDC_ABI,
      address: MockUSDC_Address.MockUSDC,
      functionName: 'approve',
      args: [Lending_Address, parsedAmount],
    });
    
    await writeContract ({
      abi: Lending_ABI,
      address: Lending_Address,
      functionName: 'liquidate',
      args: [targetUser, parsedAmount],
    });
     refetchSummary?.();
      setRepayAmount('');
      setTargetUser('');
  } catch (err) {
    console.error("Liquidation failed:", err);
  }
};

  return (
    <div className="app-wrapper">
      <div className="top-bar">
        <ConnectButton />
      </div>
      <div className="overview">
        <h3>Wallet Overview</h3>
        <p>Address: {account.address} </p>
        <p>Chain: {chainId}</p>
        <p>mETH: {ethBalance?.data ? formatUnits(ethBalance.data, 18) : "0"}</p>
        <p>mUSDC: {usdcBalance?.data ? formatUnits(usdcBalance.data, 6) : "0"}</p>
      </div>
      <h1>DeFi Lending App</h1>
      <div className="main-content">
        <p>Collateral: {accountSummary ? formatUnits(accountSummary[0], 18) : "..."}</p>
        <p>Debt: {accountSummary ? formatUnits(accountSummary[1], 18) : "..."}</p>
        <p>Borrowable: {accountSummary ? formatUnits(accountSummary[2], 18) : "..."}</p>
        <p>
          Health Factor:{" "}
          {healthFactor
            ? healthFactor.toString() === MaxUint256.toString()
              ? "∞"
              : formatUnits(healthFactor, 2)
            : "..."}
        </p>
        <div className="mt-4 flex flex-col items-center">
            <input
              type="number"
              placeholder="Amount to deposit"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="mb-2 px-2 py-1 border rounded"
            />
            <button
              onClick={handleDeposit}
              disabled={!depositAmount}
              className="bg-pink-400 text-white px-4 py-1 rounded hover:bg-pink-600 disabled:opacity-50"
            >
              Deposit mETH
            </button>
      </div>
      <div className="mt-4 flex flex-col items-center">
          <input
            type="number"
            placeholder="Amount to borrow"
            value={borrowAmount}
            onChange={(e) => setBorrowAmount(e.target.value)}
            className="mb-2 px-2 py-1 border rounded"
          />
          <button
            onClick={handleBorrow}
            className="bg-purple-400 text-white px-4 py-1 rounded hover:bg-purple-600"
          >
            Borrow mUSDC
          </button>
      </div>
      <div className="mt-4 flex flex-col items-center">
          <input
            type="text"
            placeholder="User address to liquidate"
            value={targetUser}
            onChange={(e) => setTargetUser(e.target.value)}
            className="mb-2 px-2 py-1 border rounded w-80"
          />
          <input
            type="number"
            placeholder="Amount to repay"
            value={repayAmount}
            onChange={(e) => setRepayAmount(e.target.value)}
            className="mb-2 px-2 py-1 border rounded"
          />
          <button
            onClick={handleLiquidate}
            className="bg-red-500 text-white px-4 py-1 rounded hover:bg-red-700"
          >
            Liquidate
          </button>
      </div>
      </div>
    </div>
  );
}

export default App;