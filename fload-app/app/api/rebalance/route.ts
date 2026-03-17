import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const { floats, vaultApys } = await req.json()

  const floatSummary = floats.map((f: any) => {
    const apy = vaultApys[f.vault] ?? 3.2
    const yieldSoFar = (apy / 100 / 365) * f.daysElapsed * f.amount
    return `- "${f.label}": $${f.amount} in ${f.vault} (${apy}% APY), day ${f.daysElapsed}/${f.daysTotal}, earned $${yieldSoFar.toFixed(4)}`
  }).join('\n')

  const vaultSummary = Object.entries(vaultApys)
    .map(([v, a]) => `- ${v}: ${a}% APY`)
    .join('\n')

  const prompt = `You are a DeFi yield optimizer. Analyze these floats and decide if any should be rebalanced.

Current floats:
${floatSummary}

Current live vault APYs:
${vaultSummary}

Gas cost per transaction on Base: ~$0.08

Rules:
- Only recommend rebalancing if APY gain * remaining days * amount > 3x gas cost
- Never recommend rebalancing floats with < 7 days remaining
- Consider risk: yoUSD = stable, yoETH = medium, yoBTC = low-medium
- If user has yoETH with < 14 days left, recommend moving to yoUSD for stability

Respond ONLY with a JSON array, no markdown, no other text:
[
  {
    "floatLabel": "...",
    "currentVault": "yoUSD|yoETH|yoBTC",
    "currentApy": 3.18,
    "action": "keep" | "rebalance",
    "targetVault": "yoUSD|yoETH|yoBTC or null",
    "targetApy": 5.42,
    "gainProjected": "$X.XX over N days",
    "gasBreakeven": "N days",
    "urgency": "high|medium|low",
    "reasoning": "one specific sentence with numbers"
  }
]`

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://float.xyz',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4-5',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await response.json()
  const text = data.choices[0].message.content

  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
    return Response.json({ recommendations: parsed })
  } catch {
    return Response.json({ recommendations: [], error: 'Could not parse AI response' }, { status: 500 })
  }
}