'use client'

import { useState, useEffect, useRef } from 'react'
import { useVaultHistory, useVaultState } from '@yo-protocol/react'
import { formatUnits } from 'viem'
import type { VaultId } from '@yo-protocol/core'

declare global {
  interface Window { Chart: any }
}

type VaultKey = 'yoUSD' | 'yoETH' | 'yoBTC'

const VAULT_COLORS: Record<VaultKey, string> = {
  yoUSD: '#9BD600',
  yoETH: '#3B82F6',
  yoBTC: '#FF6B35',
}

const FALLBACK_APY: Record<VaultKey, number> = {
  yoUSD: 3.18,
  yoETH: 5.42,
  yoBTC: 1.92,
}

function VaultForecastChart({ vaultId }: { vaultId: VaultKey }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<any>(null)
  const { yieldHistory, isLoading: histLoading } = useVaultHistory(vaultId as VaultId)
  const { vaultState } = useVaultState(vaultId as VaultId)
  const [forecast, setForecast] = useState<number[]>([])
  const [reasoning, setReasoning] = useState('')
  const [trend, setTrend] = useState<'up' | 'down' | 'stable'>('stable')
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low'>('medium')
  const [generating, setGenerating] = useState(false)

  const currentApy = FALLBACK_APY[vaultId]
  const tvl = vaultState
    ? Number(formatUnits(vaultState.totalAssets, vaultState.assetDecimals))
    : null

  // Build 30-day history from SDK or fallback to simulated
  const history: number[] = yieldHistory.length >= 7
    ? yieldHistory.slice(-30).map(p => p.value)
    : Array.from({ length: 30 }, (_, i) => {
        const noise = (Math.random() - 0.5) * 0.4
        const trend = i > 20 ? (i - 20) * 0.01 : 0
        return Math.max(0.5, currentApy + noise + trend)
      })

  useEffect(() => {
    if (!canvasRef.current || typeof window === 'undefined' || !window.Chart) return
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }

    const labels = [
      ...Array.from({ length: 30 }, (_, i) => `-${30 - i}d`),
      ...Array.from({ length: 14 }, (_, i) => `+${i + 1}d`),
    ]
    const histData = [...history, ...Array(14).fill(null)]
    const forecastData = forecast.length
      ? [...Array(30).fill(null), ...forecast]
      : Array(44).fill(null)

    const color = VAULT_COLORS[vaultId]

    chartRef.current = new window.Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Historical APY',
            data: histData,
            borderColor: color,
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.4,
            spanGaps: false,
          },
          {
            label: 'AI Forecast',
            data: forecastData,
            borderColor: '#3B82F6',
            backgroundColor: 'rgba(59,130,246,.06)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.4,
            borderDash: [5, 5],
            spanGaps: false,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            ticks: { maxTicksLimit: 10, font: { size: 10 }, color: '#888' },
            grid: { color: 'rgba(0,0,0,.04)' },
          },
          y: {
            ticks: { callback: (v: number) => `${v.toFixed(1)}%`, font: { size: 10 }, color: '#888' },
            grid: { color: 'rgba(0,0,0,.04)' },
            min: 0,
          },
        },
      },
    })
  }, [history, forecast, vaultId])

  async function generateForecast() {
    setGenerating(true)
    try {
      const res = await fetch('/api/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vaultId, history, currentApy, tvl }),
      })
      const data = await res.json()
      setForecast(data.forecast ?? [])
      setReasoning(data.reasoning ?? '')
      setTrend(data.trend ?? 'stable')
      setConfidence(data.confidence ?? 'medium')
    } catch {
      setReasoning('Error generating forecast.')
    }
    setGenerating(false)
  }

  const trendIcon = trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'
  const trendColor = trend === 'up' ? '#9BD600' : trend === 'down' ? '#FF3CAC' : '#888'
  const confidenceBg = confidence === 'high' ? 'bg-acid/20 text-acid-dark' : confidence === 'medium' ? 'bg-blue/10 text-blue' : 'bg-black/5 text-black/40'

  return (
    <div className="flex flex-col gap-3">
      {/* Chart */}
      <div className="border border-black/10 rounded-lg p-4 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="font-display text-xs" style={{ color: VAULT_COLORS[vaultId] }}>
              ─── Historical
            </span>
            <span className="font-display text-xs text-blue/70">- - - AI Forecast</span>
          </div>
          {forecast.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-bold" style={{ color: trendColor }}>
                {trendIcon} {trend}
              </span>
              <span className={`soft-tag ${confidenceBg}`}>{confidence} confidence</span>
            </div>
          )}
        </div>

        <div style={{ position: 'relative', width: '100%', height: '200px' }}>
          {histLoading ? (
            <div className="flex items-center justify-center h-full">
              <span className="font-display text-xs text-black/30 animate-pulse uppercase">Loading history...</span>
            </div>
          ) : (
            <canvas ref={canvasRef} />
          )}
        </div>
      </div>

      {/* AI reasoning */}
      {reasoning && (
        <div className="border-l-4 border-acid px-4 py-3 bg-white rounded-r-lg">
          <p className="font-display text-xs font-bold uppercase text-acid-dark mb-1">AI Analysis</p>
          <p className="font-body text-sm text-black/70 leading-relaxed">{reasoning}</p>
        </div>
      )}

      <button
        onClick={generateForecast}
        disabled={generating}
        className="neu-btn neu-btn-primary w-full"
      >
        {generating ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            GENERATING FORECAST...
          </span>
        ) : forecast.length ? 'REGENERATE FORECAST →' : 'GENERATE AI FORECAST →'}
      </button>
    </div>
  )
}

export function YieldForecast() {
  const [selected, setSelected] = useState<VaultKey>('yoUSD')
  const [chartReady, setChartReady] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Chart) { setChartReady(true); return }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
    script.onload = () => setChartReady(true)
    document.head.appendChild(script)
  }, [])

  const vaults: VaultKey[] = ['yoUSD', 'yoETH', 'yoBTC']

  return (
    <div className="flex flex-col gap-4">
      <div className="neu-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="neu-tag bg-acid">AI Yield Forecast</span>
            <span className="font-body text-xs text-black/50">30d history + 14d prediction</span>
          </div>
        </div>

        {/* Vault selector */}
        <div className="flex gap-2 mb-4">
          {vaults.map(v => (
            <button
              key={v}
              onClick={() => setSelected(v)}
              className="neu-tag cursor-pointer transition-all"
              style={{
                background: selected === v ? VAULT_COLORS[v] : '#fff',
                color: selected === v ? '#1A1A1A' : 'inherit',
                borderColor: VAULT_COLORS[v],
              }}
            >
              {v}
            </button>
          ))}
        </div>

        {chartReady ? (
          <VaultForecastChart vaultId={selected} />
        ) : (
          <div className="flex items-center justify-center h-48">
            <span className="font-display text-xs text-black/30 animate-pulse uppercase">Loading chart...</span>
          </div>
        )}
      </div>
    </div>
  )
}