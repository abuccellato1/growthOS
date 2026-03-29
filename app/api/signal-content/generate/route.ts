import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
    regenerationFeedback?: string
    generationNumber?: number
  }
  try { body = await request.json() } catch { return apiError('Invalid body', 400, 'INVALID_BODY') }

  const { businessId, platforms, postingFrequency, contentGoal, tone, topicsToAvoid, regenerationFeedback, generationNumber } = body
  if (!businessId || !platforms?.length || !postingFrequency || !contentGoal || !tone) {
    return apiError('Missing required fields', 400, 'VALIDATION_ERROR')
  }

  const adminClient = createAdminClient()

  const { data: biz } = await adminClient.from('businesses').select('customer_id').eq('id', businessId).single()
  if (!biz) return apiError('Business not found', 404, 'NOT_FOUND')
  const { data: cust } = await adminClient.from('customers').select('id').eq('id', biz.customer_id).eq('auth_user_id', auth.user.id).single()
  if (!cust) return apiError('Access denied', 403, 'FORBIDDEN')

  // Lightweight fetch — only what SignalContent needs
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
      .select('top_phrases, outcome_language, emotional_language, problem_language, review_highlights')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  const bizData = bizResult.data
  if (!bizData) return apiError('Business not found', 404, 'NOT_FOUND')

  const session = sessionResult.data
  if (!session) return apiError('SignalMap Interview required', 403, 'INTERVIEW_REQUIRED')

  const vocEntries = vocResult.data || []

  const research = bizData.business_research as Record<string, unknown> | null
  const icp = session.icp_core as Record<string, unknown> | null
  const messaging = session.messaging_data as Record<string, unknown> | null
  const content = session.content_data as Record<string, unknown> | null
  const proof = session.proof_assets as Record<string, unknown> | null
  const vocSignals = session.voice_of_customer_signals as Record<string, unknown> | null

  // Build VOC summary from raw entries
  const topPhrases = vocEntries.flatMap(v => (v.top_phrases as string[] | null) || []).filter((p, i, a) => a.indexOf(p) === i).slice(0, 10)
  const outcomeLanguage = vocEntries.flatMap(v => (v.outcome_language as string[] | null) || []).filter((p, i, a) => a.indexOf(p) === i).slice(0, 8)
  const emotionalLanguage = vocEntries.flatMap(v => (v.emotional_language as string[] | null) || []).filter((p, i, a) => a.indexOf(p) === i).slice(0, 8)
  const problemLanguage = vocEntries.flatMap(v => (v.problem_language as string[] | null) || []).filter((p, i, a) => a.indexOf(p) === i).slice(0, 8)
  const reviewHighlights = vocEntries.flatMap(v => (v.review_highlights as string[] | null) || []).slice(0, 3)

  const dataSources = {
    signalMap: true,
    customerSignals: topPhrases.length > 0,
    businessSignals: !!research,
  }

  const contentContext = `
BUSINESS: ${bizData.business_name}
PRIMARY SERVICE: ${bizData.primary_service}
WEBSITE: ${bizData.website_url || 'not provided'}
GEOGRAPHIC MARKET: ${bizData.geographic_market || 'not specified'}
BUSINESS TYPE: ${bizData.business_type || 'not specified'}

BUSINESS INTELLIGENCE (BusinessSignals):
What they do: ${research?.whatTheyDo || ''}
Primary product/service: ${research?.primaryProduct || ''}
Differentiators: ${research?.differentiators || ''}
Years in business: ${research?.yearsInBusiness || ''}
Services: ${((research?.services as string[] | null) || []).join(', ')}
Certifications/Awards: ${([...((research?.certifications as string[] | null) || []), ...((research?.awards as string[] | null) || [])]).join(', ')}
GMB rating: ${(research?.gmbData as Record<string, unknown> | undefined)?.averageRating || ''} (${(research?.gmbData as Record<string, unknown> | undefined)?.reviewCount || ''} reviews)
Testimonial themes: ${((research?.testimonialThemes as string[] | null) || []).join(', ')}

CONTENT INTELLIGENCE (SignalMap — content_data):
Awareness searches: ${((content?.awareness_searches as string[] | null) || []).join(', ')}
Problem clusters: ${((content?.problem_clusters as string[] | null) || []).join(', ')}
Consideration questions: ${((content?.consideration_questions as string[] | null) || []).join(', ')}
Content topics: ${((content?.content_topics as string[] | null) || []).join(', ')}
SEO keywords: ${((content?.seo_keyword_clusters as string[] | null) || []).join(', ')}
Buyer path: ${content?.buyer_path || ''}

IDEAL CUSTOMER PROFILE (SignalMap):
One-sentence ICP: ${icp?.one_sentence_icp || ''}
Archetype: ${icp?.archetype_name || ''}
External problem: ${icp?.external_problem || ''}
Internal problem: ${icp?.internal_problem || ''}
Primary fear: ${icp?.primary_fear || ''}
Dream outcome: ${icp?.dream_outcome_12months || ''}
Top objections: ${((icp?.top_objections as string[] | null) || []).join(', ')}
Where they show up: ${icp?.where_they_show_up || ''}
Buying triggers: ${((icp?.buying_triggers as string[] | null) || []).join(', ')}

MESSAGING FRAMEWORK (SignalMap):
Core positioning: ${messaging?.core_positioning_statement || ''}
Differentiator: ${messaging?.differentiator_statement || ''}
Trust statement: ${messaging?.trust_statement || ''}
Language that resonates: ${((messaging?.language_that_resonates as string[] | null) || []).join(', ')}
Language to AVOID: ${((messaging?.language_to_avoid as string[] | null) || []).join(', ')}

PROOF ASSETS (SignalMap):
Result metrics: ${((proof?.result_metrics as string[] | null) || []).join(', ')}
Testimonial themes: ${((proof?.testimonial_themes as string[] | null) || []).join(', ')}
Credential signals: ${((proof?.credential_signals as string[] | null) || []).join(', ')}

VOICE OF CUSTOMER — SESSION (SignalMap VOC):
Exact phrases: ${((vocSignals?.exact_phrases as string[] | null) || []).join(', ')}
Problem descriptions: ${((vocSignals?.problem_descriptions as string[] | null) || []).join(', ')}
Outcome descriptions: ${((vocSignals?.outcome_descriptions as string[] | null) || []).join(', ')}
Emotional language: ${((vocSignals?.emotional_language as string[] | null) || []).join(', ')}
Repeated themes: ${((vocSignals?.repeated_themes as string[] | null) || []).join(', ')}

VOICE OF CUSTOMER — REVIEWS (CustomerSignals):
Top phrases: ${topPhrases.join(', ')}
Outcome language: ${outcomeLanguage.join(', ')}
Emotional language: ${emotionalLanguage.join(', ')}
Problem language: ${problemLanguage.join(', ')}
Review highlights: ${reviewHighlights.join(' | ')}

DATA SOURCES POPULATED:
- SignalMap Interview: ${dataSources.signalMap ? 'YES' : 'NO'}
- CustomerSignals (VOC): ${dataSources.customerSignals ? 'YES' : 'NO'}
- BusinessSignals Research: ${dataSources.businessSignals ? 'YES' : 'NO'}

CONTENT SETTINGS:
Platforms requested: ${platforms.join(', ')}
Posting frequency: ${postingFrequency}
Primary content goal: ${contentGoal}
Brand tone: ${tone}
${topicsToAvoid ? `Topics to avoid: ${topicsToAvoid}` : ''}
${regenerationFeedback ? `REGENERATION FEEDBACK: ${regenerationFeedback}\nAddress this specifically in the new version.` : ''}
`

  // ── CALL 1: Strategy + Pillars 1-3 + Hooks ──────────────────────────────
  const call1Res = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: `You are an expert social media strategist and copywriter for service businesses. You write content that builds authority, generates leads, and sounds authentically human.

CRITICAL RULES:
1. Use EXACT customer language from VOC and CustomerSignals
2. Every pillar must connect to a specific ICP fear or buying trigger
3. Never use language flagged as "to avoid"
4. Hooks must stop the scroll — tension, curiosity, or bold claim
5. Only generate posts for platforms listed in CONTENT SETTINGS
6. LinkedIn: insight-driven, conversational, under 1000 chars total
7. Instagram: visual-first, hook under 100 chars before cutoff
8. Facebook: community-oriented, under 350 chars

HARD LIMITS PER POST (strictly enforced):
LinkedIn hook: 100 chars max
LinkedIn body: 600 chars max, 2 paragraphs max
LinkedIn cta: 80 chars max
Instagram hook: 100 chars max
Instagram caption: 250 chars max
Facebook post: 300 chars max
Each hashtag array: 4 hashtags max
hooks array: exactly 6 hooks, each under 12 words

CONCISENESS (prevent truncation):
icpConnection: one sentence max
theme: one sentence max
whyItWins: one sentence max
postingRationale: one sentence max
platformNotes: one sentence max
contentMix: one sentence max
testingRecommendations: exactly 2 items, one sentence each

RESPONSE FORMAT: Your entire response must be a single valid JSON object.
Start with { and end with } and nothing else.
No markdown fences. No text before or after. No explanations.`,
    messages: [{
      role: 'user',
      content: `Generate strategy signals, pillars 1-3, and hooks for this business.\n\n${contentContext}\n\nGenerate ONLY:\n- strategySignals\n- pillars array with exactly 3 pillars (pillars 1, 2, 3 of 5)\n- hooks array with exactly 6 hooks\n\nReturn this exact JSON:\n{"strategySignals":{"primaryTheme":"","whyItWins":"","dataSourcesUsed":[],"contentMix":"","postingRationale":"","platformNotes":"","testingRecommendations":["",""]},"pillars":[{"name":"","theme":"","icpConnection":"","unsplashQuery":"2-3 words","posts":{"linkedin":{"hook":"","body":"","cta":"","hashtags":[],"charCount":0},"instagram":{"hook":"","caption":"","cta":"","hashtags":[],"charCount":0},"facebook":{"post":"","cta":"","charCount":0}}}],"hooks":["","","","","",""]}`
    }],
  })

  const textBlocks1 = call1Res.content.filter(b => b.type === 'text')
  const lastBlock1 = textBlocks1[textBlocks1.length - 1]
  if (!lastBlock1 || lastBlock1.type !== 'text') return apiError('No response from call 1', 500, 'GENERATION_FAILED')

  let parsedCall1: Record<string, unknown>
  try {
    let raw1 = lastBlock1.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    const first1 = raw1.indexOf('{')
    const last1 = raw1.lastIndexOf('}')
    if (first1 === -1 || last1 <= first1) {
      console.error('[SignalContent Call1] No JSON found:', raw1.slice(0, 300))
      return apiError('No JSON in call 1 response', 500, 'PARSE_FAILED')
    }
    parsedCall1 = JSON.parse(raw1.slice(first1, last1 + 1))
  } catch (e) {
    console.error('[SignalContent Call1] Parse failed:', String(e))
    return apiError('Failed to parse call 1 JSON', 500, 'PARSE_FAILED')
  }

  // ── CALL 2: Pillars 4-5 ──────────────────────────────────────────────────
  const pillarNames1 = ((parsedCall1.pillars as Array<{name: string}>) || []).map(p => p.name)

  const call2Res = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    system: `You are an expert social media strategist and copywriter for service businesses.

Generate 2 more content pillars that are DISTINCT from the ones already created.
Already created pillars: ${pillarNames1.join(', ')}

HARD LIMITS PER POST:
LinkedIn hook: 100 chars max
LinkedIn body: 600 chars max, 2 paragraphs max
LinkedIn cta: 80 chars max
Instagram hook: 100 chars max
Instagram caption: 250 chars max
Facebook post: 300 chars max
Each hashtag array: 4 hashtags max

icpConnection: one sentence max
theme: one sentence max

RESPONSE FORMAT: Single valid JSON object. Start with {, end with }.
No markdown. No text before or after.`,
    messages: [{
      role: 'user',
      content: `Generate pillars 4 and 5 for this business.\n\n${contentContext}\n\nPlatforms: ${platforms.join(', ')}\nTone: ${tone}\nContent goal: ${contentGoal}\n\nReturn ONLY a pillars array with exactly 2 pillars:\n{"pillars":[{"name":"","theme":"","icpConnection":"","unsplashQuery":"2-3 words","posts":{"linkedin":{"hook":"","body":"","cta":"","hashtags":[],"charCount":0},"instagram":{"hook":"","caption":"","cta":"","hashtags":[],"charCount":0},"facebook":{"post":"","cta":"","charCount":0}}}]}`
    }],
  })

  const textBlocks2 = call2Res.content.filter(b => b.type === 'text')
  const lastBlock2 = textBlocks2[textBlocks2.length - 1]
  if (!lastBlock2 || lastBlock2.type !== 'text') return apiError('No response from call 2', 500, 'GENERATION_FAILED')

  let parsedCall2: { pillars?: Array<Record<string, unknown>> }
  try {
    let raw2 = lastBlock2.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    const first2 = raw2.indexOf('{')
    const last2 = raw2.lastIndexOf('}')
    if (first2 === -1 || last2 <= first2) {
      console.error('[SignalContent Call2] No JSON found:', raw2.slice(0, 300))
      parsedCall2 = { pillars: [] }
    } else {
      parsedCall2 = JSON.parse(raw2.slice(first2, last2 + 1))
    }
  } catch (e) {
    console.error('[SignalContent Call2] Parse failed:', String(e))
    parsedCall2 = { pillars: [] }
  }

  // ── Merge both calls ─────────────────────────────────────────────────────
  const allPillars = [
    ...((parsedCall1.pillars as Array<Record<string, unknown>>) || []),
    ...((parsedCall2.pillars as Array<Record<string, unknown>>) || []),
  ]

  const parsedContent: Record<string, unknown> = {
    ...parsedCall1,
    pillars: allPillars,
  }

  // Save core output — bonus content saved separately via /api/signal-content/bonus
  const { data: output } = await adminClient.from('module_outputs').insert({
    business_id: businessId,
    session_id: session.id,
    module_type: 'signal_content',
    generation_number: generationNumber || 1,
    form_inputs: { platforms, postingFrequency, contentGoal, tone, topicsToAvoid, regenerationFeedback: regenerationFeedback || null },
    input_snapshot: { contentContext: contentContext.slice(0, 5000) },
    output_data: parsedContent,
    status: 'complete',
    regenerations_used: (generationNumber || 1) - 1,
  }).select('id').single()

  return apiSuccess({
    content: parsedContent,
    outputId: output?.id || null,
    businessName: bizData.business_name,
    vocPhraseCount: topPhrases.length,
    bonusContext: {
      pillarNames: allPillars.map((p: Record<string, unknown>) => p.name as string),
      platforms,
      postingFrequency,
      contentGoal,
      tone,
      businessName: bizData.business_name,
      primaryService: bizData.primary_service || '',
    }
  })
}
