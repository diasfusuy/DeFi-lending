import "tailwindcss"
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from "wagmi";
import { useChainId } from "wagmi";
import { wagmiConfig } from "./lib/wagmi.js";
import { ERC20_ABI, TOKEN_ADDRESSES } from './lib/tokens';
import { useReadContract } from 'wagmi';
import { polygonAmoy } from "viem/chains";
import { formatUnits } from 'viem';

function App() {

  const account = useAccount({
    wagmiConfig,
  });
  
  const chainId = useChainId({
    wagmiConfig,
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


  return (
    <div className="app-wrapper">
      <div className="top-bar">
        <ConnectButton />
      </div>
      <div className="overview">
        <h3>Wallet Overview</h3>
        <p>Address: {account.address} </p>
        <p>Chain: {chainId}</p>
        {/* <p>mETH: {ethBalance?.data ? formatUnits(ethBalance.data, 18) : "0"}</p>
        <p>mUSDC: {usdcBalance?.data ? formatUnits(usdcBalance.data, 6) : "0"}</p> */}
      </div>

      <div className="main-content">
        <h1>DeFi Lending App</h1>
        {/* Later: deposit, borrow, health factor, etc. */}
      </div>
    </div>
  );
}

export default App;