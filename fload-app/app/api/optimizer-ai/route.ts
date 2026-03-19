import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const { message, vaultApys, splitPreview } = await req.json()

  const apyUSD = vaultApys?.yoUSD ?? 3.18
  const apyETH = vaultApys?.yoETH ?? 5.42
  const apyBTC = vaultApys?.yoBTC ?? 1.92

  const splitContext = splitPreview
    ? `\nThe optimizer will split funds as: ${splitPreview.bestVault} ${splitPreview.bestPct}%, ${splitPreview.secondVault} ${splitPreview.secondPct}%, ${splitPreview.thirdVault} ${splitPreview.thirdPct}%`
    : ''

  const prompt = `You are FLOAT's Optimizer advisor. A user wants to deposit USDC and have it auto-split across YO Protocol vaults.

User said: "${message}"

Live vault APYs:
- yoUSD: ${apyUSD}% (stablecoin, low risk, direct USDC deposit)
- yoETH: ${apyETH}% (ETH vault, medium risk, USDC swapped to WETH via Uniswap V3)
- yoBTC: ${apyBTC}% (BTC vault, low-med risk, USDC swapped to cbBTC via Uniswap V3)
${splitContext}

Extract from the user's message:
- amount: USDC amount (number, null if unclear)
- days: how many days until they need it (number, guess 30 if unclear)
- label: short 2-3 word savings label

Also generate:
- splitExplanation: 2 sentences explaining WHY the optimizer chose this allocation. Mention the specific APY advantage of yoETH, why the swap cost is justified given the timeline, and how stability increases near deadline.
- riskAssessment: if days < 14, warn that short timelines are better served by yoUSD only (swap costs eat the yield gain). Otherwise null.

Respond ONLY with JSON, no markdown:
{
  "amount": number | null,
  "days": number,
  "label": string,
  "splitExplanation": string,
  "riskAssessment": string | null
}`

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
  const text = data.choices[0].message.content

  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
    return Response.json(parsed)
  } catch {
    return Response.json({
      amount: null,
      days: 30,
      label: 'Savings goal',
      splitExplanation: 'The optimizer allocates 60% to yoETH for maximum APY, with the remainder in yoUSD for stability.',
      riskAssessment: null,
    })
  }
}