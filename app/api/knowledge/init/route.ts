import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateKB } from '@/lib/knowledge-base'

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  let body: { businessId: string }
  try { body = await request.json() } catch { return apiError('Invalid body', 400, 'INVALID_BODY') }
  const { businessId } = body
  if (!businessId) return apiError('Missing businessId', 400, 'VALIDATION_ERROR')

  const adminClient = createAdminClient()

  const { data: biz } = await adminClient
    .from('businesses')
    .select('*, customer_id')
    .eq('id', businessId)
    .single()
  if (!biz) return apiError('Business not found', 404, 'NOT_FOUND')
  const { data: cust } = await adminClient
    .from('customers')
    .select('id')
    .eq('id', biz.customer_id)
    .eq('auth_user_id', auth.user.id)
    .single()
  if (!cust) return apiError('Access denied', 403, 'FORBIDDEN')

  const [sessionResult, vocResult, researchSessionsResult] = await Promise.all([
    adminClient
      .from('sessions')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .not('archived', 'is', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    adminClient
      .from('voice_of_customer')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false }),
    adminClient
      .from('research_sessions')
      .select('vault_label, findings, created_at')
      .eq('business_id', businessId)
      .eq('vault_saved', true)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const session = sessionResult.data
  const vocEntries = vocResult.data || []
  const noraResearch = researchSessionsResult.data || []
  const research = biz.business_research as Record<string, unknown> | null
  const agentPrefs = biz.agent_preferences as Record<string, unknown> | null
  const styleMemory = biz.style_memory as Record<string, unknown> | null

  const domainsPopulated: string[] = []

  // IDENTITY domain
  const identityData: Record<string, unknown> = {}

  if (research) {
    identityData.positioningStatement = research.whatTheyDo || ''
    identityData.differentiator = research.differentiators || ''
    identityData.toneProfile = ''
  }

  if (session?.messaging_data) {
    const msg = session.messaging_data as Record<string, unknown>
    identityData.positioningStatement = msg.core_positioning_statement || identityData.positioningStatement
    identityData.differentiator = msg.differentiator_statement || identityData.differentiator
  }

  if (agentPrefs?.global) {
    const global = agentPrefs.global as Record<string, unknown>
    identityData.brandVoice = global.brandVoice || ''
    identityData.writingStyle = global.writingStyle || []
    identityData.alwaysInclude = global.alwaysInclude || []
    identityData.neverInclude = global.neverInclude || []
    identityData.toneProfile = global.tone || ''
  }

  if (Object.keys(identityData).some(k => identityData[k])) {
    await updateKB(businessId, 'identity', identityData, true)
    domainsPopulated.push('identity')
  }

  // AUDIENCE domain
  if (session) {
    const icp = session.icp_core as Record<string, unknown> | null
    const audienceData: Record<string, unknown> = {}

    if (icp) {
      audienceData.icpOneLiner = icp.one_sentence_icp || ''
      audienceData.archetype = icp.archetype || ''
      audienceData.primaryFear = icp.primary_fear || ''
      audienceData.dreamOutcome = icp.dream_outcome_12months || ''
      audienceData.topObjections = icp.top_objections || []
      audienceData.buyingTriggers = icp.buying_triggers || []
      audienceData.whereTheyShowUp = icp.where_they_show_up
        ? [icp.where_they_show_up as string]
        : []
    }

    if (vocEntries.length > 0) {
      const topPhrases = vocEntries
        .flatMap(v => (v.top_phrases as string[] | null) || [])
        .filter((p, i, arr) => arr.indexOf(p) === i)
        .slice(0, 15)
      const outcomeLanguage = vocEntries
        .flatMap(v => (v.outcome_language as string[] | null) || [])
        .filter((p, i, arr) => arr.indexOf(p) === i)
        .slice(0, 10)

      if (topPhrases.length) audienceData.languageThatWorks = topPhrases
      if (outcomeLanguage.length) audienceData.buyingTriggers = [
        ...((audienceData.buyingTriggers as string[]) || []),
        ...outcomeLanguage,
      ]
    }

    if (Object.keys(audienceData).some(k => audienceData[k])) {
      await updateKB(businessId, 'audience', audienceData, true)
      domainsPopulated.push('audience')
    }
  }

  // COMPETITIVE domain
  const competitiveData: Record<string, unknown> = {}

  if (session?.competitive_data) {
    const comp = session.competitive_data as Record<string, unknown>
    competitiveData.knownCompetitors = comp.known_competitors || []
    competitiveData.ourAdvantages = comp.competitive_advantages || []
    competitiveData.competitorWeaknesses = comp.competitor_weaknesses || []
    competitiveData.marketGaps = comp.market_gaps || []
  }

  if (noraResearch.length > 0) {
    competitiveData.noraResearchSummaries = noraResearch.map(r => ({
      label: r.vault_label || 'Research',
      summary: (r.findings as Record<string, unknown> | null)?.summary || '',
      date: r.created_at,
    }))
  }

  if (Object.keys(competitiveData).some(k => competitiveData[k])) {
    await updateKB(businessId, 'competitive', competitiveData, true)
    domainsPopulated.push('competitive')
  }

  // PERFORMANCE domain
  if (styleMemory) {
    const performanceData: Record<string, unknown> = { byModule: {} }
    const byModule = performanceData.byModule as Record<string, unknown>

    for (const [moduleKey, patterns] of Object.entries(styleMemory)) {
      if (typeof patterns === 'object' && patterns !== null) {
        byModule[moduleKey] = patterns
      }
    }

    if (Object.keys(byModule).length > 0) {
      await updateKB(businessId, 'performance', performanceData, true)
      domainsPopulated.push('performance')
    }
  }

  // Mark as initialized
  await adminClient
    .from('knowledge_base')
    .update({
      initialized: true,
      initialized_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('business_id', businessId)

  return apiSuccess({
    initialized: true,
    domainsPopulated,
    hasSignalMap: !!session,
    hasNoraResearch: noraResearch.length > 0,
    hasVOC: vocEntries.length > 0,
    hasCompetitive: !!session?.competitive_data,
  })
}
