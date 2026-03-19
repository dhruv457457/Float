'use client'

import { useAccount, useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { format, differenceInDays } from 'date-fns'
import { useState } from 'react'
import { FLOAT_OPTIMIZER_ADDRESS, FLOAT_OPTIMIZER_ABI } from '@/lib/contracts'

interface Position {
  sharesYoUSD: bigint
  sharesYoETH: bigint
  sharesYoBTC: bigint
  depositedUSDC: bigint
  depositedAt: bigint
  matureAt: bigint
  label: string
}

const PAGE_SIZE = 4

function PositionRow({ positionId }: { positionId: bigint }) {
  const { data: position } = useReadContract({
    address: FLOAT_OPTIMIZER_ADDRESS,
    abi: FLOAT_OPTIMIZER_ABI,
    functionName: 'getPosition',
    args: [positionId],
  }) as { data: Position | undefined }

  if (!position || position.depositedAt === 0n) return null

  const deposited  = Number(formatUnits(position.depositedUSDC, 6))
  const matureAt   = new Date(Number(position.matureAt) * 1000)
  const depositedAt = new Date(Number(position.depositedAt) * 1000)
  const daysLeft   = differenceInDays(matureAt, new Date())
  const isReady    = daysLeft <= 0

  const vaults = [
    position.sharesYoUSD > 0n && { label: 'yoUSD', color: '#9BD600' },
    position.sharesYoETH > 0n && { label: 'yoETH', color: '#3B82F6' },
    position.sharesYoBTC > 0n && { label: 'yoBTC', color: '#FF6B35' },
  ].filter(Boolean) as { label: string; color: string }[]

  return (
    <div className={`border rounded-xl p-3 bg-white flex items-center justify-between gap-3 ${
      isReady ? 'border-acid-dark' : 'border-black/8'
    }`}>
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-7 h-7 rounded-full bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0"
          style={{ background: '#8B5CF620', border: '1.5px solid #8B5CF6' }}>
          <span className="font-display text-xs font-bold" style={{ color: '#8B5CF6' }}>⚡</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-display text-xs font-bold truncate">
              {position.label || `Position #${positionId}`}
            </p>
            {vaults.map(v => (
              <span key={v.label} className="font-display text-xs px-1 rounded"
                style={{ background: `${v.color}22`, color: v.color }}>
                {v.label}
              </span>
            ))}
          </div>
          <p className="font-body text-xs text-black/35">
            ${deposited.toFixed(2)} · {isReady ? '✓ Ready' : `${daysLeft}d left`}
          </p>
        </div>
      </div>
      <a href={`https://basescan.org/address/${FLOAT_OPTIMIZER_ADDRESS}`} target="_blank" rel="noopener"
        className="font-body text-xs text-blue hover:underline shrink-0">↗</a>
    </div>
  )
}

export function OptimizerHistory() {
  const { address } = useAccount()
  const [page, setPage] = useState(0)

  const { data: positionIds, isLoading } = useReadContract({
    address: FLOAT_OPTIMIZER_ADDRESS,
    abi: FLOAT_OPTIMIZER_ABI,
    functionName: 'getUserPositions',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15000 },
  }) as { data: bigint[] | undefined; isLoading: boolean }

  if (!address) return null

  const ids = positionIds ? [...positionIds].reverse() : []
  const totalPages = Math.ceil(ids.length / PAGE_SIZE)
  const paginated  = ids.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="font-display text-xs font-bold uppercase text-black/40 tracking-wider">
          Optimizer positions
        </p>
        {ids.length > 0 && (
          <span className="font-display text-xs text-black/30">{ids.length} total</span>
        )}
      </div>

      {isLoading && (
        <div className="p-4 text-center">
          <span className="font-display text-xs text-black/30 animate-pulse uppercase">Loading...</span>
        </div>
      )}

      {!isLoading && ids.length === 0 && (
        <div className="p-6 text-center border border-black/8 rounded-xl">
          <p className="font-body text-sm text-black/30">No positions yet</p>
          <p className="font-body text-xs text-black/20 mt-1">Your optimizer deposits will appear here</p>
        </div>
      )}

      {paginated.map(id => <PositionRow key={id.toString()} positionId={id} />)}

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