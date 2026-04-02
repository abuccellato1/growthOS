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
  } catch { return null }
}

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  let body: {
    businessId: string
    platforms: string[]
    postingFrequency: string
    contentGoal: string
    tone: string
    topicsToAvoid: string
  }
  try { body = await request.json() } catch {
    return apiError('Invalid body', 400, 'INVALID_BODY')
  }

  const { businessId, platforms, postingFrequency, contentGoal, tone, topicsToAvoid } = body
  if (!businessId || !platforms?.length || !postingFrequency || !contentGoal || !tone) {
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

  // Lightweight context fetch — only what pillar proposal needs
  const [bizResult, sessionResult, vocResult] = await Promise.all([
    adminClient
      .from('businesses')
      .select('id, business_name, primary_service, website_url, geographic_market, business_type, business_research')
      .eq('id', businessId)
      .single(),

    adminClient
      .from('sessions')
      .select('id, icp_core, messaging_data, content_data, proof_assets, voice_of_customer_signals')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .not('archived', 'is', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    adminClient
      .from('voice_of_customer')
      .select('top_phrases, outcome_language, emotional_language, problem_language')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  const bizData = bizResult.data
  if (!bizData) return apiError('Business not found', 404, 'NOT_FOUND')

  const session = sessionResult.data
  if (!session) return apiError('SignalMap Interview required', 403, 'INTERVIEW_REQUIRED')

  const vocEntries = vocResult.data || []
  const icp = session.icp_core as Record<string, unknown> | null
  const messaging = session.messaging_data as Record<string, unknown> | null
  const content = session.content_data as Record<string, unknown> | null
  const research = bizData.business_research as Record<string, unknown> | null

  const topPhrases = vocEntries
    .flatMap(v => (v.top_phrases as string[] | null) || [])
    .filter((p, i, a) => a.indexOf(p) === i).slice(0, 8)

  const emotionalLanguage = vocEntries
    .flatMap(v => (v.emotional_language as string[] | null) || [])
    .filter((p, i, a) => a.indexOf(p) === i).slice(0, 5)

  const condensedContext = `
BUSINESS: ${bizData.business_name} — ${bizData.primary_service || ''}
ICP ONE-LINER: ${(icp?.one_sentence_icp as string) || ''}
PRIMARY FEAR: ${(icp?.primary_fear as string) || ''}
DREAM OUTCOME: ${(icp?.dream_outcome_12months as string) || ''}
TOP OBJECTION: ${((icp?.top_objections as string[] | null)?.[0]) || ''}
CORE DIFFERENTIATOR: ${(messaging?.differentiator_statement as string) || ''}
LANGUAGE TO USE: ${((messaging?.language_that_resonates as string[] | null) || []).slice(0, 5).join(', ')}
LANGUAGE TO AVOID: ${((messaging?.language_to_avoid as string[] | null) || []).slice(0, 3).join(', ')}
TOP CUSTOMER PHRASES: ${topPhrases.slice(0, 6).join(', ')}
EMOTIONAL LANGUAGE: ${emotionalLanguage.join(', ')}
AWARENESS SEARCHES: ${((content?.awareness_searches as string[] | null) || []).slice(0, 4).join(', ')}
PROBLEM CLUSTERS: ${((content?.problem_clusters as string[] | null) || []).slice(0, 4).join(', ')}
CONTENT TOPICS: ${((content?.content_topics as string[] | null) || []).slice(0, 4).join(', ')}
GMB RATING: ${(research?.gmbData as Record<string, string> | null)?.averageRating || ''} stars
CONTENT GOAL: ${contentGoal}
PLATFORMS: ${platforms.join(', ')}
TONE: ${tone}
${topicsToAvoid ? `TOPICS TO AVOID: ${topicsToAvoid}` : ''}
`.trim()

  const res = await callWithRetry(() => anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    system: `You are a social media content strategist for service businesses.
Propose 5 distinct content pillars based on the business intelligence provided.
Each pillar must:
- Address a specific ICP fear, problem, or desire from the data
- Be distinct — no overlap between pillars
- Feel authentic to this specific business, not generic
- Use language from the customer phrases when possible

Pillar categories to draw from (use each at most once):
- Authority/expertise demonstration
- Customer transformation story
- Problem awareness / education
- Behind the scenes / process transparency
- Social proof / results
- Myth busting / industry truth
- Direct callout to ideal customer

RESPONSE FORMAT: Single valid JSON object only.
Start with { and end with }. No markdown. No text before or after.`,
    messages: [{
      role: 'user',
      content: `Propose 5 content pillars for this business.\n\n${condensedContext}\n\nReturn exactly this JSON:\n{"pillars":[{"name":"","rationale":"one sentence why this works for this ICP","icpConnection":"one sentence connecting to their specific fear or desire","category":"pillar category from the list"}]}`
    }],
  }))

  const blocks = res.content.filter(b => b.type === 'text')
  const last = blocks[blocks.length - 1]
  if (!last || last.type !== 'text') {
    return apiError('No response from model', 500, 'GENERATION_FAILED')
  }

  const parsed = extractJSON(last.text)
  if (!parsed) {
    console.error('[SignalContent Pillars] Parse failed:', last.text.slice(0, 300))
    return apiError('Failed to parse pillar proposals', 500, 'PARSE_FAILED')
  }

  return apiSuccess({
    pillars: parsed.pillars,
    condensedContext,
  })
}
