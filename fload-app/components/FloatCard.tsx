'use client'

import { differenceInDays, differenceInHours, format } from 'date-fns'
import type { FloatEntry } from '@/lib/schedule'

interface Props {
  float: FloatEntry
  apy?: number
}

export function FloatCard({ float: f, apy = 3.2 }: Props) {
  const daysLeft = differenceInDays(new Date(f.neededAt), new Date())
  const hoursLeft = differenceInHours(new Date(f.neededAt), new Date())
  const daysElapsed = differenceInDays(new Date(), new Date(f.depositedAt))
  const totalDays = differenceInDays(new Date(f.neededAt), new Date(f.depositedAt))
  const yieldSoFar = (apy / 100 / 365) * daysElapsed * f.depositedAmount
  const progress = totalDays > 0 ? Math.min(100, (daysElapsed / totalDays) * 100) : 0

  const urgencyColor =
    daysLeft <= 1 ? 'bg-pink text-white' :
    daysLeft <= 3 ? 'bg-orange text-white' :
    'bg-acid text-black'

  const urgencyText = daysLeft > 0 ? `${daysLeft}d left` : `${hoursLeft}h left`

  return (
    <div className="neu-card p-5 flex flex-col gap-3 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_#1A1A1A] transition-all">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-display font-bold text-base">{f.label}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="neu-tag bg-cream">{f.vault}</span>
            <span className="font-display text-xs text-black/40">{apy.toFixed(1)}% APY</span>
          </div>
        </div>
        <span className={`neu-tag ${urgencyColor}`}>
          {urgencyText}
        </span>
      </div>

      <div className="flex justify-between items-center text-sm font-body">
        <span className="text-black/50">${f.depositedAmount.toFixed(0)} deposited</span>
        <span className="font-display font-bold text-acid-dark">
          +${yieldSoFar.toFixed(2)} earned
        </span>
      </div>

      {/* Progress bar - neubrutalist style */}
      <div className="w-full h-4 bg-cream border-2 border-black rounded-sm overflow-hidden">
        <div
          className="h-full bg-acid transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex justify-between items-center">
        <p className="font-display text-xs text-black/40">
          Ready {format(new Date(f.neededAt), 'MMM d, yyyy')}
        </p>
        {f.txHash && (
          <a
            href={`https://basescan.org/tx/${f.txHash}`}
            target="_blank"
            rel="noopener"
            className="font-display text-xs text-blue underline"
          >
            TX ↗
          </a>
        )}
      </div>
    </div>
  )
}
