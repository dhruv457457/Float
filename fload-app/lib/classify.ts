export interface FloatPlan {
  amount: number
  daysUntilNeeded: number
  certainty: 'high' | 'medium' | 'low'
  vault: 'yoUSD' | 'yoETH' | 'yoBTC'
  liquidBuffer: number
  friendlyLabel: string
  reasoning: string
}

export interface SplitPlan {
  splits: FloatPlan[]
  overallReasoning: string
  totalAmount: number
}

export async function classifyIntent(
  userMessage: string,
  availableBalance: number
): Promise<SplitPlan> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://float.xyz',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4-5',
      max_tokens: 800,
      messages: [
        {
          role: 'system',
          content: `You are FLOAT's smart savings advisor. Users describe money they plan to spend. You analyze and return an optimal vault plan.

You can suggest SPLITTING funds across multiple vaults if it makes sense.

Rules for each split:
- Timeline < 7 days → vault: yoUSD, liquidBuffer: 30-40 (short timeline)
- Timeline 7-60 days → vault: yoUSD (stable, predictable)
- Timeline > 60 days, user mentions ETH/crypto → vault: yoETH
- Timeline > 60 days, user mentions BTC/bitcoin → vault: yoBTC
- If user has excess beyond their goal, suggest floating the remainder in yoETH or yoUSD
- certainty: high = fixed bill/rent, medium = planned purchase, low = "maybe"/"thinking about"
- liquidBuffer: % to keep in wallet (0 = fully confident, 40 = very uncertain)
- friendlyLabel: short 2-3 word label like "Rent fund", "Trip fund", "Laptop fund"

When to split:
- User mentions multiple expenses → one split per expense
- User has significantly more balance than their stated goal → suggest floating the excess
- User mentions both short and long term goals → split by timeline

Respond ONLY in JSON. No markdown. No other text.
{
  "splits": [
    {
      "amount": number,
      "daysUntilNeeded": number,
      "certainty": "high" | "medium" | "low",
      "vault": "yoUSD" | "yoETH" | "yoBTC",
      "liquidBuffer": number,
      "friendlyLabel": string,
      "reasoning": string (one sentence, conversational)
    }
  ],
  "overallReasoning": string (one sentence summary of the full plan),
  "totalAmount": number
}`
        },
        {
          role: 'user',
          content: `Available balance: $${availableBalance} USDC\nUser said: "${userMessage}"`
        }
      ]
    })
  })

  const data = await response.json()
  const text = data.choices[0].message.content

  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
    if (!parsed.splits) {
      return {
        splits: [parsed],
        overallReasoning: parsed.reasoning || '',
        totalAmount: parsed.amount || 0,
      }
    }
    return parsed
  } catch {
    throw new Error('Could not parse AI response')
  }
}
