'use client'

import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useEffect, useState, useCallback } from 'react'
import { IntentInput } from '@/components/IntentInput'
import { FloatCard } from '@/components/FloatCard'
import { VaultDashboard } from '@/components/VaultDashboard'
import { YieldComparison } from '@/components/YieldComparison'
import { RiskPanel } from '@/components/RiskPanel'
import { MilestoneToasts } from '@/components/MilestoneToasts'
import { SavingsReceipt } from '@/components/SavingsReceipt'
import { PortfolioSummary } from '@/components/PortfolioSummary'
import { getFloats, checkMilestones, type FloatEntry } from '@/lib/schedule'

type Tab = 'float' | 'vaults' | 'risk'

export default function Dashboard() {
  const { isConnected } = useAccount()
  const [floats, setFloats] = useState<FloatEntry[]>([])
  const [tab, setTab] = useState<Tab>('float')
  const avgApy = 3.2

  const refreshFloats = useCallback(() => {
    const active = getFloats().filter(f => f.status === 'active')
    setFloats(active)
    checkMilestones(active, avgApy)
  }, [avgApy])

  useEffect(() => {
    refreshFloats()
    const interval = setInterval(refreshFloats, 15000)
    return () => clearInterval(interval)
  }, [refreshFloats])

  if (!isConnected) return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-8 px-6">
      {/* Disconnected state */}
      <div className="neu-card p-10 max-w-md w-full text-center flex flex-col items-center gap-6">
        <div className="w-20 h-20 bg-acid border-neu border-black rounded-lg flex items-center justify-center shadow-neu">
          <span className="font-display text-3xl font-bold">F.</span>
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight">FLOAT</h1>
        <p className="font-body text-black/60 leading-relaxed">
          Yield on money you were going to spend anyway.
          Connect your wallet to start earning.
        </p>
        <ConnectButton />
      </div>
      <div className="flex gap-2">
        {['Non-custodial', 'Base chain', 'YO Protocol'].map(t => (
          <span key={t} className="neu-tag bg-cream">{t}</span>
        ))}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-cream border-b-neu border-black">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-display text-xl font-bold tracking-tight">
            FLOAT<span className="text-acid-dark">.</span>
          </div>
          <ConnectButton accountStatus="avatar" showBalance={false} />
        </div>
      </header>

      {/* Tab nav */}
      <nav className="max-w-lg mx-auto px-4 pt-4">
        <div className="flex gap-2">
          {([
            { id: 'float' as Tab, label: 'FLOAT' },
            { id: 'vaults' as Tab, label: 'VAULTS' },
            { id: 'risk' as Tab, label: 'RISK' },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`neu-tag cursor-pointer transition-all ${
                tab === t.id
                  ? 'bg-black text-white shadow-none'
                  : 'bg-white hover:bg-cream'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-6">

        {tab === 'float' && (
          <>
            {/* Portfolio summary */}
            <PortfolioSummary floats={floats} avgApy={avgApy} />

            {/* Intent input */}
            <IntentInput onFloatCreated={refreshFloats} />

            {/* Active floats */}
            {floats.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="font-display text-xs font-bold uppercase tracking-wider text-black/40">
                    Active floats ({floats.length})
                  </p>
                </div>
                {floats.map(f => <FloatCard key={f.id} float={f} apy={avgApy} />)}
              </div>
            )}

            {/* Yield comparison */}
            <YieldComparison floatApy={avgApy} />

            {/* Savings receipt */}
            <SavingsReceipt avgApy={avgApy} />
          </>
        )}

        {tab === 'vaults' && (
          <VaultDashboard />
        )}

        {tab === 'risk' && (
          <RiskPanel />
        )}

        {/* Footer */}
        <footer className="text-center py-6 border-t-2 border-dashed border-black/10">
          <p className="font-display text-xs text-black/30">
            FLOAT • Built on{' '}
            <a href="https://yo.xyz" target="_blank" rel="noopener" className="underline">YO Protocol</a>
            {' '}• Base Chain
          </p>
        </footer>
      </main>

      {/* Milestone toasts */}
      <MilestoneToasts />
    </div>
  )
}
