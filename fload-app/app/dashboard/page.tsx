'use client'

import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useEffect, useState, useCallback } from 'react'
import { IntentInput } from '@/components/IntentInput'
import { FloatCard } from '@/components/FloatCard'
import { VaultDashboard } from '@/components/VaultDashboard'
import { VaultComparisonTable } from '@/components/VaultComparisonTable'
import { YieldComparison } from '@/components/YieldComparison'
import { RiskPanel } from '@/components/RiskPanel'
import { RebalancerPanel } from '@/components/RebalancerPanel'
import { GasGatePanel } from '@/components/GasGate'
import { AICoach } from '@/components/AICoach'
import { YieldForecast } from '@/components/YieldForecast'
import { PortfolioIntel } from '@/components/PortfolioIntel'
import { ZapInput } from '@/components/ZapInput'
import { OnChainPositions } from '@/components/OnChainPositions'
import { OptimizerPanel } from '@/components/OptimizerPanel'
import { MilestoneToasts } from '@/components/MilestoneToasts'
import { ContractsBanner } from '@/components/ContractsBanner'
import { SavingsReceipt } from '@/components/SavingsReceipt'
import { getFloats, checkMilestones, type FloatEntry } from '@/lib/schedule'
import { BASESCAN, FLOAT_ZAP_ADDRESS, FLOAT_OPTIMIZER_ADDRESS } from '@/lib/contracts'
import { differenceInDays } from 'date-fns'

type Tab = 'float' | 'zap' | 'optimizer' | 'vaults' | 'intelligence' | 'risk'

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'float', label: 'Float', emoji: '💸' },
  { id: 'zap', label: 'Zap', emoji: '⚡' },
  { id: 'optimizer', label: 'Optimizer', emoji: '🔮' },
  { id: 'vaults', label: 'Vaults', emoji: '📊' },
  { id: 'intelligence', label: 'AI', emoji: '🧠' },
  { id: 'risk', label: 'Risk', emoji: '🛡' },
]

export default function Dashboard() {
  const { isConnected } = useAccount()
  const [floats, setFloats] = useState<FloatEntry[]>([])
  const [tab, setTab] = useState<Tab>('float')
  const [intelTab, setIntelTab] = useState<'rebalancer' | 'gas' | 'coach' | 'forecast' | 'intel'>('intel')
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

  const totalDeposited = floats.reduce((s, f) => s + f.depositedAmount, 0)
  const now = new Date()
  const totalYield = floats.reduce((s, f) => {
    const days = differenceInDays(now, new Date(f.depositedAt))
    return s + (avgApy / 100 / 365) * days * f.depositedAmount
  }, 0)
  const nextFloat = floats
    .sort((a, b) => new Date(a.neededAt).getTime() - new Date(b.neededAt).getTime())[0]
  const nextDays = nextFloat ? differenceInDays(new Date(nextFloat.neededAt), now) : null

  if (!isConnected) return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-8 px-6">
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
      <header className="sticky top-0 z-40 bg-cream/95 backdrop-blur-sm border-b-2 border-black/10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-display text-xl font-bold tracking-tight">
              FLOAT<span className="text-acid-dark">.</span>
            </span>
            <div className="hidden md:flex gap-1">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-4 py-1.5 rounded-full font-body text-sm transition-all ${tab === t.id
                      ? 'bg-black text-white'
                      : 'text-black/50 hover:text-black hover:bg-black/5'
                    }`}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>
          <ConnectButton accountStatus="avatar" showBalance={false} />
        </div>
      </header>

      <ContractsBanner />

      {/* Mobile tab nav */}
      <nav className="md:hidden px-4 pt-3">
        <div className="flex gap-1 bg-black/5 p-1 rounded-lg">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-md font-body text-xs transition-all ${tab === t.id
                  ? 'bg-white shadow-sm text-black font-medium'
                  : 'text-black/40'
                }`}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* ─── FLOAT TAB ─── */}
        {tab === 'float' && (
          <div className="flex flex-col gap-10 animate-float-in">
            {floats.length > 0 && (
              <div className="flex items-baseline gap-10 flex-wrap">
                <div>
                  <p className="font-body text-xs text-black/40 uppercase tracking-wider">Floating</p>
                  <p className="font-display text-4xl font-bold">${totalDeposited.toFixed(0)}</p>
                </div>
                <div>
                  <p className="font-body text-xs text-acid-dark uppercase tracking-wider">Earned</p>
                  <p className="font-display text-4xl font-bold text-acid-dark">+${totalYield.toFixed(4)}</p>
                </div>
                <div>
                  <p className="font-body text-xs text-black/40 uppercase tracking-wider">Next ready</p>
                  <p className="font-display text-4xl font-bold">{nextDays !== null ? `${nextDays}d` : '—'}</p>
                </div>
                <div className="ml-auto hidden lg:block">
                  <SavingsReceipt avgApy={avgApy} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              {/* Left */}
              <div className="lg:col-span-3 flex flex-col gap-6">
                <IntentInput onFloatCreated={refreshFloats} />
                {floats.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <p className="font-body text-sm font-medium text-black/40">Active floats</p>
                      <span className="font-display text-xs text-black/30">{floats.length}</span>
                    </div>
                    {floats.map(f => <FloatCard key={f.id} float={f} apy={avgApy} onRedeemed={refreshFloats} />)}
                  </div>
                )}

                {/* On-chain optimizer positions with redeem */}
                <OnChainPositions />

                {/* On-chain optimizer positions */}
                <OnChainPositions />

                {/* On-chain optimizer positions from FloatOptimizer contract */}
                <OnChainPositions />
              </div>

              {/* Right */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                <YieldComparison floatApy={avgApy} />

                <div className="border-2 border-black/10 rounded-lg p-5 bg-white">
                  <p className="font-body text-sm font-medium text-black/40 mb-3">Live vault rates</p>
                  <div className="flex flex-col gap-2">
                    {[
                      { name: 'yoUSD', apy: '3.18' },
                      { name: 'yoETH', apy: '5.42' },
                      { name: 'yoBTC', apy: '1.92' },
                    ].map(v => (
                      <div key={v.name} className="flex items-center justify-between py-1">
                        <span className="font-display text-xs font-bold">{v.name.toUpperCase()}</span>
                        <span className="font-body text-sm text-black/60">{v.apy}% APY</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setTab('vaults')}
                    className="w-full mt-3 py-2 text-center font-body text-xs text-black/40 hover:text-black border-t border-black/10 transition-colors"
                  >
                    View full vault dashboard →
                  </button>
                </div>

                <div className="lg:hidden">
                  <SavingsReceipt avgApy={avgApy} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── ZAP TAB ─── */}
        {tab === 'zap' && (
          <div className="animate-float-in max-w-xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-display text-2xl font-bold">Zap In</h2>
                <p className="font-body text-sm text-black/50 mt-1">
                  Deposit ETH, USDC, or cbBTC — auto-swapped via Uniswap V3 in one tx
                </p>
              </div>
              <span className="neu-tag bg-blue text-black">FloatZap contract</span>
            </div>
            <ZapInput onFloatCreated={refreshFloats} />
          </div>
        )}

        {/* ─── OPTIMIZER TAB ─── */}
        {tab === 'optimizer' && (
          <div className="animate-float-in max-w-xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-display text-2xl font-bold">Yield Optimizer</h2>
                <p className="font-body text-sm text-black/50 mt-1">
                  Auto-splits USDC across all 3 YO vaults for maximum APY
                </p>
              </div>
              <span className="neu-tag" style={{ background: '#8B5CF622', color: '#8B5CF6', borderColor: '#8B5CF6' }}>FloatOptimizer contract</span>
            </div>
            <OptimizerPanel onFloatCreated={refreshFloats} />
            <div className="mt-4">
              <OnChainPositions />
            </div>
          </div>
        )}

        {/* ─── VAULTS TAB ─── */}
        {tab === 'vaults' && (
          <div className="animate-float-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-2xl font-bold">Vault dashboard</h2>
              <span className="neu-tag bg-acid">Live on-chain data</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <p className="font-display text-xs font-bold uppercase text-black/40 tracking-wider mb-3">
                  Live comparison
                </p>
                <VaultComparisonTable />
              </div>
              <div>
                <p className="font-display text-xs font-bold uppercase text-black/40 tracking-wider mb-3">
                  APY history
                </p>
                <VaultDashboard />
              </div>
            </div>
          </div>
        )}

        {/* ─── INTELLIGENCE TAB ─── */}
        {tab === 'intelligence' && (
          <div className="animate-float-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-2xl font-bold">Intelligence</h2>
              <span className="neu-tag bg-acid">AI-powered</span>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-1 bg-black/5 p-1 rounded-lg mb-6 overflow-x-auto">
              {([
                { id: 'intel', label: '🔬 Portfolio Report' },
                { id: 'rebalancer', label: '🔄 Rebalancer' },
                { id: 'coach', label: '🧠 AI Coach' },
                { id: 'forecast', label: '📈 Yield Forecast' },
                { id: 'gas', label: '⛽ Gas Gate' },
              ] as const).map(t => (
                <button
                  key={t.id}
                  onClick={() => setIntelTab(t.id)}
                  className={`flex-1 py-2 px-3 rounded-md font-body text-xs transition-all whitespace-nowrap ${intelTab === t.id
                      ? 'bg-white shadow-sm text-black font-medium border border-black/10'
                      : 'text-black/40 hover:text-black'
                    }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="max-w-3xl">
              {intelTab === 'intel' && <PortfolioIntel avgApy={avgApy} />}
              {intelTab === 'rebalancer' && <RebalancerPanel />}
              {intelTab === 'coach' && <AICoach />}
              {intelTab === 'forecast' && <YieldForecast />}
              {intelTab === 'gas' && <GasGatePanel />}
            </div>
          </div>
        )}

        {/* ─── RISK TAB ─── */}
        {tab === 'risk' && (
          <div className="max-w-3xl animate-float-in">
            <h2 className="font-display text-2xl font-bold mb-6">Risk & transparency</h2>
            <RiskPanel />
          </div>
        )}

        <footer className="text-center py-8 mt-12 border-t border-black/5">
          <p className="font-body text-xs text-black/25">
            FLOAT • Built on{' '}
            <a href="https://yo.xyz" target="_blank" rel="noopener" className="underline hover:text-black/50 transition-colors">
              YO Protocol
            </a>
            {' '}• Base Chain
          </p>
        </footer>
      </main>

      <MilestoneToasts />
    </div>
  )
}