import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function extractJSON(text: string): Record<string, unknown> | null {
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const first = clean.indexOf('{')
  const last = clean.lastIndexOf('}')
  if (first === -1 || last <= first) return null
  try {
    return JSON.parse(clean.slice(first, last + 1))
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  let body: {
    businessId: string
    outputId: string
    pillarNames: string[]
    platforms?: string[]
    postingFrequency?: string
    contentGoal: string
    tone: string
    businessName: string
    primaryService: string
    condensedContext?: string
  }
  try { body = await request.json() } catch {
    return apiError('Invalid body', 400, 'INVALID_BODY')
  }

  const {
    businessId, outputId, pillarNames,
    contentGoal, tone, businessName,
    primaryService, condensedContext
  } = body

  if (!businessId || !outputId || !pillarNames?.length) {
    return apiError('Missing required fields', 400, 'VALIDATION_ERROR')
  }

  const adminClient = createAdminClient()

  const { data: biz } = await adminClient
    .from('businesses').select('customer_id').eq('id', businessId).single()
  if (!biz) return apiError('Business not found', 404, 'NOT_FOUND')

  const { data: cust } = await adminClient
    .from('customers').select('id')
    .eq('id', biz.customer_id).eq('auth_user_id', auth.user.id).single()
  if (!cust) return apiError('Access denied', 403, 'FORBIDDEN')

  const safeService = primaryService || businessName || 'service business'
  const pillarList = pillarNames.map((n, i) => `Pillar ${i + 1}: ${n}`).join(', ')


  // Single Haiku call — bonus formats only (calendar now in generate route)
  const formatsResult = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      system: `You generate bonus social media content formats for service businesses.
Write content that is SPECIFIC to this exact business — not generic.
Use the customer intelligence below to make every script and framework
feel like it was written by someone who deeply knows this business.

BUSINESS INTELLIGENCE:
${condensedContext || 'Use the pillar names and business context provided.'}

STRICT LENGTH LIMITS:
- reel hook: 15 words max
- reel segment script: 15 words max per segment
- reel captionSuggestion: 10 words max
- carousel headline: 6 words max
- carousel bodyText: 12 words max
- story frame text: 6 words max
- story stickerSuggestion: 3 words max

Generate exactly: 3 reels, 3 carousels, 2 stories. No more.

QUALITY RULES:
- Every hook must reference a specific customer fear or desire from the intelligence above
- Use exact phrases from TOP CUSTOMER PHRASES when possible
- Never use language from LANGUAGE TO AVOID
- Reel hooks should use one of: negative warning, emotional vulnerability,
  hyper-specific relatability, or direct callout
- Carousel cover slides should tease a transformation or insight
- Story frames should feel urgent and scrollable

RESPONSE FORMAT: Single valid JSON object only.
Start with { and end with }. No markdown fences. No text before or after.
Never truncate — shorten field values if running long.`,
      messages: [{
        role: 'user',
        content: `Generate bonus content formats for ${businessName} (${safeService}).

Pillars: ${pillarList}
Tone: ${tone}
Content goal: ${contentGoal}

STRICT OUTPUT RULES — do not exceed these counts:
- Each reel: exactly 2 segments (not 3, not 4 — exactly 2)
- Each carousel: exactly 4 slides (cover + 3 body + closing = 5 total objects)
- Each story: exactly 3 frames (not 4)
- Generate exactly 3 reels, 3 carousels, 2 stories

Keep all text fields very short. Scripts and captions must be under 15 words each.

Return exactly this JSON (no markdown, no fences, start with {):
{"reelScripts":[{"pillar":"","totalDuration":"30s","hook":"","segments":[{"timeCode":"0-5s","script":"","visualNote":""},{"timeCode":"5-25s","script":"","visualNote":""}],"cta":"","captionSuggestion":""}],"carouselFrameworks":[{"pillar":"","slideCount":5,"coverSlide":{"headline":"","subtext":""},"slides":[{"slideNumber":1,"headline":"","bodyText":"","visualNote":""},{"slideNumber":2,"headline":"","bodyText":"","visualNote":""},{"slideNumber":3,"headline":"","bodyText":"","visualNote":""}],"closingSlide":{"cta":"","text":""}}],"storySequences":[{"pillar":"","frameCount":3,"frames":[{"frameNumber":1,"text":"","visualNote":"","stickerSuggestion":""},{"frameNumber":2,"text":"","visualNote":"","stickerSuggestion":""},{"frameNumber":3,"text":"","visualNote":"","stickerSuggestion":""}]}]}`
      }],
  })

  // Parse formats
  let parsedBonus: Record<string, unknown> = {}
  const formatsBlocks = formatsResult.content.filter(b => b.type === 'text')
  const formatsLast = formatsBlocks[formatsBlocks.length - 1]
  if (formatsLast?.type === 'text') {
    const parsed = extractJSON(formatsLast.text)
    if (parsed) {
      parsedBonus = parsed
    } else {
      console.error('[SignalContent Bonus] Parse failed. Preview:',
        formatsLast.text.slice(0, 300))
    }
  }

  // ── Merge into existing module_output ─────────────────────────────────────

  const { data: existing } = await adminClient
    .from('module_outputs')
    .select('output_data')
    .eq('id', outputId)
    .single()

  if (existing?.output_data) {
    const { error: mergeError } = await adminClient
      .from('module_outputs')
      .update({
        output_data: {
          ...(existing.output_data as Record<string, unknown>),
          ...parsedBonus,
        }
      })
      .eq('id', outputId)

    if (mergeError) {
      console.error('[SignalContent Bonus] Merge failed:', mergeError.message)
    }
  }

  return apiSuccess({ bonus: parsedBonus })
}
