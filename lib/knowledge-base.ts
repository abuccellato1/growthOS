import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type KBDomain = 'identity' | 'audience' | 'competitive' | 'performance' | 'assets' | 'zeno'

export interface KBIdentity {
  brandVoice?: string
  writingStyle?: string[]
  alwaysInclude?: string[]
  neverInclude?: string[]
  toneProfile?: string
  positioningStatement?: string
  differentiator?: string
  customSummary?: string
  lastUpdated?: string
}

export interface KBAudience {
  icpOneLiner?: string
  archetype?: string
  primaryFear?: string
  dreamOutcome?: string
  topObjections?: string[]
  buyingTriggers?: string[]
  languageThatWorks?: string[]
  languageToAvoid?: string[]
  whereTheyShowUp?: string[]
  lastUpdated?: string
}

export interface KBCompetitive {
  knownCompetitors?: string[]
  competitorWeaknesses?: string[]
  marketGaps?: string[]
  ourAdvantages?: string[]
  oversaturatedAngles?: string[]
  noraResearchSummaries?: Array<{ label: string; summary: string; date: string }>
  lastUpdated?: string
}

export interface KBPerformance {
  byModule?: {
    signal_ads?: {
      approvedAngles?: string[]
      rejectedAngles?: string[]
      approvedTones?: string[]
      rejectedPatterns?: string[]
      signalCount?: number
    }
    signal_content?: {
      approvedHooks?: string[]
      rejectedHooks?: string[]
      approvedFormats?: string[]
      rejectedPatterns?: string[]
      signalCount?: number
    }
    signal_sequences?: {
      approvedSubjectStyles?: string[]
      rejectedSubjectStyles?: string[]
      approvedTones?: string[]
      rejectedPatterns?: string[]
      signalCount?: number
    }
  }
  globalPatterns?: {
    whatAlwaysWorks?: string[]
    whatNeverWorks?: string[]
  }
  lastUpdated?: string
}

export interface KBAssets {
  uploadedFiles?: Array<{
    id: string
    filename: string
    storagePath: string
    mediaType: string
    size: number
    uploadedAt: string
    description?: string
    usedByAgents?: string[]
  }>
  activeProjects?: Array<{
    name: string
    goal: string
    status: string
    relatedOutputIds?: string[]
  }>
  lastUpdated?: string
}

export interface KBZeno {
  recommendations?: Array<{
    id: string
    text: string
    priority: 'high' | 'medium' | 'low'
    sourceAgents?: string[]
    targetAgent?: string
    status: 'pending' | 'dismissed' | 'done'
    createdAt: string
  }>
  healthScore?: number
  lastAnalysis?: string
  completedModules?: string[]
  missingModules?: string[]
}

export interface KnowledgeBase {
  id: string
  business_id: string
  identity: KBIdentity
  audience: KBAudience
  competitive: KBCompetitive
  performance: KBPerformance
  assets: KBAssets
  zeno: KBZeno
  identity_summary: string | null
  audience_summary: string | null
  competitive_summary: string | null
  performance_summary: string | null
  assets_summary: string | null
  initialized: boolean
  initialized_at: string | null
  created_at: string
  updated_at: string
}

export async function queryKB(
  businessId: string,
  domains: KBDomain[]
): Promise<Partial<KnowledgeBase> | null> {
  try {
    const adminClient = createAdminClient()

    const selectFields = [
      'id', 'business_id', 'initialized',
      ...domains.flatMap(d => {
        const fields: string[] = [d]
        if (d !== 'zeno') fields.push(`${d}_summary`)
        return fields
      }),
    ].join(', ')

    const { data } = await adminClient
      .from('knowledge_base')
      .select(selectFields)
      .eq('business_id', businessId)
      .single()

    return data as Partial<KnowledgeBase> | null
  } catch {
    return null
  }
}

export async function updateKB(
  businessId: string,
  domain: KBDomain,
  merge: Record<string, unknown>,
  regenerateSummary = true
): Promise<void> {
  try {
    const adminClient = createAdminClient()

    const { data: existing } = await adminClient
      .from('knowledge_base')
      .select(`id, ${domain}`)
      .eq('business_id', businessId)
      .maybeSingle()

    const existingDomain = (existing?.[domain as keyof typeof existing] as Record<string, unknown>) || {}

    const merged = deepMergeKB(existingDomain, merge)
    merged.lastUpdated = new Date().toISOString()

    const updatePayload: Record<string, unknown> = {
      [domain]: merged,
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      await adminClient
        .from('knowledge_base')
        .update(updatePayload)
        .eq('business_id', businessId)
    } else {
      await adminClient
        .from('knowledge_base')
        .insert({
          business_id: businessId,
          [domain]: merged,
        })
    }

    if (regenerateSummary && domain !== 'zeno') {
      regenerateDomainSummary(businessId, domain, merged).catch(() => null)
    }
  } catch (err) {
    console.error('updateKB error:', String(err))
  }
}

function deepMergeKB(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...existing }

  for (const [key, value] of Object.entries(incoming)) {
    if (value === null || value === undefined) continue

    if (Array.isArray(value) && Array.isArray(result[key])) {
      const combined = [...(result[key] as unknown[]), ...value]
      result[key] = combined.filter((item, index) => {
        if (typeof item === 'string') {
          return combined.indexOf(item) === index
        }
        return true
      }).slice(0, 50)
    } else if (
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key]) &&
      result[key] !== null
    ) {
      result[key] = deepMergeKB(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>
      )
    } else {
      result[key] = value
    }
  }

  return result
}

async function regenerateDomainSummary(
  businessId: string,
  domain: KBDomain,
  domainData: Record<string, unknown>
): Promise<void> {
  if (!domainData || Object.keys(domainData).length === 0) return

  const domainPrompts: Record<string, string> = {
    identity: 'Summarize this business identity data for a marketing AI agent in 3-4 concise sentences. Cover brand voice, positioning, and key differentiators. Be specific and actionable.',
    audience: 'Summarize this audience data for a marketing AI agent in 3-4 concise sentences. Cover who the customer is, their fears, desires, and the language that resonates. Be specific.',
    competitive: 'Summarize this competitive intelligence for a marketing AI agent in 3-4 concise sentences. Cover competitor weaknesses, market gaps, and angles to exploit. Be specific.',
    performance: 'Summarize this performance data for a marketing AI agent in 3-4 concise sentences. Cover what has worked, what has not, and patterns to apply going forward. Be specific.',
    assets: 'Summarize the available assets for a marketing AI agent in 2-3 concise sentences. List uploaded files and active projects briefly.',
  }

  const prompt = domainPrompts[domain]
  if (!prompt) return

  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `${prompt}\n\nDATA:\n${JSON.stringify(domainData, null, 2).slice(0, 3000)}`,
      }],
    })

    const summary = res.content
      .filter(b => b.type === 'text')
      .map(b => b.type === 'text' ? b.text : '')
      .join('')
      .trim()

    if (summary) {
      const adminClient = createAdminClient()
      await adminClient
        .from('knowledge_base')
        .update({ [`${domain}_summary`]: summary })
        .eq('business_id', businessId)
    }
  } catch {
    // Non-fatal
  }
}

export function buildKBContext(
  kb: Partial<KnowledgeBase> | null,
  domains: KBDomain[]
): string {
  if (!kb || !kb.initialized) return ''

  const sections: string[] = []

  for (const domain of domains) {
    const summaryKey = `${domain}_summary` as keyof KnowledgeBase
    const summary = kb[summaryKey] as string | null | undefined

    if (summary && typeof summary === 'string' && summary.trim()) {
      const labels: Record<string, string> = {
        identity: 'BRAND IDENTITY (from SignalBrain)',
        audience: 'AUDIENCE INTELLIGENCE (from SignalBrain)',
        competitive: 'COMPETITIVE INTELLIGENCE (from SignalBrain)',
        performance: 'WHAT WORKS FOR THIS BUSINESS (from SignalBrain)',
        assets: 'AVAILABLE ASSETS (from SignalBrain)',
      }
      sections.push(`${labels[domain] || domain.toUpperCase()}:\n${summary}`)
    }
  }

  if (sections.length === 0) return ''

  return `\n\nSIGNALBRAIN KNOWLEDGE BASE:\n${sections.join('\n\n')}\n`
}
