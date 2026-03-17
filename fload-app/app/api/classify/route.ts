import { classifyIntent } from '@/lib/classify'
import { getVaultAPY } from '@/lib/yo'
import { isWorthFloating } from '@/lib/worth-it'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const { message, balance } = await req.json()

  const splitPlan = await classifyIntent(message, balance)

  const enrichedSplits = await Promise.all(
    splitPlan.splits.map(async (plan) => {
      const apy = await getVaultAPY(plan.vault) ?? 3.2
      const worthIt = isWorthFloating(plan.amount, plan.daysUntilNeeded, apy)
      return { plan, apy, worthIt }
    })
  )

  return Response.json({
    splits: enrichedSplits,
    overallReasoning: splitPlan.overallReasoning,
    totalAmount: splitPlan.totalAmount,
  })
}
