import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const { message, balances, vaultApys } = await req.json()

  const prompt = `You are FLOAT's ZapIn advisor. A user wants to deposit tokens into a YO Protocol yield vault.

User said: "${message}"

Available tokens: ETH (native), USDC, WETH, cbBTC
Available vaults:
- yoUSD: ${vaultApys?.yoUSD ?? 3.18}% APY, accepts USDC (stable, low risk)
- yoETH: ${vaultApys?.yoETH ?? 5.42}% APY, accepts WETH/ETH (medium risk)
- yoBTC: ${vaultApys?.yoBTC ?? 1.92}% APY, accepts cbBTC (low-medium risk)

User balances: ${JSON.stringify(balances ?? {})}

Rules:
- If user mentions ETH/ethereum → tokenIn: "ETH"
- If user mentions BTC/bitcoin/cbBTC → tokenIn: "cbBTC"
- If user mentions USDC/stablecoin → tokenIn: "USDC"
- Match vault to tokenIn when possible (ETH → yoETH for best yield, USDC → yoUSD for stability)
- If user mentions a timeline, extract days
- certainty: pick vault based on risk tolerance implied in message

Respond ONLY with JSON, no markdown:
{
  "tokenIn": "ETH" | "USDC" | "WETH" | "cbBTC",
  "vault": "yoUSD" | "yoETH" | "yoBTC",
  "days": number,
  "label": "short 2-3 word label",
  "routeExplanation": "one sentence explaining why this token→vault combo makes sense with the swap route and projected yield",
  "riskNote": "one sentence on risk level" | null
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
      tokenIn: 'USDC',
      vault: 'yoUSD',
      days: 30,
      label: 'Float',
      routeExplanation: 'Depositing USDC directly into yoUSD for stable yield.',
      riskNote: null,
    })
  }
}