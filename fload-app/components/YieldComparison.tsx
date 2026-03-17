'use client'

import { useState } from 'react'

const BANK_APY = 0.5
const HYSA_APY = 4.5

interface Props {
  floatApy: number
}

export function YieldComparison({ floatApy }: Props) {
  const [amount, setAmount] = useState(1000)
  const [days, setDays] = useState(30)

  const bankYield = (BANK_APY / 100 / 365) * amount * days
  const hysaYield = (HYSA_APY / 100 / 365) * amount * days
  const floatYield = (floatApy / 100 / 365) * amount * days

  const maxYield = Math.max(bankYield, hysaYield, floatYield, 0.01)

  return (
    <div className="neu-card p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="neu-tag bg-blue text-black">VS</div>
        <p className="font-display font-bold text-sm">YIELD COMPARISON</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="font-display text-[10px] text-black/40 uppercase">Amount</label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(Number(e.target.value) || 0)}
            className="neu-input w-full text-sm mt-1"
          />
        </div>
        <div>
          <label className="font-display text-[10px] text-black/40 uppercase">Days</label>
          <input
            type="number"
            value={days}
            onChange={e => setDays(Number(e.target.value) || 0)}
            className="neu-input w-full text-sm mt-1"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {/* Bank */}
        <div className="flex items-center gap-3">
          <div className="w-20 shrink-0">
            <p className="font-display text-xs font-bold">Bank</p>
            <p className="font-display text-[10px] text-black/40">{BANK_APY}% APY</p>
          </div>
          <div className="flex-1 h-8 bg-cream border-2 border-black/10 rounded-sm overflow-hidden">
            <div
              className="h-full bg-black/15 transition-all duration-300"
              style={{ width: `${(bankYield / maxYield) * 100}%` }}
            />
          </div>
          <span className="font-display text-xs font-bold w-16 text-right text-black/30">
            ${bankYield.toFixed(2)}
          </span>
        </div>

        {/* HYSA */}
        <div className="flex items-center gap-3">
          <div className="w-20 shrink-0">
            <p className="font-display text-xs font-bold">HYSA</p>
            <p className="font-display text-[10px] text-black/40">{HYSA_APY}% APY</p>
          </div>
          <div className="flex-1 h-8 bg-cream border-2 border-black/10 rounded-sm overflow-hidden">
            <div
              className="h-full bg-blue/30 transition-all duration-300"
              style={{ width: `${(hysaYield / maxYield) * 100}%` }}
            />
          </div>
          <span className="font-display text-xs font-bold w-16 text-right text-black/50">
            ${hysaYield.toFixed(2)}
          </span>
        </div>

        {/* FLOAT */}
        <div className="flex items-center gap-3">
          <div className="w-20 shrink-0">
            <p className="font-display text-xs font-bold">FLOAT</p>
            <p className="font-display text-[10px] text-acid-dark">{floatApy.toFixed(1)}% APY</p>
          </div>
          <div className="flex-1 h-8 bg-cream border-2 border-acid-dark rounded-sm overflow-hidden">
            <div
              className="h-full bg-acid transition-all duration-300"
              style={{ width: `${(floatYield / maxYield) * 100}%` }}
            />
          </div>
          <span className="font-display text-xs font-bold w-16 text-right text-black">
            ${floatYield.toFixed(2)}
          </span>
        </div>
      </div>

      {floatYield > bankYield && (
        <p className="font-display text-xs text-center text-acid-dark font-bold">
          {(floatYield / Math.max(bankYield, 0.01)).toFixed(0)}x more than a bank savings account
        </p>
      )}
    </div>
  )
}
