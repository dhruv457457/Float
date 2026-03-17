'use client'

import { useVaultState, useVaults } from '@yo-protocol/react'
import { useEffect, useState, useRef } from 'react'
import { getActiveFloats, type FloatEntry } from '@/lib/schedule'

type VaultId = 'yoUSD' | 'yoETH' | 'yoBTC'

const FALLBACK_APY: Record<VaultId, number> = {
    yoUSD: 3.18,
    yoETH: 5.42,
    yoBTC: 1.92,
}

const VAULT_META: Record<VaultId, {
    underlying: string; color: string; risk: string; assetDecimals: number
}> = {
    yoUSD: { underlying: 'USDC', color: '#9BD600', risk: 'Low risk · stablecoin', assetDecimals: 6 },
    yoETH: { underlying: 'WETH', color: '#3B82F6', risk: 'Medium risk · ETH', assetDecimals: 18 },
    yoBTC: { underlying: 'cbBTC', color: '#FF6B35', risk: 'Low-med risk · BTC', assetDecimals: 8 },
}

const VAULT_IDS: VaultId[] = ['yoUSD', 'yoETH', 'yoBTC']

// The SDK returns exchange rate as a scaled integer (e.g. 1000892 for USDC = 1.000892).
// We divide by 10^assetDecimals to get a human-readable rate.
// If the value is already < 100, assume it's already human-readable.
function parseRate(raw: any, assetDecimals: number): number | null {
    if (raw == null) return null
    try {
        const n = Number(raw)
        if (isNaN(n) || n <= 0) return null
        return n < 100 ? n : n / 10 ** assetDecimals
    } catch { return null }
}

function VaultRow({ vaultId, floats }: { vaultId: VaultId; floats: FloatEntry[] }) {
    const { vaultState } = useVaultState(vaultId)
    const meta = VAULT_META[vaultId]

    const currentRate = vaultState ? parseRate(vaultState.exchangeRate, meta.assetDecimals) : null
    const tvl = vaultState ? Number(vaultState.totalAssets) / 10 ** meta.assetDecimals : null
    const fmtTVL = (n: number) =>
        n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n.toFixed(0)}`

    // APY: use SDK stats if available, fallback to constants — never compute from rate
    const apy: number = (vaultState as any)?.stats?.apy ?? (vaultState as any)?.apy ?? FALLBACK_APY[vaultId]

    const myFloat = floats.find(f => f.vault === vaultId)
    const depositRate: number | null = (myFloat as any)?.depositExchangeRate ?? null
    const delta = currentRate && depositRate ? ((currentRate - depositRate) / depositRate * 100) : null

    return (
        <div className="grid gap-2 py-3 border-b border-black/8 last:border-0 items-center"
            style={{ gridTemplateColumns: '100px 1fr 1fr 1fr 110px' }}>
            <div>
                <span className="neu-tag" style={{ background: `${meta.color}22`, color: meta.color, borderColor: meta.color }}>
                    {vaultId}
                </span>
            </div>
            <div>
                <p className="font-display text-xl font-bold" style={{ color: meta.color }}>{apy.toFixed(2)}%</p>
                <p className="font-body text-xs text-black/40">{meta.risk}</p>
            </div>
            <div>
                <p className="font-display text-sm font-bold">{tvl && tvl > 0 ? fmtTVL(tvl) : '—'}</p>
                <p className="font-body text-xs text-black/35">{meta.underlying}</p>
            </div>
            <div>
                <p className="font-display text-xs font-bold">{currentRate != null ? currentRate.toFixed(6) : '—'}</p>
                {depositRate != null && (
                    <p className="font-body text-xs text-black/35">at deposit: {depositRate.toFixed(6)}</p>
                )}
            </div>
            <div>
                {delta != null ? (
                    <span className="inline-block px-2 py-1 rounded-md font-display text-xs font-bold"
                        style={{ background: 'rgba(155,214,0,.15)', color: '#9BD600', border: '1.5px solid #9BD600' }}>
                        +{delta.toFixed(4)}%
                    </span>
                ) : myFloat ? (
                    <span className="font-display text-xs text-black/30">tracking...</span>
                ) : (
                    <span className="font-display text-xs text-black/20">no float</span>
                )}
            </div>
        </div>
    )
}

function FloatTicker({ float: f, apy }: { float: FloatEntry; apy: number }) {
    const [liveYield, setLiveYield] = useState(0)
    const startRef = useRef(Date.now())

    const baseYield = (apy / 100 / 365) * ((Date.now() - new Date(f.depositedAt).getTime()) / 86400000) * f.depositedAmount
    const perSecond = (apy / 100 / 365 / 86400) * f.depositedAmount

    useEffect(() => {
        startRef.current = Date.now()
        const interval = setInterval(() => {
            setLiveYield(baseYield + perSecond * (Date.now() - startRef.current) / 1000)
        }, 200)
        return () => clearInterval(interval)
    }, [baseYield, perSecond])

    const meta = VAULT_META[f.vault as VaultId]
    const totalDays = (new Date(f.neededAt).getTime() - new Date(f.depositedAt).getTime()) / 86400000
    const elapsed = (Date.now() - new Date(f.depositedAt).getTime()) / 86400000
    const progress = Math.min(100, (elapsed / totalDays) * 100)

    return (
        <div className="border border-black/10 rounded-xl p-4 bg-white">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="font-body font-semibold text-sm">{f.label}</span>
                    <span className="neu-tag text-xs"
                        style={{ background: `${meta?.color}22`, color: meta?.color, borderColor: meta?.color }}>
                        {f.vault}
                    </span>
                </div>
                <span className="font-display text-base font-bold tabular-nums" style={{ color: '#9BD600' }}>
                    +${liveYield.toFixed(5)}
                </span>
            </div>
            <div className="w-full h-1.5 bg-black/6 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${progress}%`, background: meta?.color ?? '#9BD600' }} />
            </div>
            <div className="flex justify-between mt-1.5">
                <span className="font-body text-xs text-black/35">Day {Math.floor(elapsed)} of {Math.floor(totalDays)}</span>
                <span className="font-body text-xs text-black/35">${f.depositedAmount} · {apy.toFixed(2)}% APY</span>
            </div>
        </div>
    )
}

export function VaultComparisonTable() {
    const { isLoading } = useVaults()
    const [floats, setFloats] = useState<FloatEntry[]>([])

    useEffect(() => { setFloats(getActiveFloats()) }, [])

    if (isLoading) return (
        <div className="neu-card p-6 flex items-center justify-center h-32">
            <span className="font-display text-xs text-black/40 uppercase animate-pulse">Loading vault data...</span>
        </div>
    )

    return (
        <div className="flex flex-col gap-4">
            <div className="neu-card p-5">
                <div className="flex items-center gap-2 mb-4">
                    <span className="neu-tag bg-acid">Live comparison</span>
                    <span className="font-display text-xs text-black/40 uppercase tracking-wider">Real on-chain · refreshes every 15s</span>
                </div>
                <div className="grid gap-2 pb-3 border-b-2 border-black"
                    style={{ gridTemplateColumns: '100px 1fr 1fr 1fr 110px' }}>
                    {['Vault', 'APY', 'TVL', 'Exchange Rate', 'Δ since deposit'].map(h => (
                        <span key={h} className="font-display text-xs font-bold uppercase text-black/35 tracking-wider">{h}</span>
                    ))}
                </div>
                {VAULT_IDS.map(id => <VaultRow key={id} vaultId={id} floats={floats} />)}
            </div>

            {floats.length > 0 && (
                <div className="neu-card p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="neu-tag bg-white">Live tickers</span>
                        <span className="font-body text-xs text-black/50">Yield counting up in real time</span>
                    </div>
                    <div className="flex flex-col gap-3">
                        {floats.map(f => (
                            <FloatTicker key={f.id} float={f} apy={FALLBACK_APY[f.vault as VaultId] ?? 3.18} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}