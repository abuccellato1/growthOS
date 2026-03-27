import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildAgentContext } from '@/lib/agent-context'
import { calculateAndSaveScore } from '@/lib/signal-score'

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

  const context = await buildAgentContext(businessId)
  if (!context) return apiError('Failed to build context', 500, 'CONTEXT_ERROR')
  if (!context.readiness.hasInterview) return apiError('SignalMap Interview required', 403, 'INTERVIEW_REQUIRED')

  const icp = context.icpCore as Record<string, unknown> | null
  const messaging = context.messagingData as Record<string, unknown> | null
  const content = context.contentData as Record<string, unknown> | null
  const proof = context.proofAssets as Record<string, unknown> | null
  const vocSignals = context.voiceOfCustomerSignals as Record<string, unknown> | null
  const voc = context.vocSummary
  const bizData = context.business
  const research = bizData.business_research

  const dataSources = {
    signalMap: !!context.session,
    customerSignals: !!voc && (voc.topPhrases?.length > 0),
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
Services: ${JSON.stringify(research?.services || [])}
Certifications/Awards: ${JSON.stringify([...(research?.certifications || []), ...(research?.awards || [])])}
GMB rating: ${research?.gmbData?.averageRating || ''} (${research?.gmbData?.reviewCount || ''} reviews)
Testimonial themes: ${JSON.stringify(research?.testimonialThemes || [])}

CONTENT INTELLIGENCE (SignalMap — content_data):
Awareness searches: ${JSON.stringify(content?.awareness_searches || [])}
Problem clusters: ${JSON.stringify(content?.problem_clusters || [])}
Consideration questions: ${JSON.stringify(content?.consideration_questions || [])}
Content topics Alex identified: ${JSON.stringify(content?.content_topics || [])}
SEO keyword clusters: ${JSON.stringify(content?.seo_keyword_clusters || [])}
Buyer path: ${content?.buyer_path || ''}

IDEAL CUSTOMER PROFILE (SignalMap):
One-sentence ICP: ${icp?.one_sentence_icp || ''}
Archetype: ${icp?.archetype_name || ''}
External problem: ${icp?.external_problem || ''}
Internal problem: ${icp?.internal_problem || ''}
Primary fear: ${icp?.primary_fear || ''}
Dream outcome: ${icp?.dream_outcome_12months || ''}
Top objections: ${JSON.stringify(icp?.top_objections || [])}
Where they show up: ${icp?.where_they_show_up || ''}
Buying triggers: ${JSON.stringify(icp?.buying_triggers || [])}

MESSAGING FRAMEWORK (SignalMap):
Core positioning: ${messaging?.core_positioning_statement || ''}
Differentiator: ${messaging?.differentiator_statement || ''}
Trust statement: ${messaging?.trust_statement || ''}
Language that resonates: ${JSON.stringify(messaging?.language_that_resonates || [])}
Language to AVOID: ${JSON.stringify(messaging?.language_to_avoid || [])}

PROOF ASSETS (SignalMap):
Result metrics: ${JSON.stringify(proof?.result_metrics || [])}
Testimonial themes: ${JSON.stringify(proof?.testimonial_themes || [])}
Credential signals: ${JSON.stringify(proof?.credential_signals || [])}

VOICE OF CUSTOMER — SESSION (SignalMap VOC):
Exact phrases: ${JSON.stringify(vocSignals?.exact_phrases || [])}
Problem descriptions: ${JSON.stringify(vocSignals?.problem_descriptions || [])}
Outcome descriptions: ${JSON.stringify(vocSignals?.outcome_descriptions || [])}
Emotional language: ${JSON.stringify(vocSignals?.emotional_language || [])}
Repeated themes: ${JSON.stringify(vocSignals?.repeated_themes || [])}

VOICE OF CUSTOMER — REVIEWS (CustomerSignals):
Top phrases: ${JSON.stringify(voc?.topPhrases || [])}
Outcome language: ${JSON.stringify(voc?.outcomeLanguage || [])}
Emotional language: ${JSON.stringify(voc?.emotionalLanguage || [])}
Problem language: ${JSON.stringify(voc?.problemLanguage || [])}
Review highlights: ${(voc?.reviewHighlights || []).join(' | ')}

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

Return ONLY valid JSON. No markdown. No preamble. No trailing text.`,
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
    const jsonMatch = lastBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return apiError('No JSON in response', 500, 'PARSE_FAILED')
    parsedContent = JSON.parse(jsonMatch[0])
  } catch { return apiError('Failed to parse content JSON', 500, 'PARSE_FAILED') }

  // Save core output — bonus content saved separately via /api/signal-content/bonus
  const { data: output } = await adminClient.from('module_outputs').insert({
    business_id: businessId,
    session_id: context.session?.id || null,
    module_type: 'signal_content',
    generation_number: generationNumber || 1,
    form_inputs: { platforms, postingFrequency, contentGoal, tone, topicsToAvoid, regenerationFeedback: regenerationFeedback || null },
    input_snapshot: { contentContext: contentContext.slice(0, 5000) },
    output_data: parsedContent,
    status: 'complete',
    regenerations_used: (generationNumber || 1) - 1,
  }).select('id').single()

  calculateAndSaveScore(businessId).catch(() => null)

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
