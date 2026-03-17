'use client'

import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Link from 'next/link'

export default function Home() {
    const { isConnected } = useAccount()

    return (
        <div className="min-h-screen bg-cream flex flex-col">
            {/* Marquee ticker */}
            <div className="w-full border-b-neu border-black bg-acid overflow-hidden">
                <div className="marquee-track py-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <span key={i} className="font-display text-sm font-bold tracking-wider whitespace-nowrap px-8">
                            YIELD WHILE YOU WAIT &bull; EARN ON IDLE STABLECOINS &bull; POWERED BY YO PROTOCOL &bull; BASE CHAIN &bull; AUTO-REDEEM &bull; AI-POWERED SAVINGS &bull;&nbsp;
                        </span>
                    ))}
                </div>
            </div>

            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b-neu border-black">
                <div className="font-display text-2xl font-bold tracking-tight">
                    FLOAT<span className="text-acid-dark">.</span>
                </div>
                <div className="flex items-center gap-3">
                    <a href="https://yo.xyz" target="_blank" rel="noopener" className="neu-tag bg-white">
                        Built on YO
                    </a>
                    {isConnected ? (
                        <Link href="/dashboard" className="neu-btn neu-btn-primary">
                            OPEN APP →
                        </Link>
                    ) : (
                        <ConnectButton />
                    )}
                </div>
            </header>

            {/* Hero */}
            <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
                <div className="max-w-3xl w-full flex flex-col items-center text-center gap-8">
                    <div className="relative">
                        <h1 className="font-display text-6xl md:text-8xl font-bold leading-none tracking-tighter">
                            YIELD ON
                            <br />
                            MONEY YOU
                            <br />
                            <span className="relative inline-block">
                                <span className="relative z-10">WERE GOING</span>
                                <span className="absolute bottom-1 left-0 w-full h-4 bg-acid -z-0" />
                            </span>
                            <br />
                            TO SPEND
                            <br />
                            ANYWAY
                        </h1>
                    </div>

                    <p className="font-body text-lg md:text-xl max-w-md leading-relaxed text-black/70">
                        Tell FLOAT what you're saving for. It deposits into YO Protocol vaults,
                        earns yield, and returns your money exactly when you need it.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">
                        {[
                            { step: '01', title: 'TELL IT', desc: '"$800 for rent in 25 days"', color: 'bg-acid' },
                            { step: '02', title: 'FLOAT IT', desc: 'AI picks the best YO vault', color: 'bg-blue text-white' },
                            { step: '03', title: 'GET IT', desc: 'Money + yield, on time', color: 'bg-pink text-white' },
                        ].map((item) => (
                            <div key={item.step} className="neu-card p-5 flex flex-col gap-2">
                                <div className={`neu-tag ${item.color} w-fit`}>{item.step}</div>
                                <p className="font-display font-bold text-lg">{item.title}</p>
                                <p className="font-body text-sm text-black/60">{item.desc}</p>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col items-center gap-4 mt-4">
                        {isConnected ? (
                            <Link href="/dashboard" className="neu-btn neu-btn-primary text-lg px-10 py-4">
                                LAUNCH APP →
                            </Link>
                        ) : (
                            <ConnectButton />
                        )}
                        <p className="font-display text-xs text-black/40 uppercase tracking-wider">
                            {isConnected ? 'Wallet connected — enter the app' : 'Connect wallet to start floating'}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
                        {['Base Chain', 'ERC-4626 Vaults', 'Non-Custodial', 'Audited Protocol'].map(badge => (
                            <span key={badge} className="neu-tag bg-cream">{badge}</span>
                        ))}
                    </div>
                </div>
            </main>

            {/* Footer ticker */}
            <div className="w-full border-t-neu border-black bg-black overflow-hidden">
                <div className="marquee-track py-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <span key={i} className="font-display text-sm font-bold tracking-wider whitespace-nowrap px-8 text-acid">
                            yoUSD &bull; yoETH &bull; yoBTC &bull; SMART SAVINGS &bull; AI-POWERED &bull; ZERO FEES &bull; AUTO-REDEEM &bull;&nbsp;
                        </span>
                    ))}
                </div>
            </div>
        </div>
    )
}