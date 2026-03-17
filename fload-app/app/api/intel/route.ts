import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const { floats, vaultApys, totalDeposited, totalYield } = await req.json()

  const floatLines = floats.map((f: any) => {
    const apy = vaultApys[f.vault] ?? 3.2
    const yieldSoFar = (apy / 100 / 365) * f.daysElapsed * f.amount
    const projTotal = (apy / 100 / 365) * f.daysTotal * f.amount
    const vsHysa = ((apy - 4.5) / 100 / 365) * f.amount * f.daysTotal
    return `- "${f.label}": $${f.amount} in ${f.vault} (${apy}% APY), day ${f.daysElapsed}/${f.daysTotal}, earned $${yieldSoFar.toFixed(4)} of projected $${projTotal.toFixed(4)}, vs HYSA: ${vsHysa >= 0 ? '+' : ''}$${vsHysa.toFixed(4)}`
  }).join('\n')

  const prompt = `You are FLOAT's portfolio intelligence engine. Analyze this user's DeFi savings portfolio.

Portfolio summary:
- Total deposited: $${totalDeposited}
- Total yield earned so far: $${totalYield.toFixed(4)}

Individual floats:
${floatLines}

Live vault APYs: yoUSD=${vaultApys.yoUSD}%, yoETH=${vaultApys.yoETH}%, yoBTC=${vaultApys.yoBTC}%
For comparison: Bank savings = 0.5% APY, HYSA = 4.5% APY

Write a portfolio intelligence report in 3-4 crisp sentences. Include:
1. Which float is performing best vs worst relative to alternatives (with specific $$ numbers)
2. One concrete rebalancing suggestion with projected gain amount
3. Portfolio-level comparison vs a simple HYSA (total $ difference)

Be direct, specific, use actual numbers. Address the user as "Your". No bullet points, no markdown headers.`

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://float.xyz',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4-5',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await response.json()
  const report = data.choices[0]?.message?.content ?? 'Could not generate report.'
  return Response.json({ report })
}