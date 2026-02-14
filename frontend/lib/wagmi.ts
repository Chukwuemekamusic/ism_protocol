/**
 * Wagmi configuration for ISM Protocol
 */

import { http } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

// Get WalletConnect project ID from environment
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

if (!projectId) {
  console.warn(
    'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. Get one at https://cloud.walletconnect.com'
  );
}

// Configure wagmi with RainbowKit defaults
export const config = getDefaultConfig({
  appName: 'ISM Protocol',
  projectId,
  chains: [baseSepolia, base],
  transports: {
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC),
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_MAINNET_RPC),
  },
  ssr: true, // Enable server-side rendering support
});
