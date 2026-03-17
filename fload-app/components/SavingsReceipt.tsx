'use client'

import { useState } from 'react'
import { getActiveFloats, getTotalDeposited, getTotalYieldEarned } from '@/lib/schedule'

interface Props {
  avgApy: number
}

export function SavingsReceipt({ avgApy }: Props) {
  const [show, setShow] = useState(false)
  const floats = getActiveFloats()
  const totalDeposited = getTotalDeposited()
  const totalYield = getTotalYieldEarned(avgApy)

  if (floats.length === 0) return null

  return (
    <>
      <button
        onClick={() => setShow(true)}
        className="neu-btn neu-btn-secondary w-full text-xs"
      >
        SHARE MY SAVINGS RECEIPT
      </button>

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-sm animate-float-in">
            {/* Receipt card */}
            <div id="savings-receipt" className="bg-cream border-neu border-black rounded-lg p-6 flex flex-col gap-4 shadow-neu-lg">
              {/* Header */}
              <div className="text-center border-b-2 border-dashed border-black/20 pb-4">
                <p className="font-display text-2xl font-bold">FLOAT</p>
                <p className="font-display text-xs text-black/40 uppercase tracking-widest">Savings receipt</p>
              </div>

              {/* Stats */}
              <div className="flex flex-col gap-3">
                <div className="flex justify-between">
                  <span className="font-body text-sm text-black/50">Active floats</span>
                  <span className="font-display font-bold">{floats.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-body text-sm text-black/50">Total deposited</span>
                  <span className="font-display font-bold">${totalDeposited.toFixed(0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-body text-sm text-black/50">Average APY</span>
                  <span className="font-display font-bold text-acid-dark">{avgApy.toFixed(1)}%</span>
                </div>
                <hr className="neu-divider" />
                <div className="flex justify-between items-center">
                  <span className="font-body font-bold">Yield earned</span>
                  <span className="font-display font-bold text-xl text-acid-dark">
                    +${totalYield.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Tag */}
              <div className="text-center pt-2 border-t-2 border-dashed border-black/20">
                <p className="font-display text-xs text-black/30">
                  Yield on money I was going to spend anyway
                </p>
                <p className="font-display text-xs text-black/20 mt-1">
                  float.xyz • Powered by YO Protocol
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => {
                  const text = `I'm earning ${avgApy.toFixed(1)}% APY on $${totalDeposited.toFixed(0)} of idle stablecoins with FLOAT. That's +$${totalYield.toFixed(2)} in yield on money I was going to spend anyway. Built on @yo_xyz`
                  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
                }}
                className="neu-btn neu-btn-primary flex-1 text-xs"
              >
                SHARE ON X
              </button>
              <button
                onClick={() => setShow(false)}
                className="neu-btn neu-btn-secondary flex-1 text-xs"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
