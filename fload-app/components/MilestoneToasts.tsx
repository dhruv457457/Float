'use client'

import { useEffect, useState } from 'react'
import { getUnseenMilestones, markMilestoneSeen, type FloatMilestone } from '@/lib/schedule'

export function MilestoneToasts() {
  const [toasts, setToasts] = useState<FloatMilestone[]>([])

  useEffect(() => {
    const check = () => {
      const unseen = getUnseenMilestones()
      if (unseen.length > 0) {
        setToasts(unseen.slice(0, 3))
      }
    }

    check()
    const interval = setInterval(check, 10000)
    return () => clearInterval(interval)
  }, [])

  function dismiss(id: string) {
    markMilestoneSeen(id)
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm">
      {toasts.map((toast, i) => (
        <div
          key={toast.id}
          className="animate-slide-up"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <div className="bg-black text-white p-4 rounded-lg border-2 border-acid shadow-neu-lg flex items-start gap-3">
            <span className="text-xl">
              {toast.type === 'first_cent' ? '🪙' :
               toast.type === 'first_dollar' ? '💰' :
               toast.type === 'halfway' ? '⏳' :
               toast.type === 'redemption_ready' ? '✅' : '🎉'}
            </span>
            <div className="flex-1">
              <p className="font-display text-xs font-bold uppercase text-acid mb-1">Milestone</p>
              <p className="font-body text-sm">{toast.message}</p>
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="text-white/40 hover:text-white font-display text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
