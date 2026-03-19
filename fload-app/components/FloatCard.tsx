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
  const [autoRedeem, setAutoRedeem] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(`auto_redeem_${f.id}`)
      return stored === null ? true : stored === 'true' // default ON
    } catch { return true }
  })

  function toggleAutoRedeem() {
    const next = !autoRedeem
    setAutoRedeem(next)
    try {
      localStorage.setItem(`auto_redeem_${f.id}`, String(next))
      // Update the float entry
      const raw = localStorage.getItem('float_entries')
      if (raw) {
        const entries = JSON.parse(raw)
        const idx = entries.findIndex((e: any) => e.id === f.id)
        if (idx !== -1) {
          entries[idx].autoRedeemDisabled = !next
          localStorage.setItem('float_entries', JSON.stringify(entries))
        }
      }
    } catch {}
  }
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
  const [showEmergency, setShowEmergency] = useState(false)

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
          <a href={`https://basescan.org/tx/${f.txHash}`}
            target="_blank" rel="noopener"
            className="font-body text-xs text-blue hover:underline">
            View TX ↗
          </a>
        )}
      </div>

      {/* Auto-redeem toggle */}
      <div className="flex items-center justify-between py-1 border-t border-black/5">
        <div className="flex items-center gap-1.5">
          <span className="font-display text-xs text-black/40 uppercase tracking-wider">
            Auto-redeem
          </span>
          <span className="font-body text-[10px] text-black/25">
            {autoRedeem ? 'on deadline' : 'disabled'}
          </span>
        </div>
        <button onClick={toggleAutoRedeem}
          className={`relative w-9 h-5 rounded-full transition-colors border-2 border-black/20 ${autoRedeem ? 'bg-acid' : 'bg-black/10'}`}>
          <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white border border-black/20 transition-all ${autoRedeem ? 'left-[18px]' : 'left-0.5'}`} />
        </button>
      </div>

      {/* Ready to redeem */}
      {isRedeemable && (
        <button onClick={handleRedeem} disabled={redeeming}
          className="neu-btn neu-btn-primary w-full text-xs mt-1">
          {redeeming ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              REDEEMING...
            </span>
          ) : 'REDEEM NOW →'}
        </button>
      )}

      {/* Emergency exit — always available */}
      {!isRedeemable && (
        <div className="flex flex-col gap-2">
          {!showEmergency ? (
            <button onClick={() => setShowEmergency(true)}
              className="font-display text-xs text-black/25 hover:text-pink transition-colors text-center uppercase tracking-wider py-1">
              ⚠ Emergency exit
            </button>
          ) : (
            <div className="border border-pink/30 rounded-lg p-3 bg-pink/5 flex flex-col gap-2">
              <p className="font-body text-xs text-pink/80">
                Redeeming early exits your float before the deadline. You keep all yield earned so far but forfeit future yield.
              </p>
              <div className="flex gap-2">
                <button onClick={handleRedeem} disabled={redeeming}
                  className="flex-1 py-2 rounded-lg border-2 border-pink text-pink font-display text-xs hover:bg-pink hover:text-white transition-all">
                  {redeeming ? (
                    <span className="flex items-center justify-center gap-1">
                      <span className="inline-block w-3 h-3 border-2 border-pink/30 border-t-pink rounded-full animate-spin" />
                      EXITING...
                    </span>
                  ) : 'CONFIRM EXIT →'}
                </button>
                <button onClick={() => setShowEmergency(false)}
                  className="px-3 py-2 rounded-lg border border-black/10 font-display text-xs text-black/40 hover:text-black transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {redeemError && (
        <p className="font-body text-xs text-pink text-center">{redeemError}</p>
      )}
    </div>
  )
}