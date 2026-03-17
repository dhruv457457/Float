'use client'

import { useVaults, useVaultState, useVaultHistory } from '@yo-protocol/react'
import { formatUnits } from 'viem'
import { useState } from 'react'

const VAULT_IDS = ['yoUSD', 'yoETH', 'yoBTC'] as const

export function VaultDashboard() {
  const { vaults, isLoading } = useVaults()
  const [selectedVault, setSelectedVault] = useState<typeof VAULT_IDS[number]>('yoUSD')
  const { vaultState } = useVaultState(selectedVault)
  const { yieldHistory, tvlHistory, isLoading: historyLoading } = useVaultHistory(selectedVault)

  if (isLoading) {
    return (
      <div className="neu-card p-6 flex items-center justify-center h-48">
        <span className="font-display text-sm text-black/40 uppercase animate-pulse">Loading vaults...</span>
      </div>
    )
  }

  const maxApy = yieldHistory.length > 0
    ? Math.max(...yieldHistory.slice(-30).map(p => p.value))
    : 10

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {VAULT_IDS.map(id => (
          <button
            key={id}
            onClick={() => setSelectedVault(id)}
            className={`neu-tag cursor-pointer transition-all ${
              selectedVault === id
                ? 'bg-acid shadow-neu-sm translate-x-0 translate-y-0'
                : 'bg-white hover:bg-cream'
            }`}
          >
            {id}
          </button>
        ))}
      </div>

      <div className="neu-card p-5">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="font-display font-bold text-lg">{vaultState?.name ?? selectedVault}</p>
            <p className="font-body text-sm text-black/50">
              {vaultState ? `${formatUnits(vaultState.totalAssets, vaultState.assetDecimals)} total assets` : '—'}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-xs text-black/40 uppercase">Exchange rate</p>
            <p className="font-display font-bold">
              {vaultState ? Number(vaultState.exchangeRate).toFixed(6) : '—'}
            </p>
          </div>
        </div>

        <div>
          <p className="font-display text-xs text-black/40 uppercase mb-2">APY (30d)</p>
          {historyLoading ? (
            <div className="h-20 flex items-center justify-center">
              <span className="font-display text-xs text-black/30 animate-pulse">Loading chart...</span>
            </div>
          ) : (
            <div className="flex items-end gap-[2px] h-20">
              {yieldHistory.slice(-30).map((point, i) => {
                const height = maxApy > 0 ? (point.value / maxApy) * 100 : 0
                return (
                  <div
                    key={i}
                    className="flex-1 bg-acid border border-black/20 rounded-t-sm transition-all hover:bg-acid-dark relative group"
                    style={{ height: `${Math.max(4, height)}%` }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 neu-tag bg-black text-white text-[9px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      {point.value.toFixed(2)}%
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {yieldHistory.length > 0 && (
            <div className="flex justify-between mt-1">
              <span className="font-display text-[10px] text-black/30">30d ago</span>
              <span className="font-display text-[10px] text-black/30">Today</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}