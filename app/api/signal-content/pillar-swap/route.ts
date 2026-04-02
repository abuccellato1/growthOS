import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function extractJSON(text: string): Record<string, unknown> | null {
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const first = clean.indexOf('{')
  const last = clean.lastIndexOf('}')
  if (first === -1 || last <= first) return null
  try {
    return JSON.parse(clean.slice(first, last + 1))
  } catch { return null }
}

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  let body: {
    rejectedPillarName: string
    rejectionReason: string
    existingPillarNames: string[]
    condensedContext: string
  }
  try { body = await request.json() } catch {
    return apiError('Invalid body', 400, 'INVALID_BODY')
  }

  const { rejectedPillarName, rejectionReason, existingPillarNames, condensedContext } = body
  if (!rejectedPillarName || !condensedContext) {
    return apiError('Missing required fields', 400, 'VALIDATION_ERROR')
  }

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: `You are a social media content strategist. Propose ONE replacement content pillar.
The replacement must be completely different from the rejected pillar and all existing pillars.
Be specific to the business intelligence provided.
RESPONSE FORMAT: Single valid JSON object only. Start with { end with }. No markdown.`,
    messages: [{
      role: 'user',
      content: `Propose one replacement content pillar.

Business context:
${condensedContext}

Rejected pillar: "${rejectedPillarName}"
Reason rejected: "${rejectionReason || 'Not specified'}"

Existing pillars to avoid duplicating: ${existingPillarNames.join(', ')}

Return exactly this JSON:
{"name":"","rationale":"one sentence why this works","icpConnection":"one sentence connecting to ICP fear or desire","category":"pillar category"}`
    }],
  })

  const blocks = res.content.filter(b => b.type === 'text')
  const last = blocks[blocks.length - 1]
  if (!last || last.type !== 'text') {
    return apiError('No response from model', 500, 'GENERATION_FAILED')
  }

  const parsed = extractJSON(last.text)
  if (!parsed) {
    console.error('[SignalContent PillarSwap] Parse failed:', last.text.slice(0, 200))
    return apiError('Failed to parse replacement pillar', 500, 'PARSE_FAILED')
  }

  return apiSuccess({ pillar: parsed })
}
