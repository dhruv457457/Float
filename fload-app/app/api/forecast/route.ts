import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
    const { vaultId, history, currentApy, tvl } = await req.json()

    const histStr = history
        .map((v: number, i: number) => `Day -${history.length - i}: ${v.toFixed(2)}%`)
        .join(', ')

    const fmtTVL = (n: number) =>
        n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`

    const prompt = `You are a DeFi yield analyst. Forecast the APY for ${vaultId} vault.

Current APY: ${currentApy}%
TVL: ${tvl ? fmtTVL(tvl) : 'unknown'}
30-day history: ${histStr}

Predict the next 14 days of APY. Consider: trend direction, volatility, mean reversion, TVL impact on yields.

Respond ONLY with JSON, no markdown:
{
  "forecast": [14 numbers, each the predicted APY for that day],
  "trend": "up" | "down" | "stable",
  "confidence": "high" | "medium" | "low",
  "reasoning": "2-3 sentences explaining the trend and key factors"
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
            max_tokens: 600,
            messages: [{ role: 'user', content: prompt }],
        }),
    })

    const data = await response.json()
    const text = data.choices[0].message.content

    try {
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
        return Response.json(parsed)
    } catch {
        return Response.json(
            { forecast: Array(14).fill(currentApy), trend: 'stable', confidence: 'low', reasoning: 'Could not parse forecast.' },
            { status: 500 }
        )
    }
}