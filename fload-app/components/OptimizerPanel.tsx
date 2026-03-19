'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useReadContract, usePublicClient } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { addDays, format } from 'date-fns'
import { saveFloat } from '@/lib/schedule'
import {
    FLOAT_OPTIMIZER_ADDRESS, FLOAT_OPTIMIZER_ABI,
    TOKENS, YO_VAULTS,
} from '@/lib/contracts'

const ERC20_APPROVE_ABI = [
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

const VAULT_LABELS: Record<string, string> = {
    [YO_VAULTS.yoUSD.toLowerCase()]: 'yoUSD',
    [YO_VAULTS.yoETH.toLowerCase()]: 'yoETH',
    [YO_VAULTS.yoBTC.toLowerCase()]: 'yoBTC',
}

const VAULT_COLORS: Record<string, string> = {
    yoUSD: '#9BD600',
    yoETH: '#3B82F6',
    yoBTC: '#FF6B35',
}

interface SplitPreview {
    amtBest: bigint
    amtSecond: bigint
    amtThird: bigint
    vBest: string
    vSecond: string
    vThird: string
}

interface Props {
    onFloatCreated?: () => void
}

export function OptimizerPanel({ onFloatCreated }: Props) {
    const { address } = useAccount()
    const [amount, setAmount] = useState('')
    const [days, setDays] = useState(30)
    const [label, setLabel] = useState('')
    const [step, setStep] = useState<'input' | 'preview' | 'approving' | 'depositing' | 'done' | 'error'>('input')
    const [errorMsg, setErrorMsg] = useState('')
    const [splitPreview, setSplitPreview] = useState<SplitPreview | null>(null)
    const [txHash, setTxHash] = useState<`0x${string}` | undefined>()

    const { writeContractAsync } = useWriteContract()
    const publicClient = usePublicClient()!

    const amountParsed = amount ? parseUnits(amount, 6) : 0n // USDC has 6 decimals

    // Read live APYs from contract
    const { data: apyUSD } = useReadContract({
        address: FLOAT_OPTIMIZER_ADDRESS,
        abi: FLOAT_OPTIMIZER_ABI,
        functionName: 'apyYoUSD',
    })
    const { data: apyETH } = useReadContract({
        address: FLOAT_OPTIMIZER_ADDRESS,
        abi: FLOAT_OPTIMIZER_ABI,
        functionName: 'apyYoETH',
    })
    const { data: apyBTC } = useReadContract({
        address: FLOAT_OPTIMIZER_ADDRESS,
        abi: FLOAT_OPTIMIZER_ABI,
        functionName: 'apyYoBTC',
    })

    // Read split preview from contract
    const { data: splitData } = useReadContract({
        address: FLOAT_OPTIMIZER_ADDRESS,
        abi: FLOAT_OPTIMIZER_ABI,
        functionName: 'previewSplit',
        args: amountParsed > 0n ? [amountParsed, BigInt(days)] : undefined,
        query: { enabled: amountParsed > 0n && days > 0 },
    })

    useEffect(() => {
        if (splitData) {
            const [amtBest, amtSecond, amtThird, vBest, vSecond, vThird] = splitData as any
            setSplitPreview({ amtBest, amtSecond, amtThird, vBest, vSecond, vThird })
        }
    }, [splitData])

    // Check USDC allowance
    const { data: allowance } = useReadContract({
        address: TOKENS.USDC.address,
        abi: ERC20_APPROVE_ABI,
        functionName: 'allowance',
        args: address ? [address, FLOAT_OPTIMIZER_ADDRESS] : undefined,
        query: { enabled: !!address },
    })
    const needsApproval = amountParsed > 0n && (allowance ?? 0n) < amountParsed

    // Displayed APYs (from contract, basis points → percent)
    const displayApy = {
        yoUSD: apyUSD ? (Number(apyUSD) / 100).toFixed(2) : '3.18',
        yoETH: apyETH ? (Number(apyETH) / 100).toFixed(2) : '5.42',
        yoBTC: apyBTC ? (Number(apyBTC) / 100).toFixed(2) : '1.92',
    }

    // Projected yield from optimizer (weighted average)
    const projYield = amount && splitPreview
        ? (() => {
            const total = parseFloat(amount)
            const bestAmt = Number(formatUnits(splitPreview.amtBest, 6))
            const secAmt = Number(formatUnits(splitPreview.amtSecond, 6))
            const thirdAmt = Number(formatUnits(splitPreview.amtThird, 6))
            const bestLabel = VAULT_LABELS[splitPreview.vBest.toLowerCase()] ?? 'yoUSD'
            const secLabel = VAULT_LABELS[splitPreview.vSecond.toLowerCase()] ?? 'yoUSD'
            const thirdLabel = VAULT_LABELS[splitPreview.vThird.toLowerCase()] ?? 'yoUSD'
            const y1 = (parseFloat(displayApy[bestLabel as keyof typeof displayApy]) / 100 / 365) * bestAmt * days
            const y2 = (parseFloat(displayApy[secLabel as keyof typeof displayApy]) / 100 / 365) * secAmt * days
            const y3 = (parseFloat(displayApy[thirdLabel as keyof typeof displayApy]) / 100 / 365) * thirdAmt * days
            return (y1 + y2 + y3).toFixed(4)
        })()
        : '0.0000'

    const singleVaultYield = amount
        ? ((3.18 / 100 / 365) * parseFloat(amount) * days).toFixed(4)
        : '0.0000'

    const optimizerBoost = amount
        ? (parseFloat(projYield) - parseFloat(singleVaultYield)).toFixed(4)
        : '0.0000'

    async function handleDeposit() {
        if (!address || !amount) return

        // 1. Approve if needed — wait for confirmation before depositing
        if (needsApproval) {
            setStep('approving')
            try {
                const approveTx = await writeContractAsync({
                    address: TOKENS.USDC.address,
                    abi: ERC20_APPROVE_ABI,
                    functionName: 'approve',
                    args: [FLOAT_OPTIMIZER_ADDRESS, amountParsed],
                })
                // Wait for approval to be mined before proceeding
                await publicClient.waitForTransactionReceipt({ hash: approveTx })
            } catch (e: any) {
                setStep('error')
                setErrorMsg(e?.shortMessage || e?.message || 'Approval failed')
                return
            }
        }

        // 2. Deposit into optimizer
        setStep('depositing')
        const matureAt = BigInt(Math.floor(addDays(new Date(), days).getTime() / 1000))
        try {
            const hash = await writeContractAsync({
                address: FLOAT_OPTIMIZER_ADDRESS,
                abi: FLOAT_OPTIMIZER_ABI,
                functionName: 'deposit',
                args: [amountParsed, matureAt, label || `Optimizer float (${days}d)`],
            })

            setTxHash(hash)

            // Save locally for dashboard
            saveFloat({
                id: crypto.randomUUID(),
                label: label || `Optimizer float (${days}d)`,
                vault: 'yoUSD', // primary vault label for display
                depositedAmount: parseFloat(amount),
                shares: '0',
                depositedAt: new Date().toISOString(),
                redeemAt: addDays(new Date(), days - 1).toISOString(),
                neededAt: addDays(new Date(), days).toISOString(),
                status: 'active',
                txHash: hash,
            })

            setStep('done')
            onFloatCreated?.()
        } catch (e: any) {
            setStep('error')
            setErrorMsg(e?.shortMessage || e?.message || 'Deposit failed')
        }
    }

    if (step === 'done') return (
        <div className="neu-card p-8 flex flex-col items-center gap-4 animate-float-in">
            <div className="w-16 h-16 rounded-full bg-acid border-2 border-black flex items-center justify-center">
                <span className="font-display text-2xl">⚡</span>
            </div>
            <p className="font-display font-bold text-xl">OPTIMIZER ACTIVE</p>
            <p className="font-body text-center text-black/60 max-w-sm">
                ${amount} split across vaults for maximum yield.
                Projected: <span className="font-bold text-acid-dark">+${projYield}</span>
            </p>
            {txHash && (
                <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noopener"
                    className="font-body text-xs text-blue hover:underline">View on BaseScan ↗</a>
            )}
            <button onClick={() => { setStep('input'); setAmount(''); setLabel('') }}
                className="neu-btn neu-btn-secondary">
                OPTIMIZE AGAIN
            </button>
        </div>
    )

    return (
        <div className="flex flex-col gap-4">
            <div className="neu-card p-5">
                <div className="flex items-center gap-2 mb-4">
                    <span className="neu-tag bg-purple text-white" style={{ background: '#8B5CF6' }}>OPTIMIZER</span>
                    <span className="font-display text-xs text-black/50 uppercase tracking-wider">
                        Auto-splits across vaults for max APY
                    </span>
                </div>

                {/* Live on-chain APYs from contract */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                    {(['yoUSD', 'yoETH', 'yoBTC'] as const).map(v => (
                        <div key={v} className="border border-black/10 rounded-lg p-3 text-center">
                            <span className="font-display text-xs font-bold" style={{ color: VAULT_COLORS[v] }}>{v}</span>
                            <p className="font-display text-lg font-bold mt-0.5" style={{ color: VAULT_COLORS[v] }}>
                                {displayApy[v]}%
                            </p>
                            <p className="font-body text-xs text-black/35">APY</p>
                        </div>
                    ))}
                </div>

                {/* Inputs */}
                <div className="flex flex-col gap-3">
                    <div>
                        <label className="font-display text-xs text-black/40 uppercase tracking-wider block mb-1.5">
                            USDC amount
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="neu-input w-full pr-16 text-lg font-display"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-display text-sm text-black/40">
                                USDC
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="font-display text-xs text-black/40 uppercase tracking-wider block mb-1.5">Days</label>
                            <input type="number" value={days} onChange={e => setDays(Number(e.target.value) || 0)}
                                className="neu-input w-full text-sm" />
                        </div>
                        <div>
                            <label className="font-display text-xs text-black/40 uppercase tracking-wider block mb-1.5">Label</label>
                            <input type="text" value={label} onChange={e => setLabel(e.target.value)}
                                placeholder="Savings goal" className="neu-input w-full text-sm" />
                        </div>
                    </div>
                </div>

                {/* Split preview */}
                {splitPreview && amount && parseFloat(amount) > 0 && (
                    <div className="mt-4 flex flex-col gap-2">
                        <p className="font-display text-xs font-bold uppercase text-black/40 tracking-wider mb-1">
                            Optimizer split preview
                        </p>
                        {[
                            { vault: VAULT_LABELS[splitPreview.vBest.toLowerCase()] ?? 'yoUSD', amt: splitPreview.amtBest },
                            { vault: VAULT_LABELS[splitPreview.vSecond.toLowerCase()] ?? 'yoUSD', amt: splitPreview.amtSecond },
                            { vault: VAULT_LABELS[splitPreview.vThird.toLowerCase()] ?? 'yoUSD', amt: splitPreview.amtThird },
                        ].filter(s => s.amt > 0n).map((s, i) => {
                            const pct = Math.round((Number(formatUnits(s.amt, 6)) / parseFloat(amount)) * 100)
                            const color = VAULT_COLORS[s.vault] ?? '#888'
                            return (
                                <div key={i} className="flex items-center gap-3">
                                    <span className="font-display text-xs w-14 shrink-0" style={{ color }}>{s.vault}</span>
                                    <div className="flex-1 h-5 bg-black/5 rounded-sm overflow-hidden">
                                        <div className="h-full rounded-sm transition-all" style={{ width: `${pct}%`, background: color }} />
                                    </div>
                                    <span className="font-display text-xs text-right w-20 shrink-0">
                                        ${Number(formatUnits(s.amt, 6)).toFixed(2)} ({pct}%)
                                    </span>
                                </div>
                            )
                        })}

                        {/* Yield comparison */}
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            <div className="p-3 bg-black/5 rounded-lg text-center">
                                <p className="font-display text-xs text-black/40 uppercase mb-1">Single vault (yoUSD)</p>
                                <p className="font-display text-base font-bold text-black/50">+${singleVaultYield}</p>
                            </div>
                            <div className="p-3 bg-acid/15 border border-acid-dark rounded-lg text-center">
                                <p className="font-display text-xs text-acid-dark uppercase mb-1">Optimizer yield</p>
                                <p className="font-display text-base font-bold text-acid-dark">+${projYield}</p>
                            </div>
                        </div>
                        {parseFloat(optimizerBoost) > 0 && (
                            <p className="font-display text-xs text-center text-acid-dark font-bold">
                                +${optimizerBoost} extra vs single vault
                            </p>
                        )}
                    </div>
                )}

                {step === 'error' && (
                    <div className="mt-3 p-3 rounded-lg bg-pink/10 border border-pink">
                        <p className="font-body text-xs text-pink">{errorMsg}</p>
                        <button onClick={() => setStep('input')} className="font-display text-xs text-pink/60 hover:text-pink mt-1">
                            Try again
                        </button>
                    </div>
                )}

                <button
                    onClick={handleDeposit}
                    disabled={!amount || parseFloat(amount) <= 0 || step === 'approving' || step === 'depositing'}
                    className="neu-btn w-full mt-4"
                    style={{ background: '#8B5CF6', color: '#fff', border: '2px solid #1A1A1A', boxShadow: '3px 3px 0 #1A1A1A' }}
                >
                    {step === 'approving' ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            APPROVING USDC...
                        </span>
                    ) : step === 'depositing' ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            OPTIMIZING...
                        </span>
                    ) : needsApproval ? (
                        'APPROVE USDC THEN OPTIMIZE →'
                    ) : (
                        `⚡ OPTIMIZE $${amount || '0'} FOR MAX YIELD →`
                    )}
                </button>

                <p className="font-body text-xs text-black/30 text-center mt-2">
                    FloatOptimizer contract auto-splits across all 3 YO vaults
                </p>
            </div>
        </div>
    )
}