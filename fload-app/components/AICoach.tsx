'use client'

import { useState, useRef, useEffect } from 'react'
import { getActiveFloats } from '@/lib/schedule'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const VAULT_APYS = { yoUSD: 3.18, yoETH: 5.42, yoBTC: 1.92 }

const SUGGESTED_PROMPTS = [
  'Should I rebalance any of my floats?',
  'Am I beating a HYSA right now?',
  'Which vault is best for a 45-day timeline?',
  'What is my total projected yield?',
  'Is yoETH worth the extra risk?',
]

function buildPortfolioContext(): string {
  const floats = getActiveFloats()
  if (!floats.length) return 'No active floats yet.'

  const lines = floats.map(f => {
    const apy = VAULT_APYS[f.vault as keyof typeof VAULT_APYS] ?? 3.2
    const daysElapsed = (Date.now() - new Date(f.depositedAt).getTime()) / 86400000
    const yieldSoFar = (apy / 100 / 365) * daysElapsed * f.depositedAmount
    const daysLeft = (new Date(f.neededAt).getTime() - Date.now()) / 86400000
    return `- "${f.label}": $${f.depositedAmount} in ${f.vault} (${apy}% APY), ${Math.floor(daysLeft)} days remaining, earned $${yieldSoFar.toFixed(4)} so far`
  })

  const total = floats.reduce((s, f) => s + f.depositedAmount, 0)
  const vaultLines = Object.entries(VAULT_APYS).map(([v, a]) => `- ${v}: ${a}% APY`)

  return [
    `Total deposited: $${total}`,
    `Active floats:\n${lines.join('\n')}`,
    `Live vault APYs:\n${vaultLines.join('\n')}`,
    `Comparison: Bank savings = 0.5% APY, HYSA = 4.5% APY`,
  ].join('\n\n')
}

export function AICoach() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  // Welcome message
  useEffect(() => {
    const floats = getActiveFloats()
    const total = floats.reduce((s, f) => s + f.depositedAmount, 0)
    setMessages([{
      role: 'assistant',
      content: floats.length
        ? `Hey! I know your portfolio — $${total} across ${floats.length} float${floats.length > 1 ? 's' : ''}. Ask me anything: rebalancing, HYSA comparison, which vault suits your next goal. I have live vault data.`
        : `Hey! No active floats yet, but I can still help. Ask me about vault APYs, how to pick the right timeline, or when a float is worth it vs just holding USDC.`,
    }])
  }, [])

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages, loading])

  async function send(text?: string) {
    const msg = text ?? input.trim()
    if (!msg || loading) return
    setInput('')
    setLoading(true)

    const newMessages: Message[] = [...messages, { role: 'user', content: msg }]
    setMessages(newMessages)

    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          portfolioContext: buildPortfolioContext(),
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Network error — please try again.' }])
    }
    setLoading(false)
  }

  return (
    <div className="neu-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="neu-tag bg-acid">Savings Coach</span>
        <span className="font-body text-xs text-black/50">Claude knows your portfolio · ask anything</span>
      </div>

      {/* Suggested prompts */}
      <div className="flex flex-wrap gap-2 mb-3">
        {SUGGESTED_PROMPTS.map(p => (
          <button
            key={p}
            onClick={() => send(p)}
            disabled={loading}
            className="neu-tag bg-white hover:bg-acid transition-colors cursor-pointer disabled:opacity-40"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Chat messages */}
      <div
        ref={chatRef}
        className="h-72 overflow-y-auto flex flex-col gap-3 p-3 rounded-lg mb-3"
        style={{ background: 'var(--cream)', border: '2px solid rgba(26,26,26,.12)' }}
      >
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-3 py-2 rounded-lg text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-black text-white font-display text-xs'
                  : 'bg-white border border-black/10 font-body'
              }`}
            >
              {m.role === 'assistant' && (
                <p className="font-display text-xs font-bold text-acid-dark uppercase tracking-wider mb-1">
                  FLOAT AI
                </p>
              )}
              {m.content.split('\n').map((line, j) => (
                <span key={j}>{line}{j < m.content.split('\n').length - 1 && <br />}</span>
              ))}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-black/10 px-3 py-2 rounded-lg">
              <p className="font-display text-xs font-bold text-acid-dark uppercase tracking-wider mb-2">FLOAT AI</p>
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-black/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-black/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-black/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder='e.g. "Is my yoETH float worth keeping?"'
          className="neu-input flex-1 text-sm"
          disabled={loading}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()} className="neu-btn neu-btn-primary">
          ASK →
        </button>
      </div>
    </div>
  )
}