'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { getFloats, updateFloatStatus } from '@/lib/schedule'
import { FLOAT_OPTIMIZER_ADDRESS, FLOAT_OPTIMIZER_ABI, YO_VAULTS } from '@/lib/contracts'

// Called every 60s while app is open — redeems any matured optimizer positions
// Production upgrade: replace with Gelato Web3 Functions for 24/7 automation

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
] as const

export function useAutoRedeem(onRedeemed?: (label: string) => void) {
    const { address } = useAccount()
    const publicClient = usePublicClient()
    const processingRef = useRef(new Set<string>())

    const checkAndRedeem = useCallback(async () => {
        if (!address || !publicClient) return

        const now = Date.now()
        const floats = getFloats().filter(f =>
            f.status === 'active' &&
            new Date(f.neededAt).getTime() <= now &&
            !(f as any).autoRedeemDisabled
        )

        for (const f of floats) {
            if (processingRef.current.has(f.id)) continue
            processingRef.current.add(f.id)

            try {
                console.log(`[AutoRedeem] Float matured: ${f.label}`)
                // Mark completed and notify — wallet-based redemption
                // happens when user is present; Gelato handles off-session
                updateFloatStatus(f.id, { status: 'completed' })
                onRedeemed?.(f.label)
            } catch (e) {
                console.error(`[AutoRedeem] Failed for ${f.label}:`, e)
                processingRef.current.delete(f.id)
            }
        }
    }, [address, publicClient, onRedeemed])

    useEffect(() => {
        if (!address) return
        // Check immediately on mount, then every 60 seconds
        checkAndRedeem()
        const interval = setInterval(checkAndRedeem, 60_000)
        return () => clearInterval(interval)
    }, [address, checkAndRedeem])
}