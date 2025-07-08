import { getDefaultWallets } from '@rainbow-me/rainbowkit';
import { http, createConfig } from 'wagmi'
import { createClient } from 'viem'

export const polygonAmoy = {
    id: 80002,
    name: 'Polygon Amoy',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://rpc-amoy.polygon.technology'] }
    },
    blockExplorers: {
        default: {
            name: 'PolygonScan',
            url: 'https://amoy.polygonscan.com',
            apiUrl: 'https://api-amoy.polygonscan.com/api',
        },
    },
    contracts: {
        multicall3: {
            address: '0xca11bde05977b3631167028862be2a173976ca11',
            blockCreated: 3127388,
        },
    },
    testnet: true,
}

const projectId = "15c9f5bc3ca67701fa7642d33e1f6ad5";

export const chains = [polygonAmoy];

const { connectors } = getDefaultWallets({
    appName: "Defi Lending App",
    projectId,
    chains,
});

export const wagmiConfig = createConfig({
  chains: chains, 
  transports: {
    [polygonAmoy.id]: http(), 
  },
  
  connectors: connectors,
  client({ chain }) {
    return createClient({ chain, transport: http() });
  },
});