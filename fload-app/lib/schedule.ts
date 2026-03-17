export interface FloatEntry {
  id: string
  label: string
  vault: 'yoUSD' | 'yoETH' | 'yoBTC'
  depositedAmount: number
  shares: string
  depositedAt: string
  redeemAt: string
  neededAt: string
  status: 'active' | 'redeeming' | 'completed'
  txHash?: string
  yieldEarned?: number
  lastMilestone?: string
}

export interface FloatMilestone {
  id: string
  floatId: string
  type: 'first_cent' | 'first_dollar' | 'halfway' | 'goal_reached' | 'redemption_ready'
  message: string
  timestamp: string
  seen: boolean
}

export function saveFloat(entry: FloatEntry) {
  const existing = getFloats()
  localStorage.setItem('float_entries', JSON.stringify([...existing, entry]))
}

export function getFloats(): FloatEntry[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem('float_entries')
  return raw ? JSON.parse(raw) : []
}

export function getActiveFloats(): FloatEntry[] {
  return getFloats().filter(f => f.status === 'active')
}

export function getDueRedemptions(): FloatEntry[] {
  const now = new Date()
  return getFloats().filter(f =>
    f.status === 'active' && new Date(f.redeemAt) <= now
  )
}

export function updateFloatStatus(id: string, update: Partial<FloatEntry>) {
  const floats = getFloats()
  const updated = floats.map(f => f.id === id ? { ...f, ...update } : f)
  localStorage.setItem('float_entries', JSON.stringify(updated))
}

export function getTotalDeposited(): number {
  return getActiveFloats().reduce((sum, f) => sum + f.depositedAmount, 0)
}

export function getTotalYieldEarned(apy: number): number {
  const now = new Date()
  return getActiveFloats().reduce((sum, f) => {
    const days = (now.getTime() - new Date(f.depositedAt).getTime()) / (1000 * 60 * 60 * 24)
    return sum + (apy / 100 / 365) * days * f.depositedAmount
  }, 0)
}

export function getMilestones(): FloatMilestone[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem('float_milestones')
  return raw ? JSON.parse(raw) : []
}

export function getUnseenMilestones(): FloatMilestone[] {
  return getMilestones().filter(m => !m.seen)
}

export function addMilestone(milestone: Omit<FloatMilestone, 'id' | 'timestamp' | 'seen'>) {
  const existing = getMilestones()
  const isDuplicate = existing.some(m => m.floatId === milestone.floatId && m.type === milestone.type)
  if (isDuplicate) return

  const entry: FloatMilestone = {
    ...milestone,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    seen: false,
  }
  localStorage.setItem('float_milestones', JSON.stringify([...existing, entry]))
}

export function markMilestoneSeen(id: string) {
  const milestones = getMilestones()
  const updated = milestones.map(m => m.id === id ? { ...m, seen: true } : m)
  localStorage.setItem('float_milestones', JSON.stringify(updated))
}

export function checkMilestones(floats: FloatEntry[], avgApy: number) {
  const now = new Date()
  for (const f of floats) {
    if (f.status !== 'active') continue

    const daysElapsed = (now.getTime() - new Date(f.depositedAt).getTime()) / (1000 * 60 * 60 * 24)
    const yieldSoFar = (avgApy / 100 / 365) * daysElapsed * f.depositedAmount
    const totalDays = (new Date(f.neededAt).getTime() - new Date(f.depositedAt).getTime()) / (1000 * 60 * 60 * 24)
    const progress = daysElapsed / totalDays

    if (yieldSoFar >= 0.01 && yieldSoFar < 0.5) {
      addMilestone({
        floatId: f.id,
        type: 'first_cent',
        message: `Your ${f.label} just earned its first penny!`,
      })
    }

    if (yieldSoFar >= 1.0) {
      addMilestone({
        floatId: f.id,
        type: 'first_dollar',
        message: `Your ${f.label} just crossed $1 in yield!`,
      })
    }

    if (progress >= 0.5 && progress < 0.6) {
      addMilestone({
        floatId: f.id,
        type: 'halfway',
        message: `${f.label} is halfway there — ${Math.round(totalDays - daysElapsed)} days to go`,
      })
    }

    const daysLeft = (new Date(f.redeemAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    if (daysLeft <= 1 && daysLeft > 0) {
      addMilestone({
        floatId: f.id,
        type: 'redemption_ready',
        message: `${f.label} is ready to redeem — your money is on its way back!`,
      })
    }
  }
}
