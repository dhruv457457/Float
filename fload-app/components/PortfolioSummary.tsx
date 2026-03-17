'use client'

import type { FloatEntry } from '@/lib/schedule'
import { differenceInDays } from 'date-fns'

interface Props {
  floats: FloatEntry[]
  avgApy: number
}

export function PortfolioSummary({ floats, avgApy }: Props) {
  const totalDeposited = floats.reduce((s, f) => s + f.depositedAmount, 0)
  const now = new Date()
  const totalYield = floats.reduce((s, f) => {
    const days = differenceInDays(now, new Date(f.depositedAt))
    return s + (avgApy / 100 / 365) * days * f.depositedAmount
  }, 0)

  const nextRedemption = floats
    .filter(f => f.status === 'active')
    .sort((a, b) => new Date(a.neededAt).getTime() - new Date(b.neededAt).getTime())[0]

  const nextDays = nextRedemption
    ? differenceInDays(new Date(nextRedemption.neededAt), now)
    : null

  if (floats.length === 0) return null

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="neu-card p-4 text-center">
        <p className="font-display text-[10px] text-black/40 uppercase">Floating</p>
        <p className="font-display font-bold text-xl">${totalDeposited.toFixed(0)}</p>
      </div>
      <div className="neu-card p-4 text-center bg-acid/10">
        <p className="font-display text-[10px] text-acid-dark uppercase">Earned</p>
        <p className="font-display font-bold text-xl text-acid-dark">+${totalYield.toFixed(2)}</p>
      </div>
      <div className="neu-card p-4 text-center">
        <p className="font-display text-[10px] text-black/40 uppercase">Next ready</p>
        <p className="font-display font-bold text-xl">
          {nextDays !== null ? `${nextDays}d` : '—'}
        </p>
      </div>
    </div>
  )
}
