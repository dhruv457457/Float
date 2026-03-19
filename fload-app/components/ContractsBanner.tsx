'use client'

import { FLOAT_ZAP_ADDRESS, FLOAT_OPTIMIZER_ADDRESS, BASESCAN } from '@/lib/contracts'

export function ContractsBanner() {
    return (
        <div className="flex flex-wrap items-center gap-3 mb-6 p-4 rounded-xl border-2 border-black/10 bg-white">
            <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-acid animate-pulse" />
                <span className="font-display text-xs font-bold uppercase tracking-wider text-black/50">
                    Live on Base
                </span>
            </div>

            <div className="flex flex-wrap gap-2">
                <a
                    href={BASESCAN.floatZap}
                    target="_blank"
                    rel="noopener"
                    className="neu-tag bg-acid hover:bg-acid-dark transition-colors cursor-pointer"
                    title={FLOAT_ZAP_ADDRESS}
                >
                    FloatZap ↗
                </a>
                <a
                    href={BASESCAN.floatOptimizer}
                    target="_blank"
                    rel="noopener"
                    className="neu-tag bg-acid hover:bg-acid-dark transition-colors cursor-pointer"
                    title={FLOAT_OPTIMIZER_ADDRESS}
                >
                    FloatOptimizer ↗
                </a>
            </div>

            <div className="hidden md:flex items-center gap-4 ml-auto font-display text-xs text-black/30">
                <span title={FLOAT_ZAP_ADDRESS}>
                    Zap: {FLOAT_ZAP_ADDRESS.slice(0, 6)}...{FLOAT_ZAP_ADDRESS.slice(-4)}
                </span>
                <span title={FLOAT_OPTIMIZER_ADDRESS}>
                    Opt: {FLOAT_OPTIMIZER_ADDRESS.slice(0, 6)}...{FLOAT_OPTIMIZER_ADDRESS.slice(-4)}
                </span>
            </div>
        </div>
    )
}