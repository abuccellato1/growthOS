import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function extractJSON(text: string): Record<string, unknown> | null {
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const first = clean.indexOf('{')
  const last = clean.lastIndexOf('}')
  if (first === -1 || last <= first) return null
  try { return JSON.parse(clean.slice(first, last + 1)) } catch { return null }
}

const HOOK_FRAMEWORKS = [
  'Hyper-specific relatability',
  'Negative warning',
  'Emotional vulnerability',
  'POV/disguised advice',
  'Timeframe tension',
  'Direct callout',
  'Bold controversial claim',
  'Authority builder',
]

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  let body: {
    pillarName: string
    pillarRationale: string
    pillarIcpConnection: string
    condensedContext: string
    tone: string
    existingHooks: string[]
  }
  try { body = await request.json() } catch {
    return apiError('Invalid body', 400, 'INVALID_BODY')
  }

  const {
    pillarName, pillarRationale, pillarIcpConnection,
    condensedContext, tone, existingHooks
  } = body

  if (!pillarName || !condensedContext) {
    return apiError('Missing required fields', 400, 'VALIDATION_ERROR')
  }

  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: `You are a world-class social media copywriter for service businesses in 2026.
Write 5 fresh scroll-stopping hooks for one content pillar.
Each hook must use a DIFFERENT framework from this list:
${HOOK_FRAMEWORKS.map((f, i) => `${i + 1}. ${f}`).join('\n')}

RULES:
- 15-25 words each
- Must NOT duplicate or closely resemble these existing hooks: ${existingHooks.join(' | ')}
- Reference specific customer language, fear, or situation from the context
- Sounds like a real business owner talking, not a marketer
- Never starts with "Are you", "Do you", "Have you", or "Is your"

RESPONSE FORMAT: Single valid JSON object only.
Start with { and end with }. No markdown. No text before or after.`,
    messages: [{
      role: 'user',
      content: `Generate 5 fresh hooks for this pillar.

Pillar: "${pillarName}"
Rationale: ${pillarRationale}
ICP connection: ${pillarIcpConnection}
Tone: ${tone}

Business context:
${condensedContext}

Return exactly this JSON:
{"hooks":[{"text":"","framework":"framework name","charCount":0}]}`
    }],
  })

  const blocks = res.content.filter(b => b.type === 'text')
  const last = blocks[blocks.length - 1]
  if (!last || last.type !== 'text') {
    return apiError('No response from model', 500, 'GENERATION_FAILED')
  }

  const parsed = extractJSON(last.text)
  if (!parsed) {
    console.error('[HooksRegen] Parse failed:', last.text.slice(0, 200))
    return apiError('Failed to parse hooks', 500, 'PARSE_FAILED')
  }

  return apiSuccess({ hooks: parsed.hooks })
}
