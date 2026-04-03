import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildAgentContext } from '@/lib/agent-context'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const AGENT_CONFIG: Record<string, {
  name: string
  personality: string
  specialty: string
  constraints: string
}> = {
  signal_ads: {
    name: 'Jaimie',
    personality: 'You are Jaimie, a sharp performance marketing specialist. You are data-driven, direct, and know exactly what makes ad copy convert. You never waste words. You back your suggestions with reasoning tied to the ICP data.',
    specialty: 'Google Search Ads, Meta Ads, and LinkedIn Ads copy',
    constraints: 'Google headlines: 30 chars max. Google descriptions: 90 chars max. Meta primary text: 125 chars recommended. Meta headlines: 40 chars max. LinkedIn intro: 150 chars max. Always flag if a suggestion exceeds limits.',
  },
  signal_content: {
    name: 'Sofia',
    personality: 'You are Sofia, a creative director with deep platform expertise. You have cultural sharpness and know what stops the scroll. You push for specificity over generality and always think about the visual and the caption together.',
    specialty: 'Social media content — LinkedIn, Instagram, Facebook posts and hooks',
    constraints: 'LinkedIn posts: 1300 chars max, hooks matter most. Instagram captions: conversational, max 5 hashtags. Facebook: community-first tone. Always preserve the hook structure.',
  },
  signal_sequences: {
    name: 'Emily',
    personality: 'You are Emily, an email specialist who understands the psychology of the inbox. You are empathetic, persuasive, and protect narrative flow across a sequence. You know that each email builds on the last and never sacrifice the sequence arc for a single email.',
    specialty: 'Email sequences — subject lines, preview text, body copy, and CTAs',
    constraints: 'Subject lines: specific and curiosity-driven. Preview text: must complement not repeat subject. CTAs: finish a sentence, never say "click here". Body: 150-300 words, narrative momentum across sequence.',
  },
}

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  let body: {
    businessId: string
    moduleType: string
    outputId: string
    currentOutput: Record<string, unknown>
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
    userMessage: string
  }
  try { body = await request.json() } catch { return apiError('Invalid body', 400, 'INVALID_BODY') }

  const { businessId, moduleType, outputId, currentOutput, messages, userMessage } = body
  if (!businessId || !moduleType || !userMessage) {
    return apiError('Missing required fields', 400, 'VALIDATION_ERROR')
  }

  const adminClient = createAdminClient()
  const { data: biz } = await adminClient.from('businesses').select('customer_id').eq('id', businessId).single()
  if (!biz) return apiError('Business not found', 404, 'NOT_FOUND')
  const { data: cust } = await adminClient.from('customers').select('id').eq('id', biz.customer_id).eq('auth_user_id', auth.user.id).single()
  if (!cust) return apiError('Access denied', 403, 'FORBIDDEN')

  const agent = AGENT_CONFIG[moduleType]
  if (!agent) return apiError('Unknown module type', 400, 'INVALID_MODULE')

  const context = await buildAgentContext(businessId)
  const icp = context?.icpCore as Record<string, unknown> | null
  const messaging = context?.messagingData as Record<string, unknown> | null
  const voc = context?.vocSummary

  const businessContext = `
BUSINESS CONTEXT:
ICP: ${icp?.one_sentence_icp || ''}
Primary fear: ${icp?.primary_fear || ''}
Dream outcome: ${icp?.dream_outcome_12months || ''}
Top objections: ${JSON.stringify(icp?.top_objections || [])}
Core positioning: ${messaging?.core_positioning_statement || ''}
Language that resonates: ${JSON.stringify(messaging?.language_that_resonates || [])}
Language to AVOID: ${JSON.stringify(messaging?.language_to_avoid || [])}
Customer voice phrases: ${JSON.stringify(voc?.topPhrases || [])}
`

  // Call 1: Haiku — classify intent and identify target field
  const classifyRes = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: `You are a classifier. Analyze the user message and the current output and return ONLY valid JSON:
{
  "intent": "refine" | "question" | "general",
  "targetField": "string or null",
  "targetIdentifier": "string or null"
}

intent: "refine" = user wants to change something specific
intent: "question" = user is asking why something was written a certain way
intent: "general" = general feedback or conversation

targetField: the specific field they want changed (e.g. "subjectLine", "headline", "body", "cta", "previewText", "primaryText")
targetIdentifier: additional context to identify which item (e.g. "email_2", "google_headline_3", "meta_adset_1")

Return ONLY valid JSON, no markdown.`,
    messages: [{
      role: 'user',
      content: `Current output summary: ${JSON.stringify(currentOutput).slice(0, 1000)}\n\nUser message: ${userMessage}`
    }]
  })

  let intent = 'general'
  let targetField: string | null = null
  let targetIdentifier: string | null = null

  try {
    const classifyText = classifyRes.content.filter(b => b.type === 'text').map(b => b.type === 'text' ? b.text : '').join('')
    const classified = JSON.parse(classifyText.match(/\{[\s\S]*\}/)?.[0] || '{}')
    intent = classified.intent || 'general'
    targetField = classified.targetField || null
    targetIdentifier = classified.targetIdentifier || null
  } catch { /* use defaults */ }

  // Call 2: Sonnet — generate response and optional patch
  const systemPrompt = `${agent.personality}

Your specialty: ${agent.specialty}
Constraints: ${agent.constraints}

${businessContext}

CURRENT OUTPUT YOU ARE WORKING WITH:
${JSON.stringify(currentOutput, null, 2).slice(0, 3000)}

INSTRUCTIONS:
- Respond conversationally as ${agent.name} — warm but expert, never robotic
- Keep responses concise — 1-3 sentences of explanation max
- When making a change, return a patch object with the exact field and new value
- When answering a question, just respond conversationally with no patch
- Always tie your reasoning to the ICP data or business context when relevant
- Never make changes the user didn't ask for

Return ONLY valid JSON:
{
  "message": "your conversational response",
  "patch": {
    "target": "fieldName_identifier",
    "value": "the new content"
  } | null
}`

  const refineRes = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: systemPrompt,
    messages: [
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage }
    ]
  })

  const refineText = refineRes.content.filter(b => b.type === 'text').map(b => b.type === 'text' ? b.text : '').join('')

  let agentMessage = ''
  let patch: { target: string; value: string } | null = null

  try {
    const parsed = JSON.parse(refineText.match(/\{[\s\S]*\}/)?.[0] || '{}')
    agentMessage = parsed.message || 'I ran into an issue — could you rephrase that?'
    patch = parsed.patch || null
  } catch {
    agentMessage = refineText.slice(0, 500) || 'Something went wrong — try again.'
  }

  // Save patch to module_outputs if a change was made
  if (patch && outputId) {
    try {
      const { data: existing } = await adminClient
        .from('module_outputs')
        .select('output_data')
        .eq('id', outputId)
        .single()

      if (existing) {
        // Log the refinement in output_data metadata
        const outputData = existing.output_data as Record<string, unknown>
        const refinements = (outputData._refinements as unknown[] || [])
        refinements.push({
          agent: agent.name,
          target: patch.target,
          value: patch.value,
          userMessage,
          refinedAt: new Date().toISOString(),
        })
        await adminClient
          .from('module_outputs')
          .update({ output_data: { ...outputData, _refinements: refinements } })
          .eq('id', outputId)
      }
    } catch { /* non-fatal */ }
  }

  return apiSuccess({
    agentName: agent.name,
    message: agentMessage,
    patch,
    intent,
    targetField,
    targetIdentifier,
  })
}
