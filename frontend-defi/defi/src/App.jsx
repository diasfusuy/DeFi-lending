import "tailwindcss"
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useWriteContract } from "wagmi";
import { useChainId } from "wagmi";
import { wagmiConfig } from "./lib/wagmi.js";
import { ERC20_ABI, TOKEN_ADDRESSES } from './lib/tokens';
import {Lending_ABI, Lending_Address }  from "./lib/LendingProtocol.js";
import { useReadContract } from 'wagmi';
import { polygonAmoy } from "viem/chains";
import { formatUnits, parseUnits } from 'viem';
import { writeContract } from "viem/actions";
import { useState } from "react";

function App() {

  const account = useAccount({
    wagmiConfig,
  });
  
  const [depositAmount, setDepositAmount] = useState(''); 

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
  abi: ERC20_ABI,
  address: TOKEN_ADDRESSES.MockUSDC,
  functionName: "balanceOf",
  args: [account.address],
  chainId: polygonAmoy.id,
  query: { enabled: !!account.address }
});

const { data: ethBalance } = useReadContract({
  abi: ERC20_ABI,
  address: TOKEN_ADDRESSES.MockETH.address,
  functionName: "balanceOf",
  args: [account.address],
  chainId: polygonAmoy.id,
  query: { enabled: !!account.address }
});

const { writeContractAsync } = useWriteContract();

const handleDeposit = async () => {
  const parsedAmount = parseUnits(depositAmount, 18);

try{
  await writeContractAsync({
  abi: ERC20_ABI,
  address:TOKEN_ADDRESSES.MockETH,
  functionName: 'approve',
  args: [Lending_Address, parsedAmount],
});

await writeContractAsync({
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

      <div className="main-content">
        <h1>DeFi Lending App</h1>
        <p>Collateral: {accountSummary ? formatUnits(accountSummary[0], 18) : "..."}</p>
        <p>Debt: {accountSummary ? formatUnits(accountSummary[1], 18) : "..."}</p>
        <p>Borrowable: {accountSummary ? formatUnits(accountSummary[2], 18) : "..."}</p>
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
      </div>
    </div>
  );
}

export default App;