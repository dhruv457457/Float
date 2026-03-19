'use client'

import { useState } from 'react'
import { FloatCard } from '@/components/FloatCard'
import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi'
import { formatUnits } from 'viem'
import { format, differenceInDays } from 'date-fns'
import { updateFloatStatus, type FloatEntry } from '@/lib/schedule'
import { FLOAT_OPTIMIZER_ADDRESS, FLOAT_OPTIMIZER_ABI, YO_VAULTS } from '@/lib/contracts'

const YOUSD_REDEEM_ABI = [
    {
        name: 'redeem', type: 'function', stateMutability: 'nonpayable',
        inputs: [{ name: 'shares', type: 'uint256' }, { name: 'receiver', type: 'address' }, { name: 'owner', type: 'address' }],
        outputs: [{ name: 'assets', type: 'uint256' }]
    },
] as const

const PAGE_SIZE = 3

interface Props {
    floats: FloatEntry[]
    apy: number
    onRedeemed: () => void
}

// Compact on-chain position row with emergency exit
function OnChainRow({ positionId }: { positionId: bigint }) {
    const { address } = useAccount()
    const publicClient = usePublicClient()!
    const { writeContractAsync } = useWriteContract()
    const [showEmergency, setShowEmergency] = useState(false)
    const [redeeming, setRedeeming] = useState(false)
    const [redeemed, setRedeemed] = useState(false)
    const [error, setError] = useState('')

    const { data: pos } = useReadContract({
        address: FLOAT_OPTIMIZER_ADDRESS,
        abi: FLOAT_OPTIMIZER_ABI,
        functionName: 'getPosition',
        args: [positionId],
    }) as { data: any }

    if (!pos || pos.depositedAt === 0n || redeemed) return null

    const deposited = Number(formatUnits(pos.depositedUSDC, 6))
    if (deposited < 0.01) return null

    const matureAt = new Date(Number(pos.matureAt) * 1000)
    const daysLeft = differenceInDays(matureAt, new Date())
    const isReady = daysLeft <= 0

    const vaults = [
        pos.sharesYoUSD > 0n && 'yoUSD',
        pos.sharesYoETH > 0n && 'yoETH',
        pos.sharesYoBTC > 0n && 'yoBTC',
    ].filter(Boolean) as string[]

    const COLORS: Record<string, string> = { yoUSD: '#9BD600', yoETH: '#3B82F6', yoBTC: '#FF6B35' }

    async function handleRedeem() {
        if (!address) return
        setRedeeming(true)
        setError('')
        try {
            // Step 1: optimizer sends yoUSD tokens to wallet
            const h1 = await writeContractAsync({
                address: FLOAT_OPTIMIZER_ADDRESS,
                abi: FLOAT_OPTIMIZER_ABI,
                functionName: 'redeem',
                args: [positionId],
            })
            await publicClient.waitForTransactionReceipt({ hash: h1 })

            // Step 2: redeem yoUSD from vault → USDC
            if (pos.sharesYoUSD > 0n) {
                const h2 = await writeContractAsync({
                    address: YO_VAULTS.yoUSD,
                    abi: YOUSD_REDEEM_ABI,
                    functionName: 'redeem',
                    args: [pos.sharesYoUSD, address, address],
                })
                await publicClient.waitForTransactionReceipt({ hash: h2 })
            }
            setRedeemed(true)
        } catch (e: any) {
            setError(e?.shortMessage || e?.message || 'Redeem failed')
        }
        setRedeeming(false)
    }

    return (
        <div className={`border rounded-xl p-4 bg-white flex flex-col gap-3 ${isReady ? 'border-acid-dark' : 'border-black/10'}`}>
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: '#8B5CF620', border: '1.5px solid #8B5CF6' }}>
                        <span className="font-display text-xs" style={{ color: '#8B5CF6' }}>⚡</span>
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-body font-semibold text-sm truncate">
                                {pos.label || `Position #${positionId}`}
                            </p>
                            {vaults.map(v => (
                                <span key={v} className="font-display text-[10px] px-1.5 py-0.5 rounded"
                                    style={{ background: `${COLORS[v]}22`, color: COLORS[v] }}>{v}</span>
                            ))}
                            <span className="font-display text-[10px] text-black/30">on-chain</span>
                        </div>
                        <p className="font-body text-xs text-black/40">
                            ${deposited.toFixed(2)} · {isReady ? '✓ Ready' : `${daysLeft}d left`}
                        </p>
                    </div>
                </div>
                <a href={`https://basescan.org/address/${FLOAT_OPTIMIZER_ADDRESS}`}
                    target="_blank" rel="noopener"
                    className="font-body text-xs text-blue hover:underline shrink-0">↗</a>
            </div>

            {/* Redeem now (deadline passed) */}
            {isReady && (
                <button onClick={handleRedeem} disabled={redeeming}
                    className="neu-btn neu-btn-primary w-full text-xs">
                    {redeeming ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="inline-block w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                            REDEEMING...
                        </span>
                    ) : 'REDEEM NOW — GET USDC →'}
                </button>
            )}

            {/* Emergency exit (before deadline) */}
            {!isReady && !showEmergency && (
                <button onClick={() => setShowEmergency(true)}
                    className="font-display text-xs text-black/25 hover:text-pink transition-colors text-center uppercase tracking-wider py-1">
                    ⚠ Emergency exit
                </button>
            )}

            {!isReady && showEmergency && (
                <div className="border border-pink/30 rounded-lg p-3 bg-pink/5 flex flex-col gap-2">
                    <p className="font-body text-xs text-pink/80">
                        Exiting early sends your yoUSD shares to your wallet + redeems for USDC. You keep yield earned so far.
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

            {error && <p className="font-body text-xs text-pink text-center">{error}</p>}
        </div>
    )
}

export function PaginatedFloats({ floats, apy, onRedeemed }: Props) {
    const [showAll, setShowAll] = useState(false)
    const { address } = useAccount()

    // Read on-chain positions
    const { data: positionIds } = useReadContract({
        address: FLOAT_OPTIMIZER_ADDRESS,
        abi: FLOAT_OPTIMIZER_ABI,
        functionName: 'getUserPositions',
        args: address ? [address] : undefined,
        query: { enabled: !!address, refetchInterval: 15000 },
    }) as { data: bigint[] | undefined }

    const onChainIds = positionIds ? [...positionIds].reverse() : []

    // Total count for display
    const totalCount = floats.length + onChainIds.length
    const visibleFloats = showAll ? floats : floats.slice(0, PAGE_SIZE)
    const hidden = totalCount - PAGE_SIZE

    function clearBad() {
        try {
            const raw = localStorage.getItem('float_entries')
            if (raw) {
                const entries = JSON.parse(raw)
                const clean = entries.filter((f: any) => (f.depositedAmount ?? 0) >= 0.01)
                localStorage.setItem('float_entries', JSON.stringify(clean))
            }
        } catch { }
        onRedeemed()
    }

    if (totalCount === 0) return null

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <p className="font-body text-sm font-medium text-black/40">Active floats</p>
                <div className="flex items-center gap-3">
                    <span className="font-display text-xs text-black/30">{totalCount}</span>
                    <button onClick={clearBad}
                        className="font-body text-xs text-black/20 hover:text-pink transition-colors"
                        title="Remove $0 entries">
                        ✕ clear bad
                    </button>
                </div>
            </div>

            {/* localStorage floats */}
            {visibleFloats.map(f => (
                <FloatCard key={f.id} float={f} apy={apy} onRedeemed={onRedeemed} />
            ))}

            {/* On-chain positions — shown inline after localStorage floats */}
            {(showAll || floats.length < PAGE_SIZE) && onChainIds.map(id => (
                <OnChainRow key={id.toString()} positionId={id} />
            ))}

            {/* Expand/collapse */}
            {totalCount > PAGE_SIZE && (
                <button onClick={() => setShowAll(s => !s)}
                    className="font-display text-xs text-black/40 uppercase tracking-wider hover:text-black transition-colors text-center py-2 border border-black/10 rounded-lg hover:border-black/25">
                    {showAll ? '↑ Show less' : `↓ Show ${Math.max(0, hidden)} more`}
                </button>
            )}
        </div>
    )
}