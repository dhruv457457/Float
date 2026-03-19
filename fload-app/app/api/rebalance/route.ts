import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { floats, vaultApys } = await req.json()

    if (!floats?.length) {
      return Response.json({ recommendations: [] })
    }

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
    "action": "keep",
    "targetVault": null,
    "targetApy": null,
    "gainProjected": "$X.XX over N days",
    "gasBreakeven": "N days",
    "urgency": "low",
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
        model: 'anthropic/claude-3.5-sonnet',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('OpenRouter error:', err)
      return Response.json({ recommendations: [], error: 'AI service error' }, { status: 500 })
    }

    const data = await response.json()

    if (!data.choices?.[0]?.message?.content) {
      console.error('Unexpected OpenRouter response:', JSON.stringify(data))
      return Response.json({ recommendations: [], error: 'Empty AI response' }, { status: 500 })
    }

    const text = data.choices[0].message.content

    try {
      // Strip markdown code blocks if they exist
      let cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim()

      // Isolate the array by finding the first '[' and last ']'
      const firstBracket = cleanText.indexOf('[')
      const lastBracket = cleanText.lastIndexOf(']')

      if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        cleanText = cleanText.substring(firstBracket, lastBracket + 1)
      }

      const parsed = JSON.parse(cleanText)
      
      // Ensure we always return an array
      return Response.json({ recommendations: Array.isArray(parsed) ? parsed : [parsed] })

    } catch (e: any) {
      // Log the raw text to see exactly how the AI output failed to parse
      console.error('Raw AI Output that failed to parse:', text) 
      return Response.json({ 
        recommendations: [], 
        error: 'Could not parse AI response. Check server logs.' 
      }, { status: 500 })
    }
  } catch (e: any) {
    console.error('Rebalance API error:', e)
    return Response.json({ recommendations: [], error: e.message }, { status: 500 })
  }
}