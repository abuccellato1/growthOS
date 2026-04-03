import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildAgentContext } from '@/lib/agent-context'
import { calculateAndSaveScore } from '@/lib/signal-score'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function buildGenerationLearningProfile(
  styleMemory: Record<string, unknown> | null,
  agentPreferences: Record<string, unknown> | null,
  moduleType: string,
  agentName: string
): string {
  const parts: string[] = []

  const global = (agentPreferences?.global as Record<string, unknown>) || {}
  if (global.customSummary || global.brandVoice) {
    parts.push('BRAND INSTRUCTIONS (user-defined — apply exactly):')
    if (global.customSummary) parts.push(global.customSummary as string)
    else if (global.brandVoice) parts.push(`Voice: ${global.brandVoice}`)
    if ((global.alwaysInclude as string[])?.length > 0)
      parts.push(`Always include: ${(global.alwaysInclude as string[]).join(', ')}`)
    if ((global.neverInclude as string[])?.length > 0)
      parts.push(`Never include: ${(global.neverInclude as string[]).join(', ')}`)
    if ((global.writingStyle as string[])?.length > 0)
      parts.push(`Writing style: ${(global.writingStyle as string[]).join(', ')}`)
  }

  const agentPrefs = (
    (agentPreferences?.[moduleType] as Record<string, unknown>)?.[agentName.toLowerCase()] as Record<string, unknown>
  ) || {}
  if (agentPrefs.instructions) {
    parts.push(`\n${agentName} INSTRUCTIONS (user-defined):`)
    parts.push(agentPrefs.instructions as string)
  }

  const learned = (
    (styleMemory?.[moduleType] as Record<string, unknown>)?.[agentName.toLowerCase()] as Record<string, unknown>
  ) || {}
  const signalCount = (learned.signalCount as number) || 0
  if (signalCount >= 3) {
    parts.push(`\nLEARNED PREFERENCES (${signalCount} signals):`)
    if ((learned.approvedAngles as string[])?.length > 0)
      parts.push(`Angles that worked: ${(learned.approvedAngles as string[]).join(', ')}`)
    if ((learned.rejectedAngles as string[])?.length > 0)
      parts.push(`Angles to avoid: ${(learned.rejectedAngles as string[]).join(', ')}`)
    if ((learned.tonePreferences as string[])?.length > 0)
      parts.push(`Effective tone: ${(learned.tonePreferences as string[]).join(', ')}`)
    if ((learned.avoidTones as string[])?.length > 0)
      parts.push(`Tone to avoid: ${(learned.avoidTones as string[]).join(', ')}`)
    if ((learned.avoidWords as string[])?.length > 0)
      parts.push(`Words to avoid: ${(learned.avoidWords as string[]).join(', ')}`)
    if ((learned.preferredWords as string[])?.length > 0)
      parts.push(`Words that resonate: ${(learned.preferredWords as string[]).join(', ')}`)
  }

  return parts.length > 0
    ? `\nBUSINESS LEARNING PROFILE\n${parts.join('\n')}\n`
    : ''
}

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  let body: {
    businessId: string
    sequenceType: string
    tone: string
    topicsToAvoid: string
    esp?: string
    regenerationFeedback?: string
    generationNumber?: number
  }
  try { body = await request.json() } catch { return apiError('Invalid body', 400, 'INVALID_BODY') }

  const { businessId, sequenceType, tone, topicsToAvoid, esp, regenerationFeedback, generationNumber } = body
  if (!businessId || !sequenceType || !tone) {
    return apiError('Missing required fields', 400, 'VALIDATION_ERROR')
  }

  const adminClient = createAdminClient()

  const { data: bizOwner } = await adminClient.from('businesses').select('customer_id').eq('id', businessId).single()
  if (!bizOwner) return apiError('Business not found', 404, 'NOT_FOUND')
  const { data: cust } = await adminClient.from('customers').select('id').eq('id', bizOwner.customer_id).eq('auth_user_id', auth.user.id).single()
  if (!cust) return apiError('Access denied', 403, 'FORBIDDEN')

  const context = await buildAgentContext(businessId)
  if (!context) return apiError('Failed to build context', 500, 'CONTEXT_ERROR')
  if (!context.readiness.hasInterview) return apiError('SignalMap Interview required', 403, 'INTERVIEW_REQUIRED')

  const icp = context.icpCore as Record<string, unknown> | null
  const messaging = context.messagingData as Record<string, unknown> | null
  const proof = context.proofAssets as Record<string, unknown> | null
  const competitive = context.competitiveData as Record<string, unknown> | null
  const antiIcp = context.antiIcpSignals as Record<string, unknown> | null
  const voc = context.vocSummary
  const bizData = context.business

  const { data: bizPrefs } = await adminClient
    .from('businesses')
    .select('style_memory, agent_preferences')
    .eq('id', businessId)
    .single()

  const learningProfile = buildGenerationLearningProfile(
    bizPrefs?.style_memory as Record<string, unknown> | null,
    bizPrefs?.agent_preferences as Record<string, unknown> | null,
    'signal_sequences',
    'emily'
  )
  const research = bizData.business_research

  const dataSources = {
    signalMap: !!context.session,
    customerSignals: !!voc && (voc.topPhrases?.length > 0),
    businessSignals: !!research,
  }

  const sequenceContext = `
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
Pricing signals: ${research?.pricingSignals || ''}
GMB rating: ${research?.gmbData?.averageRating || ''} (${research?.gmbData?.reviewCount || ''} reviews)

IDEAL CUSTOMER PROFILE (SignalMap):
One-sentence ICP: ${icp?.one_sentence_icp || ''}
Archetype: ${icp?.archetype_name || ''}
External problem: ${icp?.external_problem || ''}
Internal problem: ${icp?.internal_problem || ''}
Primary fear: ${icp?.primary_fear || ''}
Dream outcome: ${icp?.dream_outcome_12months || ''}
Top objections: ${JSON.stringify(icp?.top_objections || [])}
Trust signals: ${icp?.trust_signals || ''}
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

COMPETITIVE LANDSCAPE (SignalMap):
Competitive advantages: ${JSON.stringify(competitive?.competitive_advantages || [])}
Why customers choose them: ${competitive?.why_choose_us || ''}
Market positioning: ${competitive?.market_positioning || ''}

CUSTOMER VOICE (CustomerSignals):
Top phrases: ${JSON.stringify(voc?.topPhrases || [])}
Outcome language: ${JSON.stringify(voc?.outcomeLanguage || [])}
Emotional language: ${JSON.stringify(voc?.emotionalLanguage || [])}
Problem language: ${JSON.stringify(voc?.problemLanguage || [])}
Review highlights: ${(voc?.reviewHighlights || []).join(' | ')}

ANTI-ICP (SignalMap):
Who to exclude: ${antiIcp?.who_to_exclude || ''}
Wrong messaging angles: ${JSON.stringify(antiIcp?.wrong_messaging || [])}

DATA SOURCES POPULATED:
- SignalMap Interview: ${dataSources.signalMap ? 'YES' : 'NO'}
- CustomerSignals (VOC): ${dataSources.customerSignals ? 'YES' : 'NO'}
- BusinessSignals Research: ${dataSources.businessSignals ? 'YES' : 'NO'}

SEQUENCE SETTINGS:
Sequence type: ${sequenceType}
Brand tone: ${tone}
${topicsToAvoid ? `Topics to avoid: ${topicsToAvoid}` : ''}
${regenerationFeedback ? `REGENERATION FEEDBACK FROM USER: ${regenerationFeedback}\nIMPORTANT: Address this feedback specifically in the new sequence.` : ''}
`

  const sequenceTypeDescriptions: Record<string, string> = {
    welcome_nurture: 'Welcome / Lead Nurture — Turns new subscribers into engaged prospects. Flow: Welcome + deliver value → Authority/story → Quick win (teach something) → Problem awareness → Soft offer/next step.',
    sales_offer: 'Sales / Offer — Converts warm leads into customers. Flow: Problem → agitation → solution → Case study/proof → Objection handling → Offer + urgency.',
    abandoned_action: 'Abandoned Action / Recovery — Recaptures lost conversions from people who started but didn\'t finish. Flow: Reminder → Benefits + reassurance → Social proof → Incentive (optional).',
    onboarding: 'Onboarding / Customer Experience — Turns new customers into successful users fast. Flow: Welcome + what to expect → Getting started → Key features/steps → Pro tips → Support/check-in.',
    reengagement: 'Re-engagement / Win-Back — Reactivates cold subscribers. Flow: "Still interested?" → New value/offer → Incentive → Final notice (stay or unsubscribe).',
    upsell_crosssell: 'Upsell / Cross-Sell — Increases customer lifetime value after purchase or milestone. Flow: Achievement acknowledgment → Next logical step → Value of upgrade → Social proof from upgraded customers → Offer.',
  }

  const sequenceDesc = sequenceTypeDescriptions[sequenceType] || sequenceType

  const generationRes = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: `You are an expert email copywriter for service businesses. You write email sequences that convert because they speak to real customer psychology, use their own language, and move them naturally through a decision journey.

CRITICAL RULES:
1. Use the customer's EXACT language from CustomerSignals when possible
2. Every email must address specific fears, desires, or triggers from the ICP
3. Never use language flagged as "to avoid"
4. Build each email on the last — create real narrative momentum
5. Subject lines must earn the open — specific, curious, or outcome-focused
6. Preview text must complement (not repeat) the subject line
7. CTAs must be specific and low-friction — never "click here"
8. Use specific numbers and proof from proof assets when available

Return ONLY valid JSON. No markdown. No preamble.`,
    messages: [{
      role: 'user',
      content: `Generate a 5-email sequence for this business.

${sequenceContext}
${learningProfile}
SEQUENCE TYPE TO GENERATE: ${sequenceDesc}

For strategySignals.dataSourcesUsed: list only sources marked YES above, using exact labels: "SignalMap Interview", "CustomerSignals", "BusinessSignals".

For strategySignals.whyItWorks: explain in 2-3 sentences which specific data points shaped this sequence — reference actual facts (ICP fears, VOC phrases, differentiators, objections addressed).

Return ONLY valid JSON, no markdown, no preamble:
{
  "strategySignals": {
    "sequenceGoal": "",
    "primaryAngle": "",
    "whyItWorks": "",
    "dataSourcesUsed": [],
    "icpStageTargeted": "",
    "keyObjectionsAddressed": [],
    "toneNotes": ""
  },
  "emails": [
    {
      "emailNumber": 1,
      "title": "",
      "purpose": "",
      "subjectLine": "",
      "previewText": "",
      "body": "",
      "cta": "",
      "ctaUrl": "{{your_link}}",
      "sendTiming": ""
    }
  ]
}

Generate exactly 5 emails. Body should be full email copy (150-300 words), ready to use with only light personalization needed.`
    }],
  })

  const textBlocks = generationRes.content.filter(b => b.type === 'text')
  const lastBlock = textBlocks[textBlocks.length - 1]
  if (!lastBlock || lastBlock.type !== 'text') return apiError('No response from generation', 500, 'GENERATION_FAILED')

  let parsedSequence: Record<string, unknown>
  try {
    const jsonMatch = lastBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return apiError('No JSON in response', 500, 'PARSE_FAILED')
    parsedSequence = JSON.parse(jsonMatch[0])
  } catch { return apiError('Failed to parse sequence JSON', 500, 'PARSE_FAILED') }

  const { data: output } = await adminClient.from('module_outputs').insert({
    business_id: businessId,
    session_id: context.session?.id || null,
    module_type: 'signal_sequences',
    generation_number: generationNumber || 1,
    form_inputs: { sequenceType, tone, topicsToAvoid, esp: esp || 'none', regenerationFeedback: regenerationFeedback || null },
    input_snapshot: { sequenceContext: sequenceContext.slice(0, 5000) },
    output_data: parsedSequence,
    status: 'complete',
    regenerations_used: (generationNumber || 1) - 1,
  }).select('id').single()

  calculateAndSaveScore(businessId).catch(() => null)

  return apiSuccess({ sequence: parsedSequence, outputId: output?.id || null })
}
