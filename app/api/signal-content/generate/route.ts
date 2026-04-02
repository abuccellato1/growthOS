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
    approvedPillars?: Array<{
      name: string
      rationale: string
      icpConnection: string
      category: string
    }>
    selectedHooks?: Array<{
      pillarName: string
      hook: string
      framework: string
    }>
    condensedContext?: string
  }
  try { body = await request.json() } catch { return apiError('Invalid body', 400, 'INVALID_BODY') }

  const { businessId, platforms, postingFrequency, contentGoal, tone,
          topicsToAvoid, regenerationFeedback, generationNumber,
          approvedPillars, selectedHooks, condensedContext: incomingContext } = body
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
    max_tokens: 6000,
    system: `You are an expert social media strategist and copywriter for service businesses. You write content that builds authority, generates leads, and sounds authentically human.

CRITICAL RULES:
1. Use EXACT customer language from VOC and CustomerSignals
2. Every pillar must connect to a specific ICP fear or buying trigger
3. Never use language flagged as "to avoid"
4. Hooks must stop the scroll — tension, curiosity, or bold claim
5. Only generate posts for platforms listed in CONTENT SETTINGS
6. LinkedIn: insight-driven, conversational
7. Instagram: visual-first, strong hook before cutoff
8. Facebook: community-oriented, warm, conversational

HARD LIMITS PER POST (strictly enforced):
LinkedIn hook: 100 chars max
LinkedIn body+cta: 900-1200 chars total
Instagram hook: 100 chars max
Instagram caption+cta: 300-450 chars total
Facebook post+cta: 200-350 chars total
Each hashtag array: 4 hashtags max
hooks array: exactly 6 hooks, each under 12 words

POST STRUCTURE — every post must follow the HOOK-VALUE-KNOCKOUT framework:

LINKEDIN (4 mandatory layers, 900-1200 chars total):
Layer 1 — HOOK (2 lines max):
  The attention grab. Uses one of the 8 hook frameworks above.
  Creates an open loop the reader must close.
Layer 2 — CONTEXT/WHY (3-5 sentences):
  Immediately validates the hook. Either:
  - A brief relatable story under 80 words ("Three months ago, a client...")
  - A surprising insight that reframes the problem
  - A before/after contrast that makes the transformation concrete
  Never repeat the hook. Immediately expand upon it.
Layer 3 — VALUE (3-5 punchy lines):
  Deliver the promised payoff. Use one of:
  - Numbered list of actionable tips ("1. Stop doing X 2. Start doing Y")
  - A "what most people miss" insight list
  - A clear before/after or old-way/new-way contrast
  Each line is one complete thought. No filler sentences.
Layer 4 — KNOCKOUT CTA (1 sentence):
  One action only. Choose from:
  - "Comment [word] and I'll send you [resource]"
  - "Save this — you'll need it when [trigger situation]"
  - "What's your experience with this? Drop it below"
  - "DM me [word] for [specific thing]"
  Never use generic CTAs like "follow for more" or "like if you agree"

INSTAGRAM (3 mandatory layers, 300-450 chars total):
Layer 1 — HOOK (first line, under 100 chars):
  Must earn the tap to "more". Ends with ... or creates undeniable curiosity.
Layer 2 — MICRO-STORY OR QUICK VALUE (3-6 short lines):
  Each line is one thought. Use line breaks aggressively.
  Either: a 3-sentence story with a twist, OR 3 quick actionable points.
  Use 1-2 emoji max for emphasis only.
Layer 3 — CTA (1 line):
  One action: "Save this", "Tag someone who needs this",
  "DM me [word]", or "Link in bio"

FACEBOOK (3 mandatory layers, 200-350 chars total):
Layer 1 — HOOK (1-2 conversational sentences):
  Sounds like a real business owner talking to their community.
  Warm, direct, specific to their situation.
Layer 2 — THE POINT (2-3 sentences):
  What happened, what worked, what they should know.
  One concrete detail or result (number, timeframe, specific outcome).
Layer 3 — ENGAGEMENT CTA (1 sentence):
  Ask a question to drive comments OR direct to website.
  Examples: "Have you run into this?" / "What's worked for you?"

WHAT SEPARATES GREAT FROM AVERAGE:
- Great: Every layer delivers on the hook's promise. No bait and switch.
- Great: The value is specific to THIS business's ICP — not generic tips
- Great: The CTA matches the content (don't ask them to buy after a story post)
- Average: Hook is strong but body is generic filler
- Average: Ends with "follow for more" or "like this post"
- Average: Lists generic tips that apply to any business in any industry

CONCISENESS (prevent truncation):
icpConnection: one sentence max
theme: one sentence max
whyItWins: one sentence max
postingRationale: one sentence max
platformNotes: one sentence max
contentMix: one sentence max
testingRecommendations: exactly 2 items, one sentence each
platformReadyText: assemble hook + body + cta + hashtags (with # prefix) into one paste-ready string using \\n\\n between sections

EXPANSION HOOKS — keep people reading past line 1:
A great post doesn't just have a strong opener. It has mini-hooks
throughout the body that create new open loops every 2-3 sentences.
Techniques:
- The "but here's the thing" pivot: introduce an idea then subvert it
- The numbered tease: "There are three reasons this happens. The first
  one surprised me."
- The callback: reference something from the hook in the final line
- The uncomfortable truth: mid-post, drop one sentence that challenges
  a common belief
Apply expansion hooks to LinkedIn body copy specifically. Instagram and
Facebook are too short — the opener carries them.

HASHTAG RULES:
- Return hashtags WITHOUT the # symbol — the UI adds it automatically
- LinkedIn: 3 hashtags max, broad professional topics only
- Instagram: 5 hashtags max, mix of niche and broad
- Facebook: 0-2 hashtags max or none
- WRONG: ["#marketing", "#business"] — do NOT include # in the array
- CORRECT: ["marketing", "business"] — words only, no # prefix

For strategySignals.dataSourcesUsed: list ONLY sources marked YES above,
using EXACTLY these labels (copy them verbatim):
- SignalMap data source → label: "SignalMap Interview"
- CustomerSignals data source → label: "CustomerSignals"
- BusinessSignals data source → label: "BusinessSignals"
Never use "VOC Session Data" or any other label. Use only the three above.

RESPONSE FORMAT: Your entire response must be a single valid JSON object.
Start with { and end with } and nothing else.
No markdown fences. No text before or after. No explanations.`,
    messages: [{
      role: 'user',
      content: `Generate strategy signals and pillars 1-3 for this business.\n\n${contentContext}\n\nGenerate ONLY:\n- strategySignals\n- pillars array with exactly 3 pillars (pillars 1, 2, 3 of 5)\n${approvedPillars && approvedPillars.length > 0 ? `\nAPPROVED PILLARS AND HOOKS FROM USER:\n${(approvedPillars || []).slice(0, 3).map((p, i) => `Pillar ${i+1}: ${p.name} — use hook: "${selectedHooks?.find(h => h.pillarName === p.name)?.hook || ''}"`).join('\n')}\n\nBuild every post body around the approved hook for that pillar.\nUse the pillar name exactly as written above.\n` : ''}\nReturn this exact JSON:\n{"strategySignals":{"primaryTheme":"","whyItWins":"","dataSourcesUsed":[],"contentMix":"","postingRationale":"","platformNotes":"","testingRecommendations":["",""]},"pillars":[{"name":"","theme":"","icpConnection":"","unsplashQuery":"2-3 words","posts":{"linkedin":{"hook":"","body":"","cta":"","hashtags":[],"charCount":0,"platformReadyText":"hook\\n\\nbody\\n\\ncta\\n\\n#hashtag1 #hashtag2 #hashtag3"},"instagram":{"hook":"","caption":"","cta":"","hashtags":[],"charCount":0,"platformReadyText":"hook\\n\\ncaption\\n\\ncta\\n\\n#hashtag1 #hashtag2"},"facebook":{"post":"","cta":"","charCount":0,"platformReadyText":"post\\n\\ncta"}}}]}`
    }],
  })

  const textBlocks1 = call1Res.content.filter(b => b.type === 'text')
  const lastBlock1 = textBlocks1[textBlocks1.length - 1]
  if (!lastBlock1 || lastBlock1.type !== 'text') return apiError('No response from call 1', 500, 'GENERATION_FAILED')

  let parsedCall1: Record<string, unknown>
  try {
    const raw1 = lastBlock1.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
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
    max_tokens: 4000,
    system: `You are an expert social media strategist and copywriter for service businesses.

Generate 2 more content pillars that are DISTINCT from the ones already created.
Already created pillars: ${pillarNames1.join(', ')}

HARD LIMITS:
LinkedIn hook: 100 chars max
LinkedIn body+cta: 900-1200 chars total
Instagram hook: 100 chars max
Instagram caption+cta: 300-450 chars total
Facebook post+cta: 200-350 chars total
Each hashtag array: 4 hashtags max
icpConnection: one sentence max
theme: one sentence max

POST STRUCTURE — follow the HOOK-VALUE-KNOCKOUT framework:

LINKEDIN (4 layers, 900-1200 chars):
1. HOOK — open loop using one hook framework
2. CONTEXT — brief story or insight that validates the hook (under 80 words)
3. VALUE — 3-5 punchy actionable lines (numbered list or contrast)
4. KNOCKOUT CTA — one specific action (comment word, save, DM, question)

INSTAGRAM (3 layers, 300-450 chars):
1. HOOK — under 100 chars, earns the "more" tap
2. MICRO-STORY OR VALUE — 3-6 lines with line breaks, one thought per line
3. CTA — one action (save, tag, DM word, link in bio)

FACEBOOK (3 layers, 200-350 chars):
1. HOOK — warm conversational opener specific to their situation
2. THE POINT — 2-3 sentences, one concrete detail or result
3. ENGAGEMENT CTA — question to drive comments or website link

HASHTAG RULES:
- Return hashtags WITHOUT the # symbol — the UI adds it automatically
- WRONG: ["#marketing", "#business"] — do NOT include # in the array
- CORRECT: ["marketing", "business"] — words only, no # prefix

RESPONSE FORMAT: Single valid JSON object. Start with {, end with }.
No markdown. No text before or after.`,
    messages: [{
      role: 'user',
      content: `Generate pillars 4 and 5 for this business.\n\n${contentContext}\n\nPlatforms: ${platforms.join(', ')}\nTone: ${tone}\nContent goal: ${contentGoal}\n${approvedPillars && approvedPillars.length > 3 ? `\nAPPROVED PILLARS 4-5 FROM USER:\n${approvedPillars.slice(3, 5).map((p, i) => `Pillar ${i+4}: ${p.name} — use hook: "${selectedHooks?.find(h => h.pillarName === p.name)?.hook || ''}"`).join('\n')}\n\nBuild every post body around the approved hook. Use pillar names exactly as written.\n` : ''}\nReturn ONLY a pillars array with exactly 2 pillars:\n{"pillars":[{"name":"","theme":"","icpConnection":"","unsplashQuery":"2-3 words","posts":{"linkedin":{"hook":"","body":"","cta":"","hashtags":[],"charCount":0,"platformReadyText":"hook\\n\\nbody\\n\\ncta\\n\\n#hashtag1 #hashtag2 #hashtag3"},"instagram":{"hook":"","caption":"","cta":"","hashtags":[],"charCount":0,"platformReadyText":"hook\\n\\ncaption\\n\\ncta\\n\\n#hashtag1 #hashtag2"},"facebook":{"post":"","cta":"","charCount":0,"platformReadyText":"post\\n\\ncta"}}}]}`
    }],
  })

  const textBlocks2 = call2Res.content.filter(b => b.type === 'text')
  const lastBlock2 = textBlocks2[textBlocks2.length - 1]
  if (!lastBlock2 || lastBlock2.type !== 'text') return apiError('No response from call 2', 500, 'GENERATION_FAILED')

  let parsedCall2: { pillars?: Array<Record<string, unknown>> }
  try {
    const raw2 = lastBlock2.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
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

  // Build condensed context for bonus route
  // Gives Haiku enough ICP + VOC data to write specific content
  const condensedContext = `
ICP ONE-LINER: ${(icp?.one_sentence_icp as string) || ''}
PRIMARY FEAR: ${(icp?.primary_fear as string) || ''}
DREAM OUTCOME: ${(icp?.dream_outcome_12months as string) || ''}
TOP OBJECTION: ${((icp?.top_objections as string[] | null)?.[0]) || ''}
CORE DIFFERENTIATOR: ${(messaging?.differentiator_statement as string) || ''}
LANGUAGE TO USE: ${((messaging?.language_that_resonates as string[] | null) || []).slice(0, 5).join(', ')}
LANGUAGE TO AVOID: ${((messaging?.language_to_avoid as string[] | null) || []).slice(0, 3).join(', ')}
TOP CUSTOMER PHRASES: ${topPhrases.slice(0, 5).join(', ')}
EMOTIONAL LANGUAGE: ${emotionalLanguage.slice(0, 4).join(', ')}
KEY PROOF: ${((proof?.result_metrics as string[] | null) || []).slice(0, 2).join(', ')}
`.trim()

  const finalCondensedContext = incomingContext || condensedContext

  return apiSuccess({
    content: parsedContent,
    outputId: output?.id || null,
    businessName: bizData.business_name,
    vocPhraseCount: topPhrases.length,
    bonusContext: {
      pillarNames: approvedPillars?.map(p => p.name) ||
        allPillars.map((p: Record<string, unknown>) => p.name as string),
      platforms,
      postingFrequency,
      contentGoal,
      tone,
      businessName: bizData.business_name,
      primaryService: bizData.primary_service || '',
      condensedContext: finalCondensedContext,
    }
  })
}
