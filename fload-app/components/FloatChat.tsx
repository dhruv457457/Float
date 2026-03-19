'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useReadContract, useBalance, usePublicClient } from 'wagmi'
import { useDeposit, useApprove, useVaultState } from '@yo-protocol/react'
import { parseUnits, parseEther, formatUnits } from 'viem'
import { addDays } from 'date-fns'
import { saveFloat } from '@/lib/schedule'
import { VAULT_DECIMALS, VAULT_ADDRESSES, UNDERLYING_ADDRESSES } from '@/lib/yo'
import { FLOAT_ZAP_ADDRESS, FLOAT_ZAP_ABI, FLOAT_OPTIMIZER_ADDRESS, FLOAT_OPTIMIZER_ABI, TOKENS, YO_VAULTS } from '@/lib/contracts'
import { GasWarning, useGasGate } from '@/components/GasGate'
import type { FloatPlan } from '@/lib/classify'

// ── Types ─────────────────────────────────────────────────────────
type Mode = 'float' | 'zap' | 'optimizer'
type VaultKey = 'yoUSD' | 'yoETH' | 'yoBTC'

interface EnrichedSplit {
    plan: FloatPlan
    apy: number
    worthIt: {
        worthIt: boolean
        projectedYield: number
        friendlyYield: string
        bankComparison: { bankYield: number; hysaYield: number; floatYield: number; multiplierVsBank: number }
    }
}

interface ZapAIResult {
    tokenIn: string; vault: VaultKey; days: number; label: string
    routeExplanation: string; riskNote: string | null
}

interface OptAIResult {
    amount: number | null; days: number; label: string
    splitExplanation: string; riskAssessment: string | null
}

interface Props { onFloatCreated?: () => void }

// ── ERC20 ABI ─────────────────────────────────────────────────────
const ERC20_ABI = [
    {
        name: 'approve', type: 'function', stateMutability: 'nonpayable',
        inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
        outputs: [{ name: '', type: 'bool' }]
    },
    {
        name: 'allowance', type: 'function', stateMutability: 'view',
        inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }]
    },
] as const

const TOKEN_OPTIONS = [
    { ...TOKENS.ETH, symbol: 'ETH', icon: '⟠', isNative: true, decimals: 18 },
    { ...TOKENS.USDC, symbol: 'USDC', icon: '◎', isNative: false, decimals: 6 },
    { ...TOKENS.WETH, symbol: 'WETH', icon: '⟠', isNative: false, decimals: 18 },
    { ...TOKENS.cbBTC, symbol: 'cbBTC', icon: '₿', isNative: false, decimals: 8 },
]

const VAULT_OPTIONS = [
    { id: 'yoUSD' as VaultKey, label: 'yoUSD', apy: '3.18', color: '#9BD600', desc: 'Stable · low risk' },
    { id: 'yoETH' as VaultKey, label: 'yoETH', apy: '5.42', color: '#3B82F6', desc: 'ETH · medium risk' },
    { id: 'yoBTC' as VaultKey, label: 'yoBTC', apy: '1.92', color: '#FF6B35', desc: 'BTC · low-med risk' },
]

const MODE_CONFIG = {
    float: { label: 'Float', emoji: '💸', color: '#BFFF0A', tag: 'bg-acid', desc: 'Goal-based savings via YO vaults' },
    zap: { label: 'Zap', emoji: '⚡', color: '#3B82F6', tag: 'bg-blue text-black', desc: 'Any token → any vault in one tx' },
    optimizer: { label: 'Optimizer', emoji: '🔮', color: '#8B5CF6', tag: 'bg-purple', desc: 'Auto-split USDC across 3 vaults' },
}

const EXAMPLES: Record<Mode, string[]> = {
    float: ['$200 for a bicycle in 3 months', '$500 rent in 25 days', '$800 laptop in 60 days'],
    zap: ['0.01 ETH for 30 days', '$50 USDC highest yield', 'cbBTC for 2 months'],
    optimizer: ['Save $200 for 3 months max yield', '$500 trip fund, 45 days', '$300 emergency fund'],
}

export function FloatChat({ onFloatCreated }: Props) {
    const { address } = useAccount()
    const publicClient = usePublicClient()!
    const { writeContractAsync } = useWriteContract()

    const [mode, setMode] = useState<Mode>('float')
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)
    const [step, setStep] = useState<'input' | 'confirm' | 'done'>('input')
    const [aiReasoning, setAiReasoning] = useState('')
    const [aiRisk, setAiRisk] = useState('')

    // Float mode state
    const [splits, setSplits] = useState<EnrichedSplit[]>([])
    const [completedCount, setCompletedCount] = useState(0)

    // Zap mode state
    const [zapResult, setZapResult] = useState<ZapAIResult | null>(null)
    const [tokenSymbol, setTokenSymbol] = useState('ETH')
    const [zapAmount, setZapAmount] = useState('')
    const [zapVault, setZapVault] = useState<VaultKey>('yoUSD')
    const [zapDays, setZapDays] = useState(30)
    const [zapLabel, setZapLabel] = useState('')
    const [zapStep, setZapStep] = useState<'idle' | 'approving' | 'zapping'>('idle')
    const [zapTxHash, setZapTxHash] = useState<`0x${string}` | undefined>()

    // Optimizer mode state
    const [optResult, setOptResult] = useState<OptAIResult | null>(null)
    const [optAmount, setOptAmount] = useState('')
    const [optDays, setOptDays] = useState(30)
    const [optLabel, setOptLabel] = useState('')
    const [optStep, setOptStep] = useState<'idle' | 'approving' | 'depositing'>('idle')
    const [optTxHash, setOptTxHash] = useState<`0x${string}` | undefined>()

    const [errorMsg, setErrorMsg] = useState('')

    // ── Read balances ─────────────────────────────────────────────────
    const { data: usdcBalance } = useBalance({
        address, token: TOKENS.USDC.address,
        query: { enabled: !!address },
    })
    const { data: ethBalance } = useBalance({
        address, query: { enabled: !!address },
    })
    const usdcBalanceNum = usdcBalance ? parseFloat(formatUnits(usdcBalance.value, 6)) : 0
    const ethBalanceNum = ethBalance ? parseFloat(formatUnits(ethBalance.value, 18)) : 0

    // ── Zap helpers ───────────────────────────────────────────────────
    const tokenIn = TOKEN_OPTIONS.find(t => t.symbol === tokenSymbol) ?? TOKEN_OPTIONS[0]
    const zapAmountParsed = zapAmount ? parseUnits(zapAmount, tokenIn.decimals) : 0n
    // EXTRACTED REFETCH:
    const { data: zapAllowance, refetch: refetchZapAllowance } = useReadContract({
        address: tokenIn.address, abi: ERC20_ABI, functionName: 'allowance',
        args: address ? [address, FLOAT_ZAP_ADDRESS] : undefined,
        query: { enabled: !!address && !tokenIn.isNative },
    })
    const zapNeedsApproval = !tokenIn.isNative && zapAmountParsed > 0n && (zapAllowance ?? 0n) < zapAmountParsed

    // ── Optimizer helpers ─────────────────────────────────────────────
    const optAmountParsed = optAmount ? parseUnits(optAmount, 6) : 0n
    // EXTRACTED REFETCH:
    const { data: optAllowance, refetch: refetchOptAllowance } = useReadContract({
        address: TOKENS.USDC.address, abi: ERC20_ABI, functionName: 'allowance',
        args: address ? [address, FLOAT_OPTIMIZER_ADDRESS] : undefined,
        query: { enabled: !!address },
    })
    const optNeedsApproval = optAmountParsed > 0n && (optAllowance ?? 0n) < optAmountParsed

    // ── AI analyze ────────────────────────────────────────────────────
    async function handleAnalyze() {
        if (!message.trim()) return
        setLoading(true)
        setErrorMsg('')
        try {
            if (mode === 'float') {
                const res = await fetch('/api/classify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message, balance: usdcBalanceNum }),
                })
                const data = await res.json()
                setSplits(data.splits ?? [])
                setAiReasoning(data.overallReasoning ?? '')
                setStep('confirm')
            } else if (mode === 'zap') {
                const res = await fetch('/api/zap-ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message }),
                })
                const data: ZapAIResult = await res.json()
                setZapResult(data)
                setTokenSymbol(data.tokenIn)
                setZapVault(data.vault)
                setZapDays(data.days)
                setZapLabel(data.label)
                setAiReasoning(data.routeExplanation)
                setAiRisk(data.riskNote ?? '')
                setStep('confirm')
            } else {
                const res = await fetch('/api/optimizer-ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message, vaultApys: { yoUSD: 3.18, yoETH: 5.42, yoBTC: 1.92 } }),
                })
                const data: OptAIResult = await res.json()
                setOptResult(data)
                if (data.amount) setOptAmount(Math.min(data.amount, usdcBalanceNum).toString())
                setOptDays(data.days)
                setOptLabel(data.label)
                setAiReasoning(data.splitExplanation)
                setAiRisk(data.riskAssessment ?? '')
                setStep('confirm')
            }
        } catch (e: any) {
            setErrorMsg('AI analysis failed — try again')
        }
        setLoading(false)
    }

    function reset() {
        setStep('input'); setMessage(''); setSplits([]); setCompletedCount(0)
        setZapResult(null); setOptResult(null); setAiReasoning(''); setAiRisk('')
        setZapAmount(''); setOptAmount(''); setErrorMsg('')
        setZapStep('idle'); setOptStep('idle')
        setZapTxHash(undefined); setOptTxHash(undefined)
    }

    // ── Done screen ───────────────────────────────────────────────────
    if (step === 'done') return (
        <div className="neu-card p-8 flex flex-col items-center gap-4 animate-float-in">
            <div className="w-16 h-16 rounded-full bg-acid border-2 border-black flex items-center justify-center">
                <span className="font-display text-2xl font-bold">✓</span>
            </div>
            <p className="font-display font-bold text-xl">
                {mode === 'float' ? 'FLOATS ACTIVE' : mode === 'zap' ? 'ZAP COMPLETE' : 'OPTIMIZER ACTIVE'}
            </p>
            {(zapTxHash || optTxHash) && (
                <a href={`https://basescan.org/tx/${zapTxHash ?? optTxHash}`}
                    target="_blank" rel="noopener" className="font-body text-xs text-blue hover:underline">
                    View on BaseScan ↗
                </a>
            )}
            <button onClick={reset} className="neu-btn neu-btn-secondary mt-2">
                {mode === 'float' ? 'FLOAT SOMETHING ELSE' : mode === 'zap' ? 'ZAP AGAIN' : 'OPTIMIZE AGAIN'}
            </button>
        </div>
    )

    // ── Input screen ──────────────────────────────────────────────────
    if (step === 'input') return (
        <div className="flex flex-col gap-4 animate-float-in">
            {/* Mode switcher */}
            <div className="flex gap-1 bg-black/5 p-1 rounded-lg">
                {(Object.entries(MODE_CONFIG) as [Mode, typeof MODE_CONFIG[Mode]][]).map(([m, cfg]) => (
                    <button key={m} onClick={() => setMode(m)}
                        className={`flex-1 py-2 px-3 rounded-md font-body text-xs transition-all flex items-center justify-center gap-1.5 ${mode === m ? 'bg-white shadow-sm text-black font-medium border border-black/10' : 'text-black/40 hover:text-black'
                            }`}>
                        <span>{cfg.emoji}</span> {cfg.label}
                    </button>
                ))}
            </div>

            <div className="neu-card p-6 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                    <span className={`neu-tag ${MODE_CONFIG[mode].tag}`}>
                        {MODE_CONFIG[mode].emoji} {MODE_CONFIG[mode].label.toUpperCase()}
                    </span>
                    <span className="font-body text-xs text-black/50">{MODE_CONFIG[mode].desc}</span>
                </div>

                {/* Balance hint */}
                {address && (usdcBalanceNum > 0 || ethBalanceNum > 0) && (
                    <div className="flex items-center gap-3 px-1 flex-wrap">
                        <span className="inline-block w-2 h-2 rounded-full bg-acid shrink-0" />
                        {usdcBalanceNum > 0 && (
                            <span className="font-body text-xs text-black/40">
                                USDC <span className="font-display text-xs text-black/60">${usdcBalanceNum.toFixed(2)}</span>
                            </span>
                        )}
                        {ethBalanceNum > 0.0001 && (
                            <span className="font-body text-xs text-black/40">
                                ETH <span className="font-display text-xs text-black/60">{ethBalanceNum.toFixed(4)}</span>
                            </span>
                        )}
                    </div>
                )}

                <textarea
                    className="neu-input w-full resize-none h-24 font-body"
                    placeholder={
                        mode === 'float' ? 'e.g. "I have $200 for a new bicycle in 3 months"'
                            : mode === 'zap' ? 'e.g. "0.01 ETH idle for 45 days, best vault"'
                                : 'e.g. "Save $200 USDC for max yield over 3 months"'
                    }
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAnalyze() } }}
                />

                <div className="flex flex-wrap gap-2">
                    {EXAMPLES[mode].map(ex => (
                        <button key={ex} onClick={() => setMessage(ex)}
                            className="neu-tag bg-white hover:bg-acid transition-colors cursor-pointer text-xs">{ex}</button>
                    ))}
                </div>

                {errorMsg && <p className="font-body text-xs text-pink">{errorMsg}</p>}

                <button onClick={handleAnalyze} disabled={loading || !message.trim()}
                    className="neu-btn neu-btn-primary w-full">
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                            AI ANALYZING...
                        </span>
                    ) : `${MODE_CONFIG[mode].emoji} ANALYZE WITH AI →`}
                </button>
            </div>
        </div>
    )

    // ── Confirm screen ────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-4 animate-float-in">
            {/* AI explanation */}
            {aiReasoning && (
                <div className="neu-card p-4 bg-acid/15 flex items-start gap-3">
                    <span className="text-lg shrink-0">🧠</span>
                    <div className="flex-1 min-w-0">
                        <p className="font-display text-xs font-bold uppercase mb-1">AI Analysis</p>
                        <p className="font-body text-sm text-black/70">{aiReasoning}</p>
                        {aiRisk && <p className="font-body text-xs text-orange mt-1">⚠ {aiRisk}</p>}
                    </div>
                    <button onClick={reset} className="font-display text-xs text-black/30 hover:text-black shrink-0">← Back</button>
                </div>
            )}

            {/* Float confirm */}
            {mode === 'float' && splits.map((split, i) => (
                <FloatSplitCard key={i} split={split} address={address}
                    onComplete={() => {
                        const n = completedCount + 1
                        setCompletedCount(n)
                        if (n >= splits.length) { setStep('done'); onFloatCreated?.() }
                    }} />
            ))}

            {/* Zap confirm */}
            {mode === 'zap' && (
                <ZapConfirmCard
                    tokenSymbol={tokenSymbol} setTokenSymbol={setTokenSymbol}
                    amount={zapAmount} setAmount={setZapAmount}
                    vault={zapVault} setVault={setZapVault}
                    days={zapDays} setDays={setZapDays}
                    label={zapLabel} setLabel={setZapLabel}
                    needsApproval={zapNeedsApproval}
                    refetchAllowance={refetchZapAllowance} // PASS THE REFETCH HERE
                    txStep={zapStep}
                    onSubmit={async () => {
                        if (!address || !zapAmount) return
                        const tIn = TOKEN_OPTIONS.find(t => t.symbol === tokenSymbol) ?? TOKEN_OPTIONS[0]
                        const amt = parseUnits(zapAmount, tIn.decimals)

                        // STEP 1: APPROVE AND STOP
                        if (zapNeedsApproval) {
                            setZapStep('approving')
                            try {
                                const h = await writeContractAsync({ address: tIn.address, abi: ERC20_ABI, functionName: 'approve', args: [FLOAT_ZAP_ADDRESS, amt] })
                                await publicClient.waitForTransactionReceipt({ hash: h })
                                await refetchZapAllowance() // Force UI update
                                setZapStep('idle')
                                return // STOP! Wait for user to click "ZAP"
                            } catch (e: any) { setErrorMsg(e?.shortMessage || 'Approval failed'); setZapStep('idle'); return }
                        }

                        // STEP 2: ZAP
                        setZapStep('zapping')
                        try {
                            const hash = await writeContractAsync({
                                address: FLOAT_ZAP_ADDRESS, abi: FLOAT_ZAP_ABI, functionName: 'zapIn',
                                args: [tIn.isNative ? '0x0000000000000000000000000000000000000000' : tIn.address, tIn.isNative ? 0n : amt, YO_VAULTS[zapVault], 0n],
                                value: tIn.isNative ? parseEther(zapAmount) : 0n,
                            })
                            setZapTxHash(hash)
                            saveFloat({ id: crypto.randomUUID(), label: zapLabel || `${tokenSymbol} → ${zapVault}`, vault: zapVault, depositedAmount: parseFloat(zapAmount), shares: '0', depositedAt: new Date().toISOString(), redeemAt: addDays(new Date(), zapDays - 1).toISOString(), neededAt: addDays(new Date(), zapDays).toISOString(), status: 'active', txHash: hash })
                            setStep('done'); onFloatCreated?.()
                        } catch (e: any) { setErrorMsg(e?.shortMessage || 'Zap failed'); setZapStep('idle') }
                    }}
                />
            )}

            {/* Optimizer confirm */}
            {mode === 'optimizer' && (
                <OptConfirmCard
                    amount={optAmount} setAmount={setOptAmount}
                    days={optDays} setDays={setOptDays}
                    label={optLabel} setLabel={setOptLabel}
                    needsApproval={optNeedsApproval}
                    refetchAllowance={refetchOptAllowance} // PASS THE REFETCH HERE
                    txStep={optStep}
                    onSubmit={async () => {
                        if (!address || !optAmount) return
                        const amt = parseUnits(optAmount, 6)

                        // STEP 1: APPROVE AND STOP
                        if (optNeedsApproval) {
                            setOptStep('approving')
                            try {
                                const h = await writeContractAsync({ address: TOKENS.USDC.address, abi: ERC20_ABI, functionName: 'approve', args: [FLOAT_OPTIMIZER_ADDRESS, amt] })
                                await publicClient.waitForTransactionReceipt({ hash: h })
                                await refetchOptAllowance() // Force UI update
                                setOptStep('idle')
                                return // STOP! Wait for user to click "OPTIMIZE"
                            } catch (e: any) { setErrorMsg(e?.shortMessage || 'Approval failed'); setOptStep('idle'); return }
                        }

                        // STEP 2: OPTIMIZE/DEPOSIT
                        setOptStep('depositing')
                        try {
                            const matureAt = BigInt(Math.floor(addDays(new Date(), optDays).getTime() / 1000))
                            const hash = await writeContractAsync({
                                address: FLOAT_OPTIMIZER_ADDRESS, abi: FLOAT_OPTIMIZER_ABI, functionName: 'deposit',
                                args: [amt, matureAt, optLabel || `Optimizer float (${optDays}d)`],
                            })
                            setOptTxHash(hash)
                            saveFloat({ id: crypto.randomUUID(), label: optLabel || `Optimizer (${optDays}d)`, vault: 'yoUSD', depositedAmount: parseFloat(optAmount), shares: '0', depositedAt: new Date().toISOString(), redeemAt: addDays(new Date(), optDays - 1).toISOString(), neededAt: addDays(new Date(), optDays).toISOString(), status: 'active', txHash: hash })
                            setStep('done'); onFloatCreated?.()
                        } catch (e: any) { setErrorMsg(e?.shortMessage || 'Deposit failed'); setOptStep('idle') }
                    }}
                />
            )}

            {errorMsg && <p className="font-body text-xs text-pink text-center">{errorMsg}</p>}

            <button onClick={reset}
                className="font-display text-xs text-black/35 uppercase tracking-wider hover:text-black transition-colors text-center">
                ← Change intent
            </button>
        </div>
    )
}

// ── Float split card (extracted from old IntentInput) ─────────────
// ── Float split card ─────────────
function FloatSplitCard({ split, address, onComplete }: { split: EnrichedSplit; address: `0x${string}` | undefined; onComplete: () => void }) {
  const [status, setStatus] = useState<'idle' | 'depositing' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  
  const vaultKey = split.plan.vault as VaultKey
  const vaultAddress = VAULT_ADDRESSES[vaultKey] as `0x${string}`
  const underlyingToken = UNDERLYING_ADDRESSES[vaultKey] as `0x${string}`
  const decimals = VAULT_DECIMALS[vaultKey]
  const depositAmount = split.plan.amount * (1 - split.plan.liquidBuffer / 100)
  
  const gasGate = useGasGate(depositAmount, split.plan.daysUntilNeeded, split.apy)
  const { vaultState } = useVaultState(vaultKey)
  
  // Notice: We completely removed useApprove! The YO SDK handles it.
  const { deposit } = useDeposit({ vault: vaultAddress, slippageBps: 50 })

  async function handleDeposit() {
    if (!address) return
    const amount = parseUnits(depositAmount.toString(), decimals)
    try {
      setStatus('depositing')
      
      // This single call will automatically prompt the user to approve (if needed) and then deposit
      const hash = await deposit({ token: underlyingToken, amount })
      
      const ASSET_DECIMALS: Record<string, number> = { yoUSD: 6, yoETH: 18, yoBTC: 8 }
      const rawRate = vaultState?.exchangeRate
      const dec = ASSET_DECIMALS[vaultKey] ?? 6
      const depositExchangeRate = rawRate ? (Number(rawRate) < 100 ? Number(rawRate) : Number(rawRate) / 10 ** dec) : null
      
      saveFloat({ id: crypto.randomUUID(), label: split.plan.friendlyLabel, vault: split.plan.vault, depositedAmount: depositAmount, shares: '0', depositedAt: new Date().toISOString(), redeemAt: addDays(new Date(), split.plan.daysUntilNeeded - 1).toISOString(), neededAt: addDays(new Date(), split.plan.daysUntilNeeded).toISOString(), status: 'active', txHash: hash, ...(depositExchangeRate ? { depositExchangeRate } : {}) } as any)
      
      setStatus('done')
      onComplete()
    } catch (err: any) { 
      setStatus('error')
      setErrorMsg(err?.shortMessage || err?.message || 'Failed') 
    }
  }

  const isProcessing = status === 'depositing'

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
          <p className="font-display text-[10px] uppercase text-black/40">Bank</p>
          <p className="font-display font-bold text-black/30 line-through">${split.worthIt.bankComparison.bankYield.toFixed(2)}</p>
        </div>
        <div className="p-3 rounded-md bg-cream border-2 border-black/10">
          <p className="font-display text-[10px] uppercase text-black/40">HYSA</p>
          <p className="font-display font-bold text-black/30">${split.worthIt.bankComparison.hysaYield.toFixed(2)}</p>
        </div>
        <div className="p-3 rounded-md bg-acid/30 border-2 border-acid-dark">
          <p className="font-display text-[10px] uppercase text-acid-dark">FLOAT</p>
          <p className="font-display font-bold text-black">{split.worthIt.friendlyYield}</p>
        </div>
      </div>
      <div className="flex justify-between text-sm font-body">
        <span className="text-black/50">Ready in</span>
        <span className="font-display font-bold">{split.plan.daysUntilNeeded} days</span>
      </div>
      
      {split.plan.liquidBuffer > 0 && (
        <div className="flex justify-between text-sm font-body p-2 bg-orange/10 border border-orange rounded-md mt-2">
          <span className="text-orange font-medium">
            🛡 AI Safety Buffer ({split.plan.liquidBuffer}%)
          </span>
          <span className="font-display font-bold text-orange">
            Keeping { (split.plan.amount * split.plan.liquidBuffer / 100).toFixed(3) } liquid
          </span>
        </div>
      )}

      <div className="flex justify-between text-sm font-body mt-2">
        <span className="text-black/50">Certainty</span>
        <span className={`neu-tag ${split.plan.certainty === 'high' ? 'bg-acid' : split.plan.certainty === 'medium' ? 'bg-blue text-black' : 'bg-orange text-black'}`}>{split.plan.certainty}</span>
      </div>
      
      {gasGate.status !== 'ok' && <GasWarning amount={depositAmount} days={split.plan.daysUntilNeeded} apy={split.apy} />}
      
      {status === 'done' ? (
        <div className="neu-btn bg-acid/30 text-center pointer-events-none">✓ FLOATED</div>
      ) : (
        <button onClick={handleDeposit} disabled={isProcessing} className="neu-btn neu-btn-primary w-full mt-1">
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              DEPOSITING...
            </span>
          ) : `CONFIRM FLOAT — $${depositAmount.toFixed(3)}`}
        </button>
      )}
      {status === 'error' && <p className="font-display text-xs text-pink text-center">{errorMsg}</p>}
    </div>
  )
}

// ── Zap confirm card ──────────────────────────────────────────────
function ZapConfirmCard({ tokenSymbol, setTokenSymbol, amount, setAmount, vault, setVault, days, setDays, label, setLabel, needsApproval, txStep, onSubmit, refetchAllowance }: any) {
    const { address } = useAccount()
    const tokenIn = TOKEN_OPTIONS.find(t => t.symbol === tokenSymbol) ?? TOKEN_OPTIONS[0]
    const vaultApy = VAULT_OPTIONS.find(v => v.id === vault)?.apy ?? '3.18'
    const projYield = amount ? ((parseFloat(vaultApy) / 100 / 365) * parseFloat(amount) * days).toFixed(4) : '0.0000'
    const isProcessing = txStep !== 'idle'

    // Show token balance
    const { data: ethBal } = useBalance({ address, query: { enabled: !!address } })
    const { data: tokBal } = useBalance({ address, token: tokenIn.isNative ? undefined : tokenIn.address, query: { enabled: !!address && !tokenIn.isNative } })
    const displayBalance = tokenIn.isNative
        ? ethBal ? `${parseFloat(formatUnits(ethBal.value, 18)).toFixed(4)} ETH` : '—'
        : tokBal ? `${parseFloat(formatUnits(tokBal.value, tokenIn.decimals)).toFixed(4)} ${tokenIn.symbol}` : '—'

    return (
        <div className="neu-card p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <span className="neu-tag bg-blue text-black">ZAP IN</span>
                <span className="font-body text-xs text-black/50">Any token → YO vault in one tx</span>
            </div>
            <div>
                <label className="font-display text-xs text-black/40 uppercase tracking-wider block mb-2">Token</label>
                <div className="flex gap-2 flex-wrap mb-1">
                    {TOKEN_OPTIONS.map(t => (
                        <button key={t.symbol} onClick={() => setTokenSymbol(t.symbol)}
                            className={`neu-tag cursor-pointer transition-all ${tokenSymbol === t.symbol ? 'bg-acid' : 'bg-white hover:bg-acid/30'}`}>
                            {t.icon} {t.symbol}
                        </button>
                    ))}
                </div>
                {address && <p className="font-body text-xs text-black/35">Balance: {displayBalance}</p>}
            </div>
            <div className="relative">
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="neu-input w-full pr-16 text-lg font-display" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-display text-sm text-black/40">{tokenIn.symbol}</span>
            </div>
            <div>
                <label className="font-display text-xs text-black/40 uppercase tracking-wider block mb-2">Target vault</label>
                <div className="flex flex-col gap-2">
                    {VAULT_OPTIONS.map(v => (
                        <button key={v.id} onClick={() => setVault(v.id)}
                            className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left ${vault === v.id ? 'border-black bg-acid/10' : 'border-black/10 bg-white hover:border-black/30'}`}>
                            <div className="flex items-center gap-2">
                                <span className="neu-tag text-xs" style={{ background: `${v.color}22`, color: v.color, borderColor: v.color }}>{v.label}</span>
                                <span className="font-body text-xs text-black/50">{v.desc}</span>
                            </div>
                            <span className="font-display text-sm font-bold" style={{ color: v.color }}>{v.apy}% APY</span>
                        </button>
                    ))}
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="font-display text-xs text-black/40 uppercase tracking-wider block mb-2">Days</label>
                    <input type="number" value={days} onChange={e => setDays(Number(e.target.value) || 0)} className="neu-input w-full text-sm" />
                </div>
                <div>
                    <label className="font-display text-xs text-black/40 uppercase tracking-wider block mb-2">Label</label>
                    <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="Rent fund" className="neu-input w-full text-sm" />
                </div>
            </div>
            {amount && parseFloat(amount) > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-acid/10 border border-acid-dark">
                    <span className="font-body text-sm text-black/60">Projected yield ({days}d)</span>
                    <span className="font-display text-sm font-bold text-acid-dark">+${projYield}</span>
                </div>
            )}
            <button onClick={onSubmit} disabled={!amount || parseFloat(amount) <= 0 || isProcessing} className="neu-btn neu-btn-primary w-full">
                {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                        <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        {txStep === 'approving' ? `APPROVING ${tokenIn.symbol}...` : `ZAPPING INTO ${vault}...`}
                    </span>
                ) : needsApproval ? `1. APPROVE ${tokenIn.symbol}` : `2. ZAP ${amount || '0'} ${tokenIn.symbol} → ${vault} →`}
            </button>
        </div>
    )
}

// ── Optimizer confirm card ────────────────────────────────────────
function OptConfirmCard({ amount, setAmount, days, setDays, label, setLabel, needsApproval, txStep, onSubmit, refetchAllowance }: any) {
    const [splitPreview, setSplitPreview] = useState<any>(null)

    const VAULT_LABELS: Record<string, string> = {
        [YO_VAULTS.yoUSD.toLowerCase()]: 'yoUSD',
        [YO_VAULTS.yoETH.toLowerCase()]: 'yoETH',
        [YO_VAULTS.yoBTC.toLowerCase()]: 'yoBTC',
    }
    const VAULT_COLORS: Record<string, string> = { yoUSD: '#9BD600', yoETH: '#3B82F6', yoBTC: '#FF6B35' }

    const amtParsed = amount ? parseUnits(amount, 6) : 0n
    const { data: splitData } = useReadContract({
        address: FLOAT_OPTIMIZER_ADDRESS, abi: FLOAT_OPTIMIZER_ABI, functionName: 'previewSplit',
        args: amtParsed > 0n ? [amtParsed, BigInt(days)] : undefined,
        query: { enabled: amtParsed > 0n && days > 0 },
    })
    useEffect(() => {
        if (splitData) {
            const [amtBest, amtSecond, amtThird, vBest, vSecond, vThird] = splitData as any
            setSplitPreview({ amtBest, amtSecond, amtThird, vBest, vSecond, vThird })
        }
    }, [splitData])

    // APYs from contract
    const { data: apyUSD } = useReadContract({ address: FLOAT_OPTIMIZER_ADDRESS, abi: FLOAT_OPTIMIZER_ABI, functionName: 'apyYoUSD' })
    const { data: apyETH } = useReadContract({ address: FLOAT_OPTIMIZER_ADDRESS, abi: FLOAT_OPTIMIZER_ABI, functionName: 'apyYoETH' })
    const { data: apyBTC } = useReadContract({ address: FLOAT_OPTIMIZER_ADDRESS, abi: FLOAT_OPTIMIZER_ABI, functionName: 'apyYoBTC' })
    const displayApy = {
        yoUSD: apyUSD ? (Number(apyUSD) / 100).toFixed(2) : '3.18',
        yoETH: apyETH ? (Number(apyETH) / 100).toFixed(2) : '5.42',
        yoBTC: apyBTC ? (Number(apyBTC) / 100).toFixed(2) : '1.92',
    }

    const projYield = amount && splitPreview ? (() => {
        const bL = VAULT_LABELS[splitPreview.vBest.toLowerCase()] ?? 'yoUSD'
        const sL = VAULT_LABELS[splitPreview.vSecond.toLowerCase()] ?? 'yoUSD'
        const tL = VAULT_LABELS[splitPreview.vThird.toLowerCase()] ?? 'yoBTC'
        const y1 = (parseFloat(displayApy[bL as keyof typeof displayApy]) / 100 / 365) * Number(formatUnits(splitPreview.amtBest, 6)) * days
        const y2 = (parseFloat(displayApy[sL as keyof typeof displayApy]) / 100 / 365) * Number(formatUnits(splitPreview.amtSecond, 6)) * days
        const y3 = (parseFloat(displayApy[tL as keyof typeof displayApy]) / 100 / 365) * Number(formatUnits(splitPreview.amtThird, 6)) * days
        return (y1 + y2 + y3).toFixed(4)
    })() : '0.0000'
    const singleYield = amount ? ((3.18 / 100 / 365) * parseFloat(amount) * days).toFixed(4) : '0.0000'
    const isProcessing = txStep !== 'idle'

    return (
        <div className="neu-card p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <span className="neu-tag" style={{ background: '#8B5CF6', color: '#fff' }}>OPTIMIZER</span>
                <span className="font-body text-xs text-black/50">Auto-splits across yoETH / yoUSD / yoBTC</span>
            </div>
            {/* Live APYs */}
            <div className="grid grid-cols-3 gap-2">
                {(['yoUSD', 'yoETH', 'yoBTC'] as const).map(v => (
                    <div key={v} className="border border-black/10 rounded-lg p-2 text-center">
                        <span className="font-display text-xs font-bold" style={{ color: VAULT_COLORS[v] }}>{v}</span>
                        <p className="font-display text-sm font-bold mt-0.5" style={{ color: VAULT_COLORS[v] }}>{displayApy[v]}%</p>
                    </div>
                ))}
            </div>
            <div className="relative">
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="neu-input w-full pr-16 text-lg font-display" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-display text-sm text-black/40">USDC</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="font-display text-xs text-black/40 uppercase tracking-wider block mb-1.5">Days</label>
                    <input type="number" value={days} onChange={e => setDays(Number(e.target.value) || 0)} className="neu-input w-full text-sm" />
                </div>
                <div>
                    <label className="font-display text-xs text-black/40 uppercase tracking-wider block mb-1.5">Label</label>
                    <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="Savings goal" className="neu-input w-full text-sm" />
                </div>
            </div>
            {/* Split bars */}
            {splitPreview && amount && parseFloat(amount) > 0 && (
                <div className="flex flex-col gap-2">
                    <p className="font-display text-xs font-bold uppercase text-black/40 tracking-wider">Split preview</p>
                    {[
                        { vault: VAULT_LABELS[splitPreview.vBest.toLowerCase()] ?? 'yoUSD', amt: splitPreview.amtBest },
                        { vault: VAULT_LABELS[splitPreview.vSecond.toLowerCase()] ?? 'yoUSD', amt: splitPreview.amtSecond },
                        { vault: VAULT_LABELS[splitPreview.vThird.toLowerCase()] ?? 'yoBTC', amt: splitPreview.amtThird },
                    ].filter(s => s.amt > 0n).map((s, i) => {
                        const pct = Math.round((Number(formatUnits(s.amt, 6)) / parseFloat(amount)) * 100)
                        const color = VAULT_COLORS[s.vault] ?? '#888'
                        return (
                            <div key={i} className="flex items-center gap-3">
                                <span className="font-display text-xs w-14 shrink-0" style={{ color }}>{s.vault}</span>
                                <div className="flex-1 h-4 bg-black/5 rounded-sm overflow-hidden">
                                    <div className="h-full rounded-sm" style={{ width: `${pct}%`, background: color }} />
                                </div>
                                <span className="font-display text-xs w-16 text-right shrink-0">${Number(formatUnits(s.amt, 6)).toFixed(2)} ({pct}%)</span>
                            </div>
                        )
                    })}
                    <div className="grid grid-cols-2 gap-2 mt-1">
                        <div className="p-3 bg-black/5 rounded-lg text-center">
                            <p className="font-display text-xs text-black/40 uppercase mb-1">Single vault</p>
                            <p className="font-display text-base font-bold text-black/50">+${singleYield}</p>
                        </div>
                        <div className="p-3 bg-acid/15 border border-acid-dark rounded-lg text-center">
                            <p className="font-display text-xs text-acid-dark uppercase mb-1">Optimizer</p>
                            <p className="font-display text-base font-bold text-acid-dark">+${projYield}</p>
                        </div>
                    </div>
                </div>
            )}
            <button onClick={onSubmit} disabled={!amount || parseFloat(amount) <= 0 || isProcessing}
                className="neu-btn w-full" style={{ background: '#8B5CF6', color: '#fff', border: '2px solid #1A1A1A', boxShadow: '3px 3px 0 #1A1A1A' }}>
                {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                        <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {txStep === 'approving' ? 'APPROVING USDC...' : 'OPTIMIZING...'}
                    </span>
                ) : needsApproval ? '1. APPROVE USDC' : `2. OPTIMIZE $${amount || '0'} FOR MAX YIELD →`}
            </button>
        </div>
    )
}