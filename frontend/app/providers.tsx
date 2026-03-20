'use client';

import '@rainbow-me/rainbowkit/styles.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { config } from '@/lib/wagmi';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 240000, // 4min - data considered fresh (no refetch)
        gcTime: 5 * 60 * 1000, // 5min - cache retention time
        refetchOnWindowFocus: false,
        retry: (failureCount, error: any) => {
          // Don't retry on 429 rate limits to prevent amplification
          if (error?.message?.includes('429') || error?.message?.includes('Too many requests')) {
            return false;
          }
          // Only 1 retry for other errors
          return failureCount < 1;
        },
        retryDelay: (attemptIndex) => {
          // Exponential backoff: 1s, 2s, 4s, max 30s
          return Math.min(1000 * 2 ** attemptIndex, 30000);
        },
      },
    },
  }));

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#0E76FD',
            accentColorForeground: 'white',
            borderRadius: 'medium',
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
