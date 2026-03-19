'use client'

import { useAccount, usePublicClient } from 'wagmi'
import { useState, useEffect } from 'react'
import { formatUnits } from 'viem'
import { FLOAT_ZAP_ADDRESS, FLOAT_ZAP_ABI, YO_VAULTS } from '@/lib/contracts'

const VAULT_LABELS: Record<string, string> = {
  [YO_VAULTS.yoUSD.toLowerCase()]: 'yoUSD',
  [YO_VAULTS.yoETH.toLowerCase()]: 'yoETH',
  [YO_VAULTS.yoBTC.toLowerCase()]: 'yoBTC',
}

const VAULT_COLORS: Record<string, string> = {
  yoUSD: '#9BD600', yoETH: '#3B82F6', yoBTC: '#FF6B35',
}

const TOKEN_SYMBOLS: Record<string, string> = {
  '0x0000000000000000000000000000000000000000': 'ETH',
  '0x4200000000000000000000000000000000000006': 'WETH',
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 'USDC',
  '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf': 'cbBTC',
}

interface ZapTx {
  hash: string
  tokenIn: string
  amountIn: bigint
  vault: string
  sharesReceived: bigint
  blockNumber: bigint
  timestamp?: number
}

const PAGE_SIZE = 5

export function ZapHistory() {
  const { address } = useAccount()
  const publicClient = usePublicClient()!
  const [txs, setTxs] = useState<ZapTx[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)

  useEffect(() => {
    if (!address) return
    setLoading(true)

    publicClient.getLogs({
      address: FLOAT_ZAP_ADDRESS,
      event: {
        type: 'event', name: 'ZapIn',
        inputs: [
          { name: 'user', type: 'address', indexed: true },
          { name: 'tokenIn', type: 'address', indexed: true },
          { name: 'amountIn', type: 'uint256', indexed: false },
          { name: 'vault', type: 'address', indexed: true },
          { name: 'sharesReceived', type: 'uint256', indexed: false },
          { name: 'assetSwapped', type: 'uint256', indexed: false },
        ],
      },
      args: { user: address },
      fromBlock: 'earliest',
    }).then(logs => {
      const parsed: ZapTx[] = logs.reverse().map(log => ({
        hash: log.transactionHash ?? '',
        tokenIn: (log.args as any).tokenIn ?? '',
        amountIn: (log.args as any).amountIn ?? 0n,
        vault: (log.args as any).vault ?? '',
        sharesReceived: (log.args as any).sharesReceived ?? 0n,
        blockNumber: log.blockNumber ?? 0n,
      }))
      setTxs(parsed)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [address, publicClient])

  if (!address) return null

  const totalPages = Math.ceil(txs.length / PAGE_SIZE)
  const paginated = txs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="font-display text-xs font-bold uppercase text-black/40 tracking-wider">
          Zap history
        </p>
        {txs.length > 0 && (
          <span className="font-display text-xs text-black/30">{txs.length} total</span>
        )}
      </div>

      {loading && (
        <div className="p-4 text-center">
          <span className="font-display text-xs text-black/30 animate-pulse uppercase">Loading...</span>
        </div>
      )}

      {!loading && txs.length === 0 && (
        <div className="p-6 text-center border border-black/8 rounded-xl">
          <p className="font-body text-sm text-black/30">No zaps yet</p>
          <p className="font-body text-xs text-black/20 mt-1">Your ZapIn transactions will appear here</p>
        </div>
      )}

      {paginated.map((tx, i) => {
        const tokenSymbol = TOKEN_SYMBOLS[tx.tokenIn.toLowerCase()] ?? tx.tokenIn.slice(0, 6)
        const vaultLabel  = VAULT_LABELS[tx.vault.toLowerCase()] ?? tx.vault.slice(0, 8)
        const color       = VAULT_COLORS[vaultLabel] ?? '#888'
        const decimals    = tokenSymbol === 'USDC' ? 6 : 18
        const amt         = parseFloat(formatUnits(tx.amountIn, decimals)).toFixed(4)

        return (
          <div key={tx.hash + i} className="border border-black/8 rounded-xl p-3 bg-white flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: `${color}20`, border: `1.5px solid ${color}` }}>
                <span className="font-display text-xs font-bold" style={{ color }}>⚡</span>
              </div>
              <div className="min-w-0">
                <p className="font-display text-xs font-bold truncate">
                  {amt} {tokenSymbol} → {vaultLabel}
                </p>
                <p className="font-body text-xs text-black/35 truncate">
                  Block {tx.blockNumber.toString()}
                </p>
              </div>
            </div>
            <a href={`https://basescan.org/tx/${tx.hash}`} target="_blank" rel="noopener"
              className="font-body text-xs text-blue hover:underline shrink-0">↗</a>
          </div>
        )
      })}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="font-display text-xs text-black/40 hover:text-black disabled:opacity-30 transition-colors"
          >← Prev</button>
          <span className="font-display text-xs text-black/30">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="font-display text-xs text-black/40 hover:text-black disabled:opacity-30 transition-colors"
          >Next →</button>
        </div>
      )}
    </div>
  )
}