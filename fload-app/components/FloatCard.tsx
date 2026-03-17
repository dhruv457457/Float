'use client'

import { useState, useEffect, useRef } from 'react'
import { differenceInDays, differenceInHours, format } from 'date-fns'
import { useRedeem } from '@yo-protocol/react'
import { VAULT_ADDRESSES } from '@/lib/yo'
import { updateFloatStatus, type FloatEntry } from '@/lib/schedule'

interface Props {
  float: FloatEntry
  apy?: number
  onRedeemed?: () => void
}

export function FloatCard({ float: f, apy = 3.2, onRedeemed }: Props) {
  const [redeemError, setRedeemError] = useState('')
  const [liveYield, setLiveYield] = useState(0)
  const startRef = useRef(Date.now())

  const vaultAddress = VAULT_ADDRESSES[f.vault as keyof typeof VAULT_ADDRESSES] as `0x${string}`
  const { redeem, isLoading: redeeming } = useRedeem({ vault: vaultAddress })

  const daysLeft = differenceInDays(new Date(f.neededAt), new Date())
  const hoursLeft = differenceInHours(new Date(f.neededAt), new Date())
  const daysElapsed = differenceInDays(new Date(), new Date(f.depositedAt))
  const totalDays = differenceInDays(new Date(f.neededAt), new Date(f.depositedAt))

  // Base yield from days elapsed
  const baseYield = (apy / 100 / 365) * daysElapsed * f.depositedAmount
  // Per-second rate
  const perSecond = (apy / 100 / 365 / 86400) * f.depositedAmount

  // Live per-second yield tick
  useEffect(() => {
    startRef.current = Date.now()
    setLiveYield(baseYield)
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 1000
      setLiveYield(baseYield + perSecond * elapsed)
    }, 200)
    return () => clearInterval(interval)
  }, [baseYield, perSecond])

  const progress = totalDays > 0 ? Math.min(100, (daysElapsed / totalDays) * 100) : 0

  const urgencyColor =
    daysLeft <= 1 ? 'bg-pink/10 text-pink border-pink' :
      daysLeft <= 3 ? 'bg-orange/10 text-orange border-orange' :
        'bg-acid/20 text-acid-dark border-acid-dark'

  const urgencyText = daysLeft > 0 ? `${daysLeft}d left` : `${hoursLeft}h left`
  const isRedeemable = daysLeft <= 1 && f.status === 'active'

  async function handleRedeem() {
    try {
      setRedeemError('')
      const shares = BigInt(f.shares || '0')
      if (shares > 0n) {
        await redeem(shares)
      } else {
        await redeem(BigInt(1))
      }
      updateFloatStatus(f.id, { status: 'completed' })
      onRedeemed?.()
    } catch (err: any) {
      console.error('Redeem failed:', err)
      setRedeemError(err?.shortMessage || err?.message || 'Redeem failed')
    }
  }

  return (
    <div className={`border rounded-xl p-5 bg-white flex flex-col gap-3 hover:border-black/25 hover:shadow-sm transition-all ${
      isRedeemable ? 'border-acid-dark border-2' : 'border-black/10'
    }`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="font-body font-semibold text-base">{f.label}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="soft-tag bg-black/5 text-black/60">{f.vault}</span>
            <span className="font-body text-xs text-black/35">{apy.toFixed(1)}% APY</span>
          </div>
        </div>
        <span className={`soft-tag ${urgencyColor}`}>{urgencyText}</span>
      </div>

      <div className="flex justify-between items-center text-sm font-body">
        <span className="text-black/45">${f.depositedAmount.toFixed(0)} deposited</span>
        {/* Live per-second ticker */}
        <span className="font-display font-bold text-acid-dark tabular-nums">
          +${liveYield.toFixed(5)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-black/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-acid rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex justify-between items-center">
        <p className="font-body text-xs text-black/35">
          Ready {format(new Date(f.neededAt), 'MMM d, yyyy')}
        </p>
        {f.txHash && (
          <a
            href={`https://basescan.org/tx/${f.txHash}`}
            target="_blank"
            rel="noopener"
            className="font-body text-xs text-blue hover:underline"
          >
            View TX ↗
          </a>
        )}
      </div>

      {isRedeemable && (
        <button
          onClick={handleRedeem}
          disabled={redeeming}
          className="neu-btn neu-btn-primary w-full text-xs mt-1"
        >
          {redeeming ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              REDEEMING...
            </span>
          ) : 'REDEEM NOW →'}
        </button>
      )}

      {redeemError && (
        <p className="font-body text-xs text-pink text-center">{redeemError}</p>
      )}
    </div>
  )
}