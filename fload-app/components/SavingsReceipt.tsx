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
        className="soft-btn w-full text-xs uppercase tracking-wider"
      >
        Share my savings receipt
      </button>

      {show && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShow(false) }}
        >
          <div className="w-full max-w-md animate-float-in" onClick={(e) => e.stopPropagation()}>
            {/* Receipt card — using inline styles to guarantee visibility */}
            <div
              className="rounded-xl p-8 flex flex-col gap-5"
              style={{
                backgroundColor: '#FFFDF5',
                border: '2.5px solid #1A1A1A',
                boxShadow: '6px 6px 0px #1A1A1A',
                color: '#1A1A1A',
              }}
            >
              {/* Header */}
              <div className="text-center pb-5" style={{ borderBottom: '2px dashed rgba(26,26,26,0.2)' }}>
                <p className="font-display text-3xl font-bold" style={{ color: '#1A1A1A' }}>FLOAT</p>
                <p className="font-display text-xs uppercase tracking-[0.2em] mt-1" style={{ color: 'rgba(26,26,26,0.4)' }}>
                  Savings receipt
                </p>
              </div>

              {/* Stats */}
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <span className="font-body text-sm" style={{ color: 'rgba(26,26,26,0.5)' }}>Active floats</span>
                  <span className="font-display font-bold text-lg" style={{ color: '#1A1A1A' }}>{floats.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-body text-sm" style={{ color: 'rgba(26,26,26,0.5)' }}>Total deposited</span>
                  <span className="font-display font-bold text-lg" style={{ color: '#1A1A1A' }}>${totalDeposited.toFixed(0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-body text-sm" style={{ color: 'rgba(26,26,26,0.5)' }}>Average APY</span>
                  <span className="font-display font-bold text-lg" style={{ color: '#9BD600' }}>{avgApy.toFixed(1)}%</span>
                </div>

                <div className="pt-4 flex justify-between items-center" style={{ borderTop: '2px dashed rgba(26,26,26,0.15)' }}>
                  <span className="font-body font-bold" style={{ color: '#1A1A1A' }}>Yield earned</span>
                  <span className="font-display font-bold text-2xl" style={{ color: '#9BD600' }}>
                    +${totalYield.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center pt-4" style={{ borderTop: '2px dashed rgba(26,26,26,0.12)' }}>
                <p className="font-display text-xs" style={{ color: 'rgba(26,26,26,0.3)' }}>
                  Yield on money I was going to spend anyway
                </p>
                <p className="font-display text-xs mt-1" style={{ color: 'rgba(26,26,26,0.18)' }}>
                  float.xyz • Powered by YO Protocol
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  const text = `I'm earning ${avgApy.toFixed(1)}% APY on $${totalDeposited.toFixed(0)} of idle stablecoins with FLOAT.\n\nThat's +$${totalYield.toFixed(2)} in yield on money I was going to spend anyway.\n\nBuilt on @yo_xyz`
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