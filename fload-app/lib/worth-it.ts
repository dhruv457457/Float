const BANK_SAVINGS_APY = 0.5
const AVG_HYSA_APY = 4.5

export function isWorthFloating(
  amountUSD: number,
  daysUntilNeeded: number,
  apyPercent: number,
  estimatedGasCostUSD: number = 0.10
): {
  worthIt: boolean
  projectedYield: number
  daysToBreakEven: number
  friendlyYield: string
  bankComparison: {
    bankYield: number
    hysaYield: number
    floatYield: number
    multiplierVsBank: number
    multiplierVsHYSA: number
  }
} {
  const dailyYield = (apyPercent / 100 / 365) * amountUSD
  const totalYield = dailyYield * daysUntilNeeded
  const daysToBreakEven = dailyYield > 0 ? estimatedGasCostUSD / dailyYield : Infinity

  const bankYield = (BANK_SAVINGS_APY / 100 / 365) * amountUSD * daysUntilNeeded
  const hysaYield = (AVG_HYSA_APY / 100 / 365) * amountUSD * daysUntilNeeded

  const friendlyYield =
    totalYield < 0.01 ? 'less than a penny' :
    totalYield < 1 ? `${(totalYield * 100).toFixed(0)}¢` :
    totalYield < 5 ? `a coffee ($${totalYield.toFixed(2)})` :
    totalYield < 15 ? `a meal ($${totalYield.toFixed(2)})` :
    totalYield < 50 ? `a nice dinner ($${totalYield.toFixed(2)})` :
    `$${totalYield.toFixed(2)}`

  return {
    worthIt: daysToBreakEven < daysUntilNeeded * 0.5,
    projectedYield: totalYield,
    daysToBreakEven: Math.round(daysToBreakEven),
    friendlyYield,
    bankComparison: {
      bankYield,
      hysaYield,
      floatYield: totalYield,
      multiplierVsBank: bankYield > 0 ? totalYield / bankYield : 0,
      multiplierVsHYSA: hysaYield > 0 ? totalYield / hysaYield : 0,
    },
  }
}
