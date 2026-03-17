'use client'

import { useState, useEffect } from 'react'
import { differenceInDays } from 'date-fns'
import { getActiveFloats, type FloatEntry } from '@/lib/schedule'

const VAULT_APYS = { yoUSD: 3.18, yoETH: 5.42, yoBTC: 1.92 }
const HYSA_APY = 4.5

export function PortfolioIntel({ avgApy }: { avgApy: number }) {
  const [report, setReport] = useState('')
  const [loading, setLoading] = useState(false)
  const [floats, setFloats] = useState<FloatEntry[]>([])

  useEffect(() => {
    setFloats(getActiveFloats())
  }, [])

  const now = new Date()
  const totalDeposited = floats.reduce((s, f) => s + f.depositedAmount, 0)
  const totalYield = floats.reduce((s, f) => {
    const days = differenceInDays(now, new Date(f.depositedAt))
    const apy = VAULT_APYS[f.vault as keyof typeof VAULT_APYS] ?? avgApy
    return s + (apy / 100 / 365) * days * f.depositedAmount
  }, 0)

  async function generateReport() {
    setLoading(true)
    const floatData = floats.map(f => {
      const apy = VAULT_APYS[f.vault as keyof typeof VAULT_APYS] ?? avgApy
      const daysElapsed = differenceInDays(now, new Date(f.depositedAt))
      const daysTotal = differenceInDays(new Date(f.neededAt), new Date(f.depositedAt))
      return { label: f.label, vault: f.vault, amount: f.depositedAmount, daysElapsed, daysTotal }
    })

    try {
      const res = await fetch('/api/intel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ floats: floatData, vaultApys: VAULT_APYS, totalDeposited, totalYield }),
      })
      const data = await res.json()
      setReport(data.report)
    } catch {
      setReport('Could not generate report. Check your connection.')
    }
    setLoading(false)
  }

  if (!floats.length) return (
    <div className="neu-card p-6 text-center">
      <p className="font-body text-sm text-black/40">No active floats yet. Create a float to see your portfolio intelligence report.</p>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {/* AI Report */}
      <div className="neu-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="neu-tag bg-acid">Portfolio Intelligence</span>
            <span className="font-body text-xs text-black/50">AI analysis of your full portfolio</span>
          </div>
          <button onClick={generateReport} disabled={loading} className="neu-btn neu-btn-primary">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ANALYZING...
              </span>
            ) : 'ANALYZE →'}
          </button>
        </div>

        {report ? (
          <div className="border-l-4 border-acid px-4 py-3 rounded-r-lg bg-acid/5">
            <p className="font-body text-sm text-black/80 leading-relaxed">{report}</p>
          </div>
        ) : (
          <div className="py-6 text-center">
            <p className="font-body text-sm text-black/40">
              Claude will analyze your floats and generate a personalized report with specific rebalancing suggestions.
            </p>
          </div>
        )}
      </div>

      {/* Float breakdown */}
      <div className="neu-card p-5">
        <p className="font-display text-xs font-bold uppercase text-black/40 tracking-wider mb-3">Float breakdown</p>
        <div className="flex flex-col gap-3">
          {floats.map(f => {
            const apy = VAULT_APYS[f.vault as keyof typeof VAULT_APYS] ?? avgApy
            const daysElapsed = differenceInDays(now, new Date(f.depositedAt))
            const daysTotal = differenceInDays(new Date(f.neededAt), new Date(f.depositedAt))
            const yieldSoFar = (apy / 100 / 365) * daysElapsed * f.depositedAmount
            const projTotal = (apy / 100 / 365) * daysTotal * f.depositedAmount
            const vsHysa = ((apy - HYSA_APY) / 100 / 365) * f.depositedAmount * daysTotal
            const progress = daysTotal > 0 ? Math.min(100, (daysElapsed / daysTotal) * 100) : 0

            return (
              <div key={f.id} className="border border-black/10 rounded-xl p-4 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-body font-semibold text-sm">{f.label}</span>
                    <span className="soft-tag bg-black/5 text-black/60">{f.vault}</span>
                    <span className="soft-tag bg-black/5 text-black/60">{apy.toFixed(1)}% APY</span>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-sm font-bold text-acid-dark">+${yieldSoFar.toFixed(4)}</p>
                    <p className="font-body text-xs text-black/30">of ${projTotal.toFixed(4)} projected</p>
                  </div>
                </div>

                <div className="w-full h-1.5 bg-black/6 rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-acid rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>

                <div className="flex justify-between font-body text-xs text-black/40">
                  <span>Day {daysElapsed} of {daysTotal} · ${f.depositedAmount}</span>
                  <span style={{ color: vsHysa >= 0 ? '#9BD600' : '#FF3CAC' }}>
                    {vsHysa >= 0 ? '+' : ''}${vsHysa.toFixed(4)} vs HYSA
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total floating', value: `$${totalDeposited.toFixed(0)}`, color: 'inherit' },
          { label: 'Total earned', value: `+$${totalYield.toFixed(4)}`, color: '#9BD600' },
          { label: 'Avg APY', value: `${avgApy.toFixed(1)}%`, color: '#9BD600' },
        ].map(s => (
          <div key={s.label} className="neu-card p-4 text-center">
            <p className="font-display text-xs text-black/40 uppercase tracking-wider mb-1">{s.label}</p>
            <p className="font-display text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}