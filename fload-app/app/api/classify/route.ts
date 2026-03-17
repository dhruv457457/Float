import { classifyIntent } from '@/lib/classify'
import { getVaultAPY } from '@/lib/yo'
import { isWorthFloating } from '@/lib/worth-it'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const { message, balance } = await req.json()

  const [yoUSDApy, yoETHApy, yoBTCApy] = await Promise.all([
    getVaultAPY('yoUSD'),
    getVaultAPY('yoETH'),
    getVaultAPY('yoBTC'),
  ])

  const vaultApys = {
    yoUSD: yoUSDApy ?? 3.2,
    yoETH: yoETHApy ?? 2.8,
    yoBTC: yoBTCApy ?? 1.9,
  }

  const splitPlan = await classifyIntent(message, balance, vaultApys)

  const enrichedSplits = splitPlan.splits.map((plan) => {
    const apy = vaultApys[plan.vault as keyof typeof vaultApys] ?? 3.2
    const worthIt = isWorthFloating(plan.amount, plan.daysUntilNeeded, apy)
    return { plan, apy, worthIt }
  })

  return Response.json({
    splits: enrichedSplits,
    overallReasoning: splitPlan.overallReasoning,
    totalAmount: splitPlan.totalAmount,
    vaultApys,
  })
}