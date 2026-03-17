'use client'

import { useState } from 'react'
import { useRedeem, useDeposit, useApprove } from '@yo-protocol/react'
import { parseUnits } from 'viem'
import { getActiveFloats, updateFloatStatus } from '@/lib/schedule'
import { VAULT_ADDRESSES, UNDERLYING_ADDRESSES, VAULT_DECIMALS } from '@/lib/yo'

type VaultKey = 'yoUSD' | 'yoETH' | 'yoBTC'

interface Recommendation {
  floatLabel: string
  currentVault: VaultKey
  currentApy: number
  action: 'keep' | 'rebalance'
  targetVault: VaultKey | null
  targetApy: number
  gainProjected: string
  gasBreakeven: string
  urgency: 'high' | 'medium' | 'low'
  reasoning: string
}

const VAULT_APYS: Record<VaultKey, number> = {
  yoUSD: 3.18,
  yoETH: 5.42,
  yoBTC: 1.92,
}

export function RebalancerPanel() {
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function analyze() {
    setLoading(true)
    setError('')
    const floats = getActiveFloats()
    if (!floats.length) {
      setError('No active floats to analyze.')
      setLoading(false)
      return
    }

    const floatData = floats.map(f => ({
      label: f.label,
      vault: f.vault,
      amount: f.depositedAmount,
      daysElapsed: Math.floor((Date.now() - new Date(f.depositedAt).getTime()) / 86400000),
      daysTotal: Math.floor((new Date(f.neededAt).getTime() - new Date(f.depositedAt).getTime()) / 86400000),
    }))

    try {
      const res = await fetch('/api/rebalance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ floats: floatData, vaultApys: VAULT_APYS }),
      })
      const data = await res.json()
      setRecs(data.recommendations ?? [])
    } catch (e: any) {
      setError(e.message || 'Analysis failed')
    }
    setLoading(false)
  }

  const urgencyColors: Record<string, string> = {
    high: 'bg-pink/10 text-pink border-pink',
    medium: 'bg-orange/10 text-orange border-orange',
    low: 'bg-acid/20 text-acid-dark border-acid-dark',
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="neu-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="neu-tag bg-acid">AI Rebalancer</span>
            <span className="font-display text-xs text-black/40 uppercase tracking-wider">
              Analyzes floats + live APYs
            </span>
          </div>
          <button onClick={analyze} disabled={loading} className="neu-btn neu-btn-primary">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ANALYZING...
              </span>
            ) : 'ANALYZE NOW →'}
          </button>
        </div>

        {error && (
          <p className="font-body text-xs text-pink text-center py-4">{error}</p>
        )}

        {!recs.length && !loading && !error && (
          <div className="py-8 text-center">
            <p className="font-body text-sm text-black/40">
              Claude will review your floats + current vault APYs and find rebalancing opportunities.
            </p>
          </div>
        )}

        {recs.length > 0 && (
          <div className="flex flex-col gap-3">
            {recs.map((r, i) => (
              <RebalanceCard key={i} rec={r} urgencyColors={urgencyColors} />
            ))}
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="border border-black/10 rounded-lg p-4 bg-white">
        <p className="font-display text-xs font-bold uppercase text-black/40 mb-3">How the rebalancer works</p>
        <div className="flex flex-col gap-2 font-body text-xs text-black/60">
          <div className="flex gap-2">
            <span className="neu-tag bg-acid shrink-0">1</span>
            <span>Claude checks each float's current APY vs available vault APYs</span>
          </div>
          <div className="flex gap-2">
            <span className="neu-tag bg-acid shrink-0">2</span>
            <span>Calculates if the APY gain × remaining days × amount justifies ~$0.08 gas</span>
          </div>
          <div className="flex gap-2">
            <span className="neu-tag bg-acid shrink-0">3</span>
            <span>Redeems from current vault → deposits into higher-yielding vault in one flow</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function RebalanceCard({
  rec,
  urgencyColors,
}: {
  rec: Recommendation
  urgencyColors: Record<string, string>
}) {
  const [status, setStatus] = useState<'idle' | 'executing' | 'done' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')

  const float = getActiveFloats().find(f => f.label === rec.floatLabel)
  const targetVault = rec.targetVault as VaultKey | null

  const { redeem } = useRedeem({
    vault: VAULT_ADDRESSES[rec.currentVault as VaultKey] as `0x${string}`,
  })
  const { approve } = useApprove({
    token: targetVault ? (UNDERLYING_ADDRESSES[targetVault] as `0x${string}`) : '0x0',
  })
  const { deposit } = useDeposit({
    vault: targetVault ? (VAULT_ADDRESSES[targetVault] as `0x${string}`) : '0x0',
    slippageBps: 50,
  })

  async function executeRebalance() {
    if (!float || !targetVault) return
    setStatus('executing')
    try {
      // 1. Redeem from current vault
      await redeem(BigInt(float.shares || '1'))

      // 2. Approve + deposit into target vault
      const amount = parseUnits(float.depositedAmount.toString(), VAULT_DECIMALS[targetVault])
      await approve(amount)
      await deposit({
        token: UNDERLYING_ADDRESSES[targetVault] as `0x${string}`,
        amount,
      })

      // 3. Update local state
      updateFloatStatus(float.id, { vault: targetVault })
      setStatus('done')
    } catch (e: any) {
      setStatus('error')
      setErrMsg(e?.shortMessage || e?.message || 'Rebalance failed')
    }
  }

  const isRebalance = rec.action === 'rebalance'

  return (
    <div className={`border rounded-xl p-4 bg-white transition-all ${
      isRebalance
        ? 'border-acid-dark border-2 bg-acid/5'
        : 'border-black/10'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-display text-sm font-bold">{rec.floatLabel}</span>
          <span className="neu-tag text-xs" style={{ background: '#9BD60022', color: '#9BD600', borderColor: '#9BD600' }}>
            {rec.currentVault}
          </span>
          {isRebalance && targetVault && (
            <>
              <span className="font-display text-xs">→</span>
              <span className="neu-tag text-xs" style={{ background: '#3B82F622', color: '#3B82F6', borderColor: '#3B82F6' }}>
                {targetVault}
              </span>
            </>
          )}
        </div>
        <span className={`soft-tag ${isRebalance ? 'bg-orange/10 text-orange border-orange' : 'bg-acid/20 text-acid-dark border-acid-dark'}`}>
          {isRebalance ? '↗ REBALANCE' : '✓ KEEP'}
        </span>
      </div>

      {isRebalance && (
        <div className="flex gap-4 mb-2 font-body text-xs">
          <span>APY: <b className="text-black/40">{rec.currentApy}%</b> → <b className="text-acid-dark">{rec.targetApy}%</b></span>
          {rec.gainProjected && <span className="text-acid-dark font-semibold">+{rec.gainProjected}</span>}
          {rec.gasBreakeven && <span className="text-black/40">Break-even: {rec.gasBreakeven}</span>}
        </div>
      )}

      <p className="font-body text-xs text-black/60 mb-3">{rec.reasoning}</p>

      {isRebalance && status === 'idle' && (
        <button onClick={executeRebalance} className="neu-btn neu-btn-primary w-full text-xs">
          EXECUTE REBALANCE →
        </button>
      )}
      {status === 'executing' && (
        <div className="flex items-center justify-center gap-2 py-2">
          <span className="inline-block w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          <span className="font-display text-xs uppercase">Rebalancing...</span>
        </div>
      )}
      {status === 'done' && (
        <div className="neu-btn bg-acid/30 text-center pointer-events-none text-xs">✓ REBALANCED</div>
      )}
      {status === 'error' && (
        <p className="font-body text-xs text-pink text-center">{errMsg}</p>
      )}
    </div>
  )
}