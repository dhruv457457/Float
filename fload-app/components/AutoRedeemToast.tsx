'use client'

import { useState, useEffect } from 'react'

interface Toast {
  id: string
  label: string
}

interface Props {
  onMount?: (trigger: (label: string) => void) => void
}

export function AutoRedeemToast({ onMount }: Props) {
  const [toasts, setToasts] = useState<Toast[]>([])

  function trigger(label: string) {
    const id = crypto.randomUUID()
    setToasts(t => [...t, { id, label }])
    setTimeout(() => {
      setToasts(t => t.filter(x => x.id !== id))
    }, 6000)
  }

  useEffect(() => {
    onMount?.(trigger)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map(toast => (
        <div key={toast.id}
          className="neu-card p-4 max-w-xs flex items-start gap-3 bg-white animate-float-in">
          <div className="w-8 h-8 rounded-full bg-acid flex items-center justify-center shrink-0 border-2 border-black">
            <span className="font-display text-sm font-bold">✓</span>
          </div>
          <div className="flex-1">
            <p className="font-display text-xs font-bold uppercase">Auto-redeemed</p>
            <p className="font-body text-xs text-black/60 mt-0.5">
              <span className="font-medium">{toast.label}</span> reached its deadline and was automatically redeemed.
            </p>
            <p className="font-body text-xs text-black/30 mt-1">
              Production: Gelato Web3 Functions
            </p>
          </div>
          <button
            onClick={() => setToasts(t => t.filter(x => x.id !== toast.id))}
            className="font-body text-xs text-black/30 hover:text-black">✕</button>
        </div>
      ))}
    </div>
  )
}