'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useDeposit, useApprove } from '@yo-protocol/react'
import { parseUnits } from 'viem'
import { addDays } from 'date-fns'
import { saveFloat } from '@/lib/schedule'
import { VAULT_DECIMALS, VAULT_ADDRESSES, UNDERLYING_ADDRESSES } from '@/lib/yo'
import type { FloatPlan } from '@/lib/classify'

type VaultKey = 'yoUSD' | 'yoETH' | 'yoBTC'

interface EnrichedSplit {
  plan: FloatPlan
  apy: number
  worthIt: {
    worthIt: boolean
    projectedYield: number
    friendlyYield: string
    bankComparison: {
      bankYield: number
      hysaYield: number
      floatYield: number
      multiplierVsBank: number
    }
  }
}

interface Props {
  onFloatCreated?: () => void
}

export function IntentInput({ onFloatCreated }: Props) {
  const { address } = useAccount()
  const [message, setMessage] = useState('')
  const [splits, setSplits] = useState<EnrichedSplit[]>([])
  const [overallReasoning, setOverallReasoning] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'input' | 'confirm' | 'done'>('input')
  const [completedCount, setCompletedCount] = useState(0)

  async function handleAnalyze() {
    if (!message.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, balance: 1000 }),
      })
      const data = await res.json()
      setSplits(data.splits)
      setOverallReasoning(data.overallReasoning)
      setStep('confirm')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'input') return (
    <div className="flex flex-col gap-4 w-full animate-float-in">
      <div className="neu-card p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="neu-tag bg-acid">AI-POWERED</div>
          <p className="font-display text-xs text-black/50 uppercase">Smart savings advisor</p>
        </div>
        <p className="font-body text-black/70">
          Describe what you're saving for and when you'll need it. FLOAT's AI will find the best strategy.
        </p>
        <textarea
          className="neu-input w-full resize-none h-28 font-body"
          placeholder='e.g. "I need $500 for rent in 25 days and $200 for a trip next month"'
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAnalyze() } }}
        />
        <button
          onClick={handleAnalyze}
          disabled={loading || !message.trim()}
          className="neu-btn neu-btn-primary w-full"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ANALYZING...
            </span>
          ) : 'FLOAT IT →'}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          '$800 rent in 25 days',
          '$2000 for a laptop in 2 months',
          '$500 trip fund, maybe 3 months out',
        ].map(example => (
          <button
            key={example}
            onClick={() => setMessage(example)}
            className="neu-tag bg-white hover:bg-acid transition-colors cursor-pointer"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  )

  if (step === 'confirm' && splits.length > 0) return (
    <div className="flex flex-col gap-4 w-full animate-float-in">
      {overallReasoning && (
        <div className="neu-card p-4 bg-acid/20 flex items-start gap-3">
          <span className="text-xl">🧠</span>
          <div>
            <p className="font-display text-xs font-bold uppercase mb-1">FLOAT's recommendation</p>
            <p className="font-body text-sm text-black/70">{overallReasoning}</p>
          </div>
        </div>
      )}

      {splits.map((split, i) => (
        <SplitDepositCard
          key={i}
          split={split}
          address={address}
          onComplete={() => {
            const newCount = completedCount + 1
            setCompletedCount(newCount)
            if (newCount >= splits.length) {
              setStep('done')
              onFloatCreated?.()
            }
          }}
        />
      ))}

      <button
        onClick={() => { setStep('input'); setMessage(''); setSplits([]) }}
        className="font-display text-xs text-black/40 uppercase tracking-wider hover:text-black transition-colors text-center"
      >
        ← Change intent
      </button>
    </div>
  )

  return (
    <div className="neu-card p-8 flex flex-col items-center gap-4 animate-float-in">
      <div className="w-16 h-16 rounded-full bg-acid border-neu border-black flex items-center justify-center">
        <span className="font-display text-2xl font-bold">✓</span>
      </div>
      <p className="font-display font-bold text-xl">FLOATS ACTIVE</p>
      <p className="font-body text-center text-black/60 max-w-sm">
        {splits.length} float{splits.length > 1 ? 's' : ''} created and earning yield.
        We'll have your money ready on time.
      </p>
      <button
        onClick={() => { setStep('input'); setMessage(''); setSplits([]); setCompletedCount(0) }}
        className="neu-btn neu-btn-secondary mt-2"
      >
        FLOAT SOMETHING ELSE
      </button>
    </div>
  )
}

/*
 * Each split gets its OWN component so useDeposit and useApprove
 * hooks bind to the correct vault/token at mount time.
 * This is the React-correct way to handle per-item hooks.
 */
function SplitDepositCard({
  split,
  address,
  onComplete,
}: {
  split: EnrichedSplit
  address: `0x${string}` | undefined
  onComplete: () => void
}) {
  const [status, setStatus] = useState<'idle' | 'approving' | 'depositing' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const vaultKey = split.plan.vault as VaultKey
  const vaultAddress = VAULT_ADDRESSES[vaultKey] as `0x${string}`
  const underlyingToken = UNDERLYING_ADDRESSES[vaultKey] as `0x${string}`
  const decimals = VAULT_DECIMALS[vaultKey]

  const { deposit, isLoading: depositing } = useDeposit({
    vault: vaultAddress,
    slippageBps: 50,
  })

  const { approve, isLoading: approving } = useApprove({
    token: underlyingToken,
  })

  async function handleDeposit() {
    if (!address || !vaultAddress || !underlyingToken) return

    const depositAmount = split.plan.amount * (1 - split.plan.liquidBuffer / 100)
    const amount = parseUnits(depositAmount.toString(), decimals)

    try {
      setStatus('approving')
      await approve(amount)

      setStatus('depositing')
   const hash = await deposit({
        token: underlyingToken,
        amount,
      })

      saveFloat({
        id: crypto.randomUUID(),
        label: split.plan.friendlyLabel,
        vault: split.plan.vault,
        depositedAmount: depositAmount,
        shares: '0',
        depositedAt: new Date().toISOString(),
        redeemAt: addDays(new Date(), split.plan.daysUntilNeeded - 1).toISOString(),
        neededAt: addDays(new Date(), split.plan.daysUntilNeeded).toISOString(),
        status: 'active',
        txHash: hash,
      })

      setStatus('done')
      onComplete()
    } catch (err: any) {
      console.error('Deposit failed:', err)
      setStatus('error')
      setErrorMsg(err?.shortMessage || err?.message || 'Transaction failed')
    }
  }

  const isProcessing = status === 'approving' || status === 'depositing'

  return (
    <div className="neu-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="neu-tag bg-acid">{split.plan.vault}</div>
          <p className="font-display font-bold">{split.plan.friendlyLabel}</p>
        </div>
        <span className="font-display text-xl font-bold">${split.plan.amount}</span>
      </div>

      <p className="font-body text-sm text-black/60">{split.plan.reasoning}</p>
      <hr className="neu-divider" />

      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-md bg-cream border-2 border-black/10">
          <p className="font-display text-[10px] uppercase text-black/40">Bank savings</p>
          <p className="font-display font-bold text-black/30 line-through">
            ${split.worthIt.bankComparison.bankYield.toFixed(2)}
          </p>
        </div>
        <div className="p-3 rounded-md bg-cream border-2 border-black/10">
          <p className="font-display text-[10px] uppercase text-black/40">HYSA</p>
          <p className="font-display font-bold text-black/30">
            ${split.worthIt.bankComparison.hysaYield.toFixed(2)}
          </p>
        </div>
        <div className="p-3 rounded-md bg-acid/30 border-2 border-acid-dark">
          <p className="font-display text-[10px] uppercase text-acid-dark">FLOAT</p>
          <p className="font-display font-bold text-black">
            {split.worthIt.friendlyYield}
          </p>
        </div>
      </div>

      <div className="flex justify-between text-sm font-body">
        <span className="text-black/50">Ready in</span>
        <span className="font-display font-bold">{split.plan.daysUntilNeeded} days</span>
      </div>

      {split.plan.liquidBuffer > 0 && (
        <div className="flex justify-between text-sm font-body">
          <span className="text-black/50">Keeping liquid</span>
          <span className="font-display font-bold text-orange">
            ${(split.plan.amount * split.plan.liquidBuffer / 100).toFixed(0)} in wallet
          </span>
        </div>
      )}

      <div className="flex justify-between text-sm font-body">
        <span className="text-black/50">Certainty</span>
        <span className={`neu-tag ${split.plan.certainty === 'high' ? 'bg-acid' :
            split.plan.certainty === 'medium' ? 'bg-blue text-white' :
              'bg-orange text-white'
          }`}>
          {split.plan.certainty}
        </span>
      </div>

      {status === 'done' ? (
        <div className="neu-btn bg-acid/30 text-center pointer-events-none">✓ FLOATED</div>
      ) : (
        <button
          onClick={handleDeposit}
          disabled={isProcessing}
          className="neu-btn neu-btn-primary w-full mt-1"
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              {status === 'approving' ? 'APPROVING...' : 'DEPOSITING...'}
            </span>
          ) : `CONFIRM FLOAT — $${(split.plan.amount * (1 - split.plan.liquidBuffer / 100)).toFixed(0)}`}
        </button>
      )}

      {status === 'error' && (
        <p className="font-display text-xs text-pink text-center">{errorMsg}</p>
      )}
    </div>
  )
}