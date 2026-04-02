import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'

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
    platforms: string[]
    postingFrequency: string
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
    businessId, outputId, pillarNames, platforms,
    postingFrequency, contentGoal, tone, businessName,
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
  const platformList = platforms.join(', ')

  // ── Two parallel Haiku calls ──────────────────────────────────────────────

  const [calendarRes, formatsRes] = await Promise.allSettled([

    // Call 1 — Content Calendar only
    callWithRetry(() => anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: `You generate a 4-week social media content calendar for service businesses.

CRITICAL RULES FOR CORRECT GENERATION:
- For EACH posting day, generate ONE entry PER PLATFORM
- Example: "5x/week" + LinkedIn + Instagram + Facebook = 15 entries per week
  (5 days × 3 platforms = 15 entries)
- Example: "3x/week" + LinkedIn + Facebook = 6 entries per week
  (3 days × 2 platforms = 6 entries)
- Posting days are always weekdays (Mon-Fri) distributed evenly
- For "3x/week": use Mon, Wed, Fri
- For "5x/week": use Mon, Tue, Wed, Thu, Fri
- For "Daily": use Mon, Tue, Wed, Thu, Fri, Sat, Sun
- Rotate through the 5 pillars sequentially across posting days
- Each week should have the same structure
- scheduledDate is always null

RESPONSE FORMAT: Single valid JSON object only.
Start with { and end with }. No markdown. No text before or after.`,
      messages: [{
        role: 'user',
        content: `Generate a 4-week content calendar for ${businessName} (${safeService}).

Pillars: ${pillarList}
Platforms: ${platformList}
Posting frequency: ${postingFrequency}

IMPORTANT: Generate one entry per platform per posting day.
If platforms are LinkedIn, Instagram, Facebook and frequency is 5x/week:
- Week has 5 posting days (Mon-Fri)
- Each day has 3 entries (one per platform)
- 15 entries total per week, 60 entries across 4 weeks
- Pillars rotate: Day 1 = Pillar 1, Day 2 = Pillar 2, etc, then repeat

Each platform on each day gets the SAME pillar for that day.
postType options: "Educational", "Story", "Social Proof", "Authority", "Engagement"
Rotate postTypes across the weeks for variety.

Return exactly this JSON:
{"contentCalendar":{"week1":[{"day":"Mon","platform":"LinkedIn","pillar":"pillar name","postType":"Educational","scheduledDate":null},{"day":"Mon","platform":"Instagram","pillar":"pillar name","postType":"Educational","scheduledDate":null}],"week2":[],"week3":[],"week4":[]}}`
      }],
    })),

    // Call 2 — Bonus formats only (reels, carousels, stories)
    callWithRetry(() => anthropic.messages.create({
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
    })),

  ])

  // ── Extract results (non-fatal per call) ──────────────────────────────────

  let calendarData: Record<string, unknown> = {}
  let formatsData: Record<string, unknown> = {}

  if (calendarRes.status === 'fulfilled') {
    const blocks = calendarRes.value.content.filter(b => b.type === 'text')
    const last = blocks[blocks.length - 1]
    if (last?.type === 'text') {
      const parsed = extractJSON(last.text)
      if (parsed) {
        calendarData = parsed
      } else {
        console.error('[SignalContent Bonus Calendar] Parse failed. Preview:',
          last.text.slice(0, 300))
      }
    }
  } else {
    console.error('[SignalContent Bonus Calendar] Call failed:',
      calendarRes.reason)
  }

  if (formatsRes.status === 'fulfilled') {
    const blocks = formatsRes.value.content.filter(b => b.type === 'text')
    const last = blocks[blocks.length - 1]
    if (last?.type === 'text') {
      const parsed = extractJSON(last.text)
      if (parsed) {
        formatsData = parsed
      } else {
        console.error('[SignalContent Bonus Formats] Parse failed. Preview:',
          last.text.slice(0, 300))
      }
    }
  } else {
    console.error('[SignalContent Bonus Formats] Call failed:',
      formatsRes.reason)
  }

  const parsedBonus = { ...calendarData, ...formatsData }

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
