import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const { message, floats, vaultApys } = await req.json()

  const floatContext = floats?.length > 0
    ? floats.map((f: any) => `- ${f.label}: $${f.depositedAmount} in ${f.vault}, deposited ${f.depositedAt}, needed by ${f.neededAt}, status: ${f.status}`).join('\n')
    : 'No active floats yet.'

  const apyContext = vaultApys
    ? `Live APYs: yoUSD=${vaultApys.yoUSD}%, yoETH=${vaultApys.yoETH}%, yoBTC=${vaultApys.yoBTC}%`
    : 'APY data unavailable'

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://float.xyz',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4-5',
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content: `You are FLOAT's savings coach. You help users optimize their DeFi savings strategy using YO Protocol vaults on Base chain.

User's portfolio:
${floatContext}

${apyContext}

Rules:
- Be concise (2-3 sentences max)
- Give actionable advice based on their actual portfolio
- Compare to traditional savings when relevant (bank=0.5% APY, HYSA=4.5% APY)
- If they ask about rebalancing, compare current vault APY vs alternatives
- If they ask about early redemption, consider remaining days and yield lost
- Be friendly and use simple language, no DeFi jargon
- Always reference real numbers from their portfolio`
        },
        { role: 'user', content: message }
      ]
    })
  })

  const data = await response.json()
  const reply = data.choices[0].message.content

  return Response.json({ reply })
}