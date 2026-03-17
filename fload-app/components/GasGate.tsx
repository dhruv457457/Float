'use client'

import { useState, useEffect } from 'react'

const GAS_COST_USD = 0.08 // Base mainnet estimate

interface GateResult {
  status: 'ok' | 'warn'
  ratio: number
  gasUSD: number
  projectedYield: number
  breakEvenDays: number
  message: string
}

export function useGasGate(amountUSD: number, days: number, apy: number): GateResult & { status: 'ok' | 'warn' } {
  const projectedYield = (apy / 100 / 365) * amountUSD * days
  const ratio = GAS_COST_USD / Math.max(projectedYield, 0.0001)
  const pct = ratio * 100
  const dailyYield = (apy / 100 / 365) * amountUSD
  const breakEvenDays = dailyYield > 0 ? Math.ceil(GAS_COST_USD / dailyYield) : Infinity

  let status: 'ok' | 'warn'
  let message: string

  if (pct > 10) {
    status = 'warn'
    message = `Heads up — gas ($${GAS_COST_USD.toFixed(2)}) is ${Math.round(pct)}% of your projected yield ($${projectedYield.toFixed(3)}). You can still deposit — just something to know.`
  } else {
    status = 'ok'
    message = `Gas-efficient — only ${Math.round(pct)}% of projected yield. Break-even in ${breakEvenDays} days.`
  }

  return { status, ratio: pct, gasUSD: GAS_COST_USD, projectedYield, breakEvenDays, message }
}

// Inline gas warning — informational only, never blocks deposit
interface GasWarningProps {
  amount: number
  days: number
  apy: number
}

export function GasWarning({ amount, days, apy }: GasWarningProps) {
  const gate = useGasGate(amount, days, apy)

  if (gate.status === 'ok') return null

  return (
    <div className="rounded-lg p-3" style={{ background: 'rgba(255,107,53,.06)', border: '1.5px solid #FF6B35' }}>
      <p className="font-display text-xs font-bold uppercase mb-1" style={{ color: '#FF6B35' }}>
        ⚠ Gas heads up
      </p>
      <p className="font-body text-xs text-black/60">{gate.message}</p>
      <div className="flex gap-2 font-display text-xs text-black/35 mt-1">
        <span>Gas: ${gate.gasUSD.toFixed(2)}</span>
        <span>·</span>
        <span>Yield: ${gate.projectedYield.toFixed(3)}</span>
        <span>·</span>
        <span>Break-even: {gate.breakEvenDays}d</span>
      </div>
    </div>
  )
}

// Standalone gas calculator panel — used in the Intelligence tab
export function GasGatePanel() {
  const [amount, setAmount] = useState(200)
  const [days, setDays] = useState(15)
  const [apy, setApy] = useState(3.2)
  const gate = useGasGate(amount, days, apy)

  const statusColors = {
    ok: { bg: 'rgba(191,255,10,.15)', border: '#9BD600', text: '#9BD600', icon: '✓' },
    warn: { bg: 'rgba(255,107,53,.08)', border: '#FF6B35', text: '#FF6B35', icon: '⚠' },
  }

  const s = statusColors[gate.status]

  return (
    <div className="flex flex-col gap-4">
      <div className="neu-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="neu-tag bg-orange text-white">Gas gate</span>
          <span className="font-body text-xs text-black/50">
            Prevents gas from eating your yield
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <label className="font-display text-xs text-black/40 uppercase tracking-wider block mb-1">Amount ($)</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(Number(e.target.value) || 0)}
              className="neu-input w-full text-sm"
            />
          </div>
          <div>
            <label className="font-display text-xs text-black/40 uppercase tracking-wider block mb-1">Days</label>
            <input
              type="number"
              value={days}
              onChange={e => setDays(Number(e.target.value) || 0)}
              className="neu-input w-full text-sm"
            />
          </div>
          <div>
            <label className="font-display text-xs text-black/40 uppercase tracking-wider block mb-1">APY (%)</label>
            <input
              type="number"
              value={apy}
              step="0.1"
              onChange={e => setApy(Number(e.target.value) || 0)}
              className="neu-input w-full text-sm"
            />
          </div>
        </div>

        {/* Result */}
        <div className="rounded-lg p-4 mb-4" style={{ background: s.bg, border: `2px solid ${s.border}` }}>
          <p className="font-display text-xs font-bold uppercase mb-1" style={{ color: s.text }}>
            {s.icon} {gate.status === 'ok' ? 'CLEARED' : gate.status === 'warn' ? 'WARNING' : 'BLOCKED'}
            {' '}— Gas is {Math.round(gate.ratio)}% of projected yield
          </p>
          <p className="font-body text-xs text-black/60">{gate.message}</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Projected yield', value: `$${gate.projectedYield.toFixed(3)}`, color: '#9BD600' },
            { label: 'Est. gas cost', value: `$${gate.gasUSD.toFixed(2)}`, color: 'inherit' },
            { label: 'Break-even', value: `${gate.breakEvenDays}d`, color: gate.breakEvenDays < days ? '#9BD600' : '#FF3CAC' },
          ].map(stat => (
            <div key={stat.label} className="bg-cream border-2 border-black/10 rounded-lg p-3 text-center">
              <p className="font-display text-xs text-black/40 uppercase mb-1">{stat.label}</p>
              <p className="font-display text-lg font-bold" style={{ color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Threshold reference */}
      <div className="border border-black/10 rounded-lg p-4 bg-white">
        <p className="font-display text-xs font-bold uppercase text-black/40 mb-3">Threshold rules</p>
        <div className="flex flex-col gap-2">
          {[
            { range: 'Gas < 10% of yield', status: '✓ PROCEED', bg: 'rgba(191,255,10,.12)', color: '#9BD600', border: '#9BD600' },
            { range: 'Gas 10–30% of yield', status: '⚠ WARN', bg: 'rgba(255,107,53,.1)', color: '#FF6B35', border: '#FF6B35' },
            { range: 'Gas > 30% of yield', status: '✗ BLOCK', bg: 'rgba(255,60,172,.08)', color: '#FF3CAC', border: '#FF3CAC' },
          ].map(t => (
            <div key={t.range} className="flex justify-between items-center px-3 py-2 rounded-md"
              style={{ background: t.bg }}>
              <span className="font-body text-xs">{t.range}</span>
              <span className="font-display text-xs font-bold" style={{ color: t.color }}>{t.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}