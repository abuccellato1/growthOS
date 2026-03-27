/*
  Run in Supabase before deploying:
  ALTER TABLE public.module_outputs
  ADD COLUMN IF NOT EXISTS form_inputs jsonb;
*/

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
    goal: string
    platforms: string[]
    budget: string
    previousAttempts: string
    competitors: Array<{ name: string; website: string }>
    tone: string
    regenerationFeedback?: string
    generationNumber?: number
  }
  try { body = await request.json() } catch { return apiError('Invalid body', 400, 'INVALID_BODY') }

  const { businessId, goal, platforms, budget, previousAttempts, competitors, tone, regenerationFeedback, generationNumber } = body
  if (!businessId || !goal || !platforms?.length || !budget || !tone) {
    return apiError('Missing required fields', 400, 'VALIDATION_ERROR')
  }

  const adminClient = createAdminClient()

  // Verify ownership
  const { data: bizOwner } = await adminClient.from('businesses').select('customer_id').eq('id', businessId).single()
  if (!bizOwner) return apiError('Business not found', 404, 'NOT_FOUND')
  const { data: cust } = await adminClient.from('customers').select('id').eq('id', bizOwner.customer_id).eq('auth_user_id', auth.user.id).single()
  if (!cust) return apiError('Access denied', 403, 'FORBIDDEN')

  // Build context
  const context = await buildAgentContext(businessId)
  if (!context) return apiError('Failed to build context', 500, 'CONTEXT_ERROR')
  if (!context.readiness.hasInterview) return apiError('SignalMap Interview required', 403, 'INTERVIEW_REQUIRED')

  // Competitor research (non-fatal)
  const hasCompetitors = competitors.some(c => c.name.trim() || c.website.trim())
  let competitorIntel = ''

  if (hasCompetitors) {
    try {
      const competitorRes = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }] as Parameters<typeof anthropic.messages.create>[0]['tools'],
        system: `You are researching competitor advertising. Search Google Ads Transparency Center and Meta Ad Library for ads from these competitors. Extract: current ad headlines and angles, messaging themes, what they emphasize, and gaps they are NOT covering. Return ONLY valid JSON:
{"competitorAds":[{"competitor":"","headlines":[],"angles":[],"themes":[],"gaps":[]}],"oversaturatedAngles":[],"differentiationOpportunities":[]}`,
        messages: [{ role: 'user', content: `Research ads for these competitors:\n${competitors.filter(c => c.name || c.website).map(c => `- ${c.name}: ${c.website}`).join('\n')}\n\nSearch:\n1. https://adstransparency.google.com for each competitor\n2. https://www.facebook.com/ads/library for each competitor\n3. General Google search for "[competitor] ads examples"\n\nFocus on what messaging angles they use most.` }],
      })
      const textBlocks = competitorRes.content.filter(b => b.type === 'text')
      const lastBlock = textBlocks[textBlocks.length - 1]
      if (lastBlock?.type === 'text') {
        const jsonMatch = lastBlock.text.match(/\{[\s\S]*\}/)
        if (jsonMatch) { try { competitorIntel = JSON.stringify(JSON.parse(jsonMatch[0]), null, 2) } catch { /* non-fatal */ } }
      }
    } catch { /* non-fatal */ }
  }

  // Build context string
  const icp = context.icpCore as Record<string, unknown> | null
  const messaging = context.messagingData as Record<string, unknown> | null
  const targeting = context.targetingData as Record<string, unknown> | null
  const antiIcp = context.antiIcpSignals as Record<string, unknown> | null
  const proof = context.proofAssets as Record<string, unknown> | null
  const competitive = context.competitiveData as Record<string, unknown> | null
  const voc = context.vocSummary
  const bizData = context.business
  const research = bizData.business_research

  // Track which data sources are actually populated — passed to Sonnet so it
  // can populate strategySignals.dataSourcesUsed accurately
  const dataSources = {
    signalMap: !!context.session,
    customerSignals: !!voc && (voc.topPhrases?.length > 0),
    businessSignals: !!research,
    competitorResearch: !!competitorIntel,
  }

  const adContext = `
BUSINESS: ${bizData.business_name}
PRIMARY SERVICE: ${bizData.primary_service}
WEBSITE: ${bizData.website_url || 'not provided'}
GEOGRAPHIC MARKET: ${bizData.geographic_market || 'not specified'}
BUSINESS TYPE: ${bizData.business_type || 'not specified'}

BUSINESS INTELLIGENCE (BusinessSignals — scraped from website + GMB):
What they do: ${research?.whatTheyDo || ''}
Primary product/service: ${research?.primaryProduct || ''}
Differentiators found on website: ${research?.differentiators || ''}
Years in business: ${research?.yearsInBusiness || ''}
Services: ${JSON.stringify(research?.services || [])}
Service areas: ${JSON.stringify(research?.serviceAreas || [])}
Team size: ${research?.teamSize || ''}
Certifications/Awards: ${JSON.stringify([...(research?.certifications || []), ...(research?.awards || [])])}
Pricing signals: ${research?.pricingSignals || ''}
Website quality notes: ${research?.websiteQuality || ''}
GMB rating: ${research?.gmbData?.averageRating || ''} (${research?.gmbData?.reviewCount || ''} reviews)
GMB categories: ${research?.gmbData?.categories || ''}

COMPETITIVE LANDSCAPE (from SignalMap Interview with Alex):
Known competitors: ${JSON.stringify(competitive?.known_competitors || [])}
Competitive advantages: ${JSON.stringify(competitive?.competitive_advantages || [])}
Market positioning: ${competitive?.market_positioning || ''}
Competitive gaps: ${JSON.stringify(competitive?.competitive_gaps || [])}
Why customers choose them over competitors: ${competitive?.why_choose_us || ''}
Competitor weaknesses: ${JSON.stringify(competitive?.competitor_weaknesses || [])}

IDEAL CUSTOMER PROFILE (SignalMap):
One-sentence ICP: ${icp?.one_sentence_icp || ''}
Archetype: ${icp?.archetype_name || ''}
External problem: ${icp?.external_problem || ''}
Internal problem: ${icp?.internal_problem || ''}
Primary fear: ${icp?.primary_fear || ''}
Dream outcome: ${icp?.dream_outcome_12months || ''}
Top objections: ${JSON.stringify(icp?.top_objections || [])}
Trust signals: ${icp?.trust_signals || ''}
Where they show up: ${icp?.where_they_show_up || ''}
Buying triggers: ${JSON.stringify(icp?.buying_triggers || [])}

MESSAGING FRAMEWORK (SignalMap):
Core positioning: ${messaging?.core_positioning_statement || ''}
Differentiator: ${messaging?.differentiator_statement || ''}
Trust statement: ${messaging?.trust_statement || ''}
Language that resonates: ${JSON.stringify(messaging?.language_that_resonates || [])}
Language to AVOID: ${JSON.stringify(messaging?.language_to_avoid || [])}
Ad angle - problem led: ${(messaging?.ad_angles as Record<string, unknown> | undefined)?.problem_led || ''}
Ad angle - outcome led: ${(messaging?.ad_angles as Record<string, unknown> | undefined)?.outcome_led || ''}
Ad angle - differentiator: ${(messaging?.ad_angles as Record<string, unknown> | undefined)?.differentiator_led || ''}

TARGETING (SignalMap):
Job titles: ${JSON.stringify(targeting?.job_titles || [])}
Industries: ${JSON.stringify(targeting?.industries || [])}
Company sizes: ${JSON.stringify(targeting?.company_sizes || [])}
Geographic targets: ${JSON.stringify(targeting?.geographic_targets || [])}

PROOF ASSETS (SignalMap):
Result metrics: ${JSON.stringify(proof?.result_metrics || [])}
Testimonial themes: ${JSON.stringify(proof?.testimonial_themes || [])}
Credential signals: ${JSON.stringify(proof?.credential_signals || [])}

CUSTOMER VOICE (CustomerSignals — real reviews + VOC extraction):
Top phrases: ${JSON.stringify(voc?.topPhrases || [])}
Outcome language: ${JSON.stringify(voc?.outcomeLanguage || [])}
Emotional language: ${JSON.stringify(voc?.emotionalLanguage || [])}
Problem language: ${JSON.stringify(voc?.problemLanguage || [])}
Review highlights: ${(voc?.reviewHighlights || []).join(' | ')}

ANTI-ICP (SignalMap):
Who to exclude: ${antiIcp?.who_to_exclude || ''}
Wrong messaging angles: ${JSON.stringify(antiIcp?.wrong_messaging || [])}
Negative keywords: ${JSON.stringify(antiIcp?.negative_keywords || [])}

DATA SOURCES POPULATED:
- SignalMap Interview: ${dataSources.signalMap ? 'YES' : 'NO'}
- CustomerSignals (VOC): ${dataSources.customerSignals ? 'YES' : 'NO'}
- BusinessSignals Research: ${dataSources.businessSignals ? 'YES' : 'NO'}
- Competitor Ad Research: ${dataSources.competitorResearch ? 'YES — use competitorIntel above' : 'NO — generate from ICP data only'}

AD CAMPAIGN SETTINGS:
Goal: ${goal}
Budget range: ${budget}
Brand tone: ${tone}
${previousAttempts ? `What didn't work before: ${previousAttempts}` : ''}
${regenerationFeedback ? `REGENERATION FEEDBACK FROM USER: ${regenerationFeedback}\nIMPORTANT: Address this feedback specifically.` : ''}
${competitorIntel ? `COMPETITOR AD LIBRARY INTELLIGENCE:\n${competitorIntel}\nExploit their gaps. Avoid their saturated angles.` : ''}
`

  // Generate with Sonnet
  const generationRes = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: `You are an expert performance marketing copywriter specializing in service businesses. You write ad copy that converts because it speaks exactly to the customer's psychology, uses their own language, and addresses their real fears and desires.

CRITICAL RULES:
1. Use the customer's EXACT language from CustomerSignals when possible
2. Every headline must address a specific fear, desire, or trigger from the ICP
3. Never use language flagged as "to avoid"
4. Address primary objections in descriptions
5. Use specific numbers from proof assets when available

HARD CHARACTER LIMITS — THESE ARE ABSOLUTE MAXIMUMS, NOT GUIDELINES.
DO NOT EXCEED THESE UNDER ANY CIRCUMSTANCES:
Google Search Headlines: EXACTLY 30 chars max — count every character
Google Search Descriptions: EXACTLY 90 chars max
Meta Primary Text: 125 chars recommended max
Meta Headline: EXACTLY 40 chars max
LinkedIn Intro Text: EXACTLY 150 chars max
LinkedIn Headline: EXACTLY 70 chars max

Before finalizing your JSON, verify EVERY text field character count.
If any field exceeds its limit, rewrite it until it fits.
Character count includes spaces and punctuation.

Return ONLY valid JSON. No markdown. No preamble.`,
    messages: [{ role: 'user', content: `Generate a complete ad library for this business.\n\n${adContext}\n\nPLATFORMS REQUESTED: ${platforms.join(', ')}\n\nFor strategySignals.dataSourcesUsed: list only the sources marked YES above, using these exact labels: "SignalMap Interview", "CustomerSignals", "BusinessSignals", "Competitor Research".\n\nFor strategySignals.whyItWins: explain in 2-3 sentences specifically which data points drove the primary angle — reference actual facts from the context (e.g. specific differentiators, VOC phrases, competitor gaps).\n\nReturn ONLY valid JSON, no markdown, no preamble:\n{\n  "strategySignals": {\n    "primaryAngle": "",\n    "keyDifferentiator": "",\n    "whyItWins": "",\n    "dataSourcesUsed": [],\n    "competitorInsights": "",\n    "funnelApproach": "",\n    "messagingHierarchy": "",\n    "budgetAllocation": "",\n    "platformRationale": "",\n    "negativeKeywords": [],\n    "testingRecommendations": []\n  },\n  "googleSearchAds": {\n    "headlines": [{"text": "", "charCount": 0, "angle": ""}],\n    "descriptions": [{"text": "", "charCount": 0}],\n    "adVariations": [{"name": "", "headlines": ["", "", ""], "descriptions": ["", ""], "notes": ""}]\n  },\n  "metaAds": {\n    "primaryTexts": [{"text": "", "charCount": 0, "hook": ""}],\n    "headlines": [{"text": "", "charCount": 0}],\n    "adSets": [{"name": "", "primaryText": "", "headline": "", "description": "", "cta": "", "targetingNotes": ""}],\n    "audienceTargeting": {"coreAudiences": [], "interests": [], "behaviors": [], "customAudiences": [], "lookalikes": ""},\n    "messagingNotes": ""\n  },\n  "linkedInAds": {\n    "sponsoredContent": [{"introText": "", "headline": "", "description": "", "cta": ""}],\n    "targeting": {"jobTitles": [], "industries": [], "companySizes": [], "skills": []},\n    "messagingNotes": ""\n  }\n}` }],
  })

  // Parse
  const textBlocks = generationRes.content.filter(b => b.type === 'text')
  const lastBlock = textBlocks[textBlocks.length - 1]
  if (!lastBlock || lastBlock.type !== 'text') return apiError('No response from generation', 500, 'GENERATION_FAILED')

  let parsedAds: Record<string, unknown>
  try {
    const jsonMatch = lastBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return apiError('No JSON in response', 500, 'PARSE_FAILED')
    parsedAds = JSON.parse(jsonMatch[0])
  } catch { return apiError('Failed to parse ads JSON', 500, 'PARSE_FAILED') }

  // Save to module_outputs
  const { data: output } = await adminClient.from('module_outputs').insert({
    business_id: businessId,
    session_id: context.session?.id || null,
    module_type: 'signal_ads',
    generation_number: generationNumber || 1,
    form_inputs: { goal, platforms, budget, tone, previousAttempts, competitors: competitors.filter(c => c.name || c.website), regenerationFeedback: regenerationFeedback || null, hadCompetitorResearch: hasCompetitors },
    input_snapshot: { adContext: adContext.slice(0, 5000) },
    output_data: parsedAds,
    status: 'complete',
    regenerations_used: (generationNumber || 1) - 1,
  }).select('id').single()

  calculateAndSaveScore(businessId).catch(() => null)

  return apiSuccess({ ads: parsedAds, outputId: output?.id || null })
}
