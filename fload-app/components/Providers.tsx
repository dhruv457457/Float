'use client'

import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { YieldProvider } from '@yo-protocol/react'
import { config } from '@/lib/wagmi'
import '@rainbow-me/rainbowkit/styles.css'

const queryClient = new QueryClient()

const neuTheme = {
  colors: {
    accentColor: '#BFFF0A',
    accentColorForeground: '#1A1A1A',
    actionButtonBorder: '2.5px solid #1A1A1A',
    actionButtonBorderMobile: '2.5px solid #1A1A1A',
    closeButton: '#1A1A1A',
    closeButtonBackground: 'transparent',
    connectButtonBackground: '#BFFF0A',
    connectButtonBackgroundError: '#FF3CAC',
    connectButtonInnerBackground: '#FFFDF5',
    connectButtonText: '#1A1A1A',
    connectButtonTextError: '#FFFDF5',
    error: '#FF3CAC',
    generalBorder: '#1A1A1A',
    generalBorderDim: '#1A1A1A',
    menuItemBackground: '#BFFF0A',
    modalBackdrop: 'rgba(26, 26, 26, 0.6)',
    modalBackground: '#FFFDF5',
    modalBorder: '#1A1A1A',
    modalText: '#1A1A1A',
    modalTextDim: '#666',
    modalTextSecondary: '#999',
    profileAction: '#FFFDF5',
    profileActionHover: '#BFFF0A',
    profileForeground: '#FFFDF5',
    selectedOptionBorder: '#BFFF0A',
    standby: '#BFFF0A',
  },
  fonts: {
    body: 'DM Sans, sans-serif',
  },
  radii: {
    actionButton: '6px',
    connectButton: '6px',
    menuButton: '6px',
    modal: '8px',
    modalMobile: '8px',
  },
  shadows: {
    connectButton: '4px 4px 0px #1A1A1A',
    dialog: '6px 6px 0px #1A1A1A',
    profileDetailsAction: '2px 2px 0px #1A1A1A',
    selectedOption: '4px 4px 0px #1A1A1A',
    selectedWallet: '4px 4px 0px #1A1A1A',
    walletLogo: 'none',
  },
} as const

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={neuTheme as any}>
          <YieldProvider defaultSlippageBps={50}>
            {children}
          </YieldProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
