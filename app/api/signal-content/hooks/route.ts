import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function callWithRetry(
  fn: () => Promise<Anthropic.Message>,
  retries = 3,
  delayMs = 2000
): Promise<Anthropic.Message> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const status = (err as { status?: number }).status
      if (status === 529 && attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)))
        continue
      }
      throw err
    }
  }
  throw new Error('Max retries exceeded')
}

function extractJSON(text: string): Record<string, unknown> | null {
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const first = clean.indexOf('{')
  const last = clean.lastIndexOf('}')
  if (first === -1 || last <= first) return null
  try {
    return JSON.parse(clean.slice(first, last + 1))
  } catch { return null }
}

const HOOK_FRAMEWORKS = [
  'Hyper-specific relatability — a moment so specific it feels personal',
  'Negative warning — pain avoidance outperforms benefit chasing',
  'Emotional vulnerability — confessional honesty that disarms skepticism',
  'POV/disguised advice — lower defenses with scenario framing',
  'Timeframe tension — transformation implies speed',
  'Direct callout — speak directly to the niche for algorithm targeting',
  'Bold controversial claim — challenge what they believe',
  'Authority builder — experience creates permission to teach',
]

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  let body: {
    approvedPillars: Array<{
      name: string
      rationale: string
      icpConnection: string
      category: string
    }>
    condensedContext: string
    tone: string
  }
  try { body = await request.json() } catch {
    return apiError('Invalid body', 400, 'INVALID_BODY')
  }

  const { approvedPillars, condensedContext, tone } = body
  if (!approvedPillars?.length || !condensedContext) {
    return apiError('Missing required fields', 400, 'VALIDATION_ERROR')
  }

  const res = await callWithRetry(() => anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2500,
    system: `You are a world-class social media copywriter for service businesses in 2026.
Write scroll-stopping hooks that feel human, specific, and emotionally resonant.

HOOK FRAMEWORKS — use a DIFFERENT framework for each hook:
${HOOK_FRAMEWORKS.map((f, i) => `${i + 1}. ${f}`).join('\n')}

RULES FOR EVERY HOOK:
- 15-25 words (long enough to create a full open loop)
- References specific customer language, fear, or situation from the context
- Sounds like a real business owner talking, not a marketer
- Never starts with "Are you", "Do you", "Have you", or "Is your"
- Never uses generic phrases like "game-changer", "transform your business"
- Uses language from TOP CUSTOMER PHRASES when possible
- Avoids all LANGUAGE TO AVOID from the context

For each pillar generate exactly 3 hooks using 3 DIFFERENT frameworks.
Vary frameworks across pillars — do not repeat the same framework more than twice total.

RESPONSE FORMAT: Single valid JSON object only.
Start with { and end with }. No markdown. No text before or after.`,
    messages: [{
      role: 'user',
      content: `Generate 3 hooks per pillar for these approved content pillars.

BUSINESS INTELLIGENCE:
${condensedContext}

TONE: ${tone}

APPROVED PILLARS:
${approvedPillars.map((p, i) => `${i + 1}. ${p.name} — ${p.rationale} — ICP connection: ${p.icpConnection}`).join('\n')}

Return exactly this JSON (3 hooks per pillar, each with a different framework):
{"pillarHooks":[{"pillarName":"","hooks":[{"text":"","framework":"framework name from the list","charCount":0}]}]}`
    }],
  }))

  const blocks = res.content.filter(b => b.type === 'text')
  const last = blocks[blocks.length - 1]
  if (!last || last.type !== 'text') {
    return apiError('No response from model', 500, 'GENERATION_FAILED')
  }

  const parsed = extractJSON(last.text)
  if (!parsed) {
    console.error('[SignalContent Hooks] Parse failed:', last.text.slice(0, 300))
    return apiError('Failed to parse hooks', 500, 'PARSE_FAILED')
  }

  return apiSuccess({ pillarHooks: parsed.pillarHooks })
}
