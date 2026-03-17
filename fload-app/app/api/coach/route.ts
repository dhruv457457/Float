import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const { messages, portfolioContext } = await req.json()

  const system = `You are FLOAT's AI savings coach — sharp, direct, and knowledgeable about DeFi yield. You give specific, actionable advice. Keep responses under 100 words. Use numbers from the portfolio when relevant. No markdown headers, just clean prose or short lists.

User's current portfolio:
${portfolioContext}`

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://float.xyz',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4-5',
      max_tokens: 300,
      messages: [
        { role: 'system', content: system },
        ...messages,
      ],
    }),
  })

  const data = await response.json()
  const reply = data.choices[0]?.message?.content ?? 'Could not get a response.'
  return Response.json({ reply })
}