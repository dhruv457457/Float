'use client'

import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi'
import { getAddress } from 'viem'
import { formatUnits } from 'viem'
import { useState } from 'react'
import { format, differenceInDays } from 'date-fns'
import {
    FLOAT_OPTIMIZER_ADDRESS,
    FLOAT_OPTIMIZER_ABI,
    BASESCAN,
    YO_VAULTS,
} from '@/lib/contracts'

const YOUSD_REDEEM_ABI = [
    {
        name: 'redeem', type: 'function', stateMutability: 'nonpayable',
        inputs: [
            { name: 'shares', type: 'uint256' },
            { name: 'receiver', type: 'address' },
            { name: 'owner', type: 'address' },
        ],
        outputs: [{ name: 'assets', type: 'uint256' }]
    },
    {
        name: 'balanceOf', type: 'function', stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }]
    },
] as const

interface Position {
    sharesYoUSD: bigint
    sharesYoETH: bigint
    sharesYoBTC: bigint
    depositedUSDC: bigint
    depositedAt: bigint
    matureAt: bigint
    label: string
}

function PositionCard({
    positionId,
    onRedeemed,
}: {
    positionId: bigint
    onRedeemed: () => void
}) {
    const [redeeming, setRedeeming] = useState(false)
    const [redeemTx, setRedeemTx] = useState<`0x${string}` | undefined>()
    const [redeemError, setRedeemError] = useState('')
    const [redeemed, setRedeemed] = useState(false)
    const [redeemStep, setRedeemStep] = useState('')

    const { address } = useAccount()
    const publicClient = usePublicClient()!
    const { writeContractAsync } = useWriteContract()

    const { data: position } = useReadContract({
        address: FLOAT_OPTIMIZER_ADDRESS,
        abi: FLOAT_OPTIMIZER_ABI,
        functionName: 'getPosition',
        args: [positionId],
    }) as { data: Position | undefined }

    const { data: value } = useReadContract({
        address: FLOAT_OPTIMIZER_ADDRESS,
        abi: FLOAT_OPTIMIZER_ABI,
        functionName: 'getPositionValue',
        args: [positionId],
    }) as { data: [bigint, bigint, bigint, bigint] | undefined }

    if (!position || position.depositedAt === 0n) return null

    const depositedUSDC = Number(formatUnits(position.depositedUSDC, 6))
    const currentValueUSD = value ? Number(formatUnits(value[1], 6)) : depositedUSDC
    const yieldEarned = Math.max(0, currentValueUSD - depositedUSDC)
    const matureAt = new Date(Number(position.matureAt) * 1000)
    const depositedAt = new Date(Number(position.depositedAt) * 1000)
    const daysLeft = differenceInDays(matureAt, new Date())
    const totalDays = differenceInDays(matureAt, depositedAt)
    const elapsed = differenceInDays(new Date(), depositedAt)
    const progress = totalDays > 0 ? Math.min(100, (elapsed / totalDays) * 100) : 0
    const isReady = daysLeft <= 0

    const borderColor = isReady
        ? 'border-acid-dark bg-acid/5'
        : daysLeft <= 3
            ? 'border-orange/50 bg-orange/3'
            : 'border-black/10'

    async function handleRedeem() {
        if (!address) return
        setRedeeming(true)
        setRedeemError('')
        try {
            // Step 1: optimizer.redeem() → sends yoUSD tokens to wallet
            setRedeemStep('Getting yoUSD tokens...')
            const hash1 = await writeContractAsync({
                address: FLOAT_OPTIMIZER_ADDRESS,
                abi: FLOAT_OPTIMIZER_ABI,
                functionName: 'redeem',
                args: [positionId],
            })
            setRedeemTx(hash1)
            await publicClient.waitForTransactionReceipt({ hash: hash1 })

            // Step 2: redeem yoUSD tokens directly from the YO vault → USDC
            setRedeemStep('Converting to USDC...')
            const yoUSDShares = position?.sharesYoUSD ?? 0n
            if (yoUSDShares > 0n) {
                const hash2 = await writeContractAsync({
                    address: YO_VAULTS.yoUSD,
                    abi: YOUSD_REDEEM_ABI,
                    functionName: 'redeem',
                    args: [yoUSDShares, address, address],
                })
                await publicClient.waitForTransactionReceipt({ hash: hash2 })
                setRedeemTx(hash2)
            }

            setRedeemed(true)
            onRedeemed()
        } catch (e: any) {
            setRedeemError(e?.shortMessage || e?.message || 'Redeem failed')
        }
        setRedeemStep('')
        setRedeeming(false)
    }

    if (redeemed) return (
        <div className="border-2 border-acid-dark rounded-xl p-5 bg-acid/5 flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <span className="font-display text-sm font-bold">
                    ✓ {position.label || `Position #${positionId}`}
                </span>
                <span className="neu-tag bg-acid text-xs">REDEEMED</span>
            </div>
            {redeemTx && (
                <a
                    href={`https://basescan.org/tx/${redeemTx}`}
                    target="_blank"
                    rel="noopener"
                    className="font-body text-xs text-blue hover:underline"
                >
                    View redemption tx ↗
                </a>
            )}
        </div>
    )

    return (
        <div className={`border-2 rounded-xl p-5 bg-white flex flex-col gap-3 transition-all ${borderColor}`}>

            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <p className="font-body font-semibold text-sm">
                        {position.label || `Position #${positionId}`}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="soft-tag bg-black/5 text-black/50 text-xs">
                            #{positionId.toString()}
                        </span>
                        <span className="soft-tag bg-acid/20 text-acid-dark text-xs">
                            FloatOptimizer · on-chain
                        </span>
                    </div>
                </div>
                <div className="text-right">
                    {isReady ? (
                        <span className="flex items-center gap-1.5">
                            <span className="inline-block w-2 h-2 rounded-full bg-acid animate-pulse" />
                            <span className="font-display text-xs text-acid-dark font-bold">READY</span>
                        </span>
                    ) : (
                        <span className="font-display text-xs text-black/40">{daysLeft}d left</span>
                    )}
                </div>
            </div>

            {/* Deposited + yield */}
            <div className="flex justify-between items-center font-body text-sm">
                <span className="text-black/45">${depositedUSDC.toFixed(2)} deposited</span>
                <span className="font-display font-bold text-acid-dark">
                    +${yieldEarned.toFixed(4)} earned
                </span>
            </div>

            {/* Shares held by contract */}
            <div className="p-3 rounded-lg bg-black/3 flex flex-col gap-1">
                <p className="font-display text-xs text-black/35 uppercase tracking-wider mb-0.5">
                    Vault shares held by contract
                </p>
                {position.sharesYoUSD > 0n && (
                    <div className="flex justify-between font-display text-xs">
                        <span style={{ color: '#9BD600' }}>yoUSD</span>
                        <span className="text-black/50">{position.sharesYoUSD.toString()} shares</span>
                    </div>
                )}
                {position.sharesYoETH > 0n && (
                    <div className="flex justify-between font-display text-xs">
                        <span style={{ color: '#3B82F6' }}>yoETH</span>
                        <span className="text-black/50">{position.sharesYoETH.toString()} shares</span>
                    </div>
                )}
                {position.sharesYoBTC > 0n && (
                    <div className="flex justify-between font-display text-xs">
                        <span style={{ color: '#FF6B35' }}>yoBTC</span>
                        <span className="text-black/50">{position.sharesYoBTC.toString()} shares</span>
                    </div>
                )}
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-black/5 rounded-full overflow-hidden">
                <div
                    className="h-full bg-acid rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                />
            </div>
            <div className="flex justify-between font-body text-xs text-black/30">
                <span>Deposited {format(depositedAt, 'MMM d')}</span>
                <span>Ready {format(matureAt, 'MMM d, yyyy')}</span>
            </div>

            {/* Redeem button — always visible */}
            <button
                onClick={handleRedeem}
                disabled={redeeming}
                className={`neu-btn w-full text-xs mt-1 ${isReady ? 'neu-btn-primary' : 'neu-btn-secondary'
                    }`}
            >
                {redeeming ? (
                    <span className="flex items-center justify-center gap-2">
                        <span className="inline-block w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        REDEEMING...
                    </span>
                ) : isReady
                    ? 'REDEEM NOW — GET USDC + YIELD →'
                    : `REDEEM EARLY (${daysLeft}d before deadline)`
                }
            </button>

            {redeemError && (
                <p className="font-body text-xs text-pink text-center mt-1">{redeemError}</p>
            )}
        </div>
    )
}

export function OnChainPositions() {
    const { address } = useAccount()
    const [refreshKey, setRefreshKey] = useState(0)

    const { data: positionIds, isLoading } = useReadContract({
        address: FLOAT_OPTIMIZER_ADDRESS,
        abi: FLOAT_OPTIMIZER_ABI,
        functionName: 'getUserPositions',
        args: address ? [address] : undefined,
        query: { enabled: !!address, refetchInterval: 15000 },
    }) as { data: bigint[] | undefined; isLoading: boolean }

    if (!address) return null
    if (isLoading) return (
        <div className="p-4 text-center">
            <span className="font-display text-xs text-black/30 uppercase animate-pulse">
                Loading on-chain positions...
            </span>
        </div>
    )
    if (!positionIds || positionIds.length === 0) return null

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <p className="font-body text-sm font-medium text-black/40">
                        On-chain positions
                    </p>
                    <span className="soft-tag bg-acid/20 text-acid-dark text-xs">
                        FloatOptimizer
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="font-display text-xs text-black/30">
                        {positionIds.length} position{positionIds.length > 1 ? 's' : ''}
                    </span>
                    <a
                        href={BASESCAN.floatOptimizer}
                        target="_blank"
                        rel="noopener"
                        className="font-body text-xs text-blue hover:underline"
                    >
                        Contract ↗
                    </a>
                </div>
            </div>

            {[...positionIds].reverse().map(id => (
                <PositionCard
                    key={`${id}-${refreshKey}`}
                    positionId={id}
                    onRedeemed={() => setRefreshKey(k => k + 1)}
                />
            ))}
        </div>
    )
}