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

  const generationRes = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: `You are an expert social media strategist and copywriter for service businesses. You write content that builds authority, generates leads, and sounds authentically human — never corporate or generic.

CRITICAL RULES:
1. Use the customer's EXACT language from CustomerSignals and VOC signals whenever possible
2. Every pillar must connect to a specific ICP fear, desire, or buying trigger from the SignalMap
3. Never use language flagged as "to avoid"
4. Hooks must stop the scroll — lead with tension, curiosity, or a bold claim
5. Each post must sound like a real person wrote it, not a marketing tool
6. Only generate posts for platforms listed in CONTENT SETTINGS
7. LinkedIn posts: conversational and insight-driven, longer form acceptable
8. Instagram: visual-first language, emoji appropriate, strong hook before cutoff
9. Facebook: community-oriented, conversational, shorter than LinkedIn

HARD CHARACTER LIMITS:
LinkedIn: 3000 chars max (aim under 1300 for best engagement)
Instagram caption: 2200 chars max (hook must be under 150 chars before "more" cutoff)
Facebook: 500 chars recommended max

For strategySignals.dataSourcesUsed: list ONLY sources marked YES using exact labels: "SignalMap Interview", "CustomerSignals", "BusinessSignals"
For strategySignals.whyItWins: 2-3 sentences citing specific data points that drove pillar selection — reference actual content topics, VOC phrases, or ICP fears from the context above.

RESPONSE FORMAT: Your entire response must be a single valid JSON object.
Do not include any text before the opening { brace.
Do not include any text after the closing } brace.
Do not wrap in markdown code fences.
Do not include explanations, notes, or commentary.
Start your response with { and end with } and nothing else.`,
    messages: [{
      role: 'user',
      content: `Generate a complete social media content library for this business.\n\n${contentContext}\n\nGenerate exactly 5 content pillars. For each pillar, only generate posts for platforms listed in CONTENT SETTINGS. Each post object for a platform not in the list should be omitted entirely — do not include empty objects.\n\nReturn this exact JSON:\n{"strategySignals":{"primaryTheme":"","whyItWins":"","dataSourcesUsed":[],"contentMix":"","postingRationale":"","platformNotes":"","testingRecommendations":[]},"pillars":[{"name":"","theme":"","icpConnection":"","unsplashQuery":"","posts":{"linkedin":{"hook":"","body":"","cta":"","hashtags":[],"charCount":0},"instagram":{"hook":"","caption":"","cta":"","hashtags":[],"charCount":0},"facebook":{"post":"","cta":"","charCount":0}}}],"hooks":[]}`
    }],
  })

  const textBlocks = generationRes.content.filter(b => b.type === 'text')
  const lastBlock = textBlocks[textBlocks.length - 1]
  if (!lastBlock || lastBlock.type !== 'text') return apiError('No response from generation', 500, 'GENERATION_FAILED')

  let parsedContent: Record<string, unknown>
  try {
    let rawText = lastBlock.text

    // Strip markdown code fences if present
    rawText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

    // Find the outermost JSON object — find first { and last }
    const firstBrace = rawText.indexOf('{')
    const lastBrace = rawText.lastIndexOf('}')

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      console.error('[SignalContent] No JSON braces found. Response preview:', rawText.slice(0, 300))
      return apiError('No JSON in response', 500, 'PARSE_FAILED')
    }

    const jsonString = rawText.slice(firstBrace, lastBrace + 1)
    parsedContent = JSON.parse(jsonString)
  } catch (parseErr) {
    console.error('[SignalContent] JSON parse failed:', String(parseErr))
    return apiError('Failed to parse content JSON', 500, 'PARSE_FAILED')
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
    // Pass back what bonus route needs — pillar names + form inputs
    bonusContext: {
      pillarNames: (parsedContent.pillars as Array<{ name: string }>)?.map(p => p.name) || [],
      platforms,
      postingFrequency,
      contentGoal,
      tone,
      businessName: bizData.business_name,
      primaryService: bizData.primary_service,
    }
  })
}
