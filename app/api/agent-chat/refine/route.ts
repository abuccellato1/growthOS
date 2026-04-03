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
  outOfScope: string
}> = {
  signal_ads: {
    name: 'Jaimie',
    personality: 'You are Jaimie, a sharp performance marketing specialist. You are data-driven, direct, and know exactly what makes ad copy convert. You never waste words. You back your suggestions with reasoning tied to the ICP data.',
    specialty: 'Google Search Ads, Meta Ads, and LinkedIn Ads copy',
    constraints: 'Google headlines: 30 chars max. Google descriptions: 90 chars max. Meta primary text: 125 chars recommended. Meta headlines: 40 chars max. LinkedIn intro: 150 chars max. Always flag if a suggestion exceeds limits.',
    outOfScope: 'email sequences, social media posts, blog content, or anything outside paid advertising',
  },
  signal_content: {
    name: 'Sofia',
    personality: 'You are Sofia, a creative director with deep platform expertise. You have cultural sharpness and know what stops the scroll. You push for specificity over generality and always think about the visual and the caption together.',
    specialty: 'Social media content \u2014 LinkedIn, Instagram, Facebook posts and hooks',
    constraints: 'LinkedIn posts: 1300 chars max, hooks matter most. Instagram captions: conversational, max 5 hashtags. Facebook: community-first tone. Always preserve the hook structure.',
    outOfScope: 'paid ads, email sequences, or long-form content outside social platforms',
  },
  signal_sequences: {
    name: 'Emily',
    personality: 'You are Emily, an email specialist who understands the psychology of the inbox. You are empathetic, persuasive, and protect narrative flow across a sequence. You know that each email builds on the last and never sacrifice the sequence arc for a single email.',
    specialty: 'Email sequences \u2014 subject lines, preview text, body copy, and CTAs',
    constraints: 'Subject lines: specific and curiosity-driven. Preview text: must complement not repeat subject. CTAs: finish a sentence, never say "click here". Body: 150-300 words, narrative momentum across sequence.',
    outOfScope: 'paid ads, social media posts, or anything outside email marketing',
  },
}

function buildLearningProfile(
  styleMemory: Record<string, unknown> | null,
  agentPreferences: Record<string, unknown> | null,
  moduleType: string,
  agentName: string
): string {
  const parts: string[] = []

  const global = (agentPreferences?.global as Record<string, unknown>) || {}
  if (global.customSummary || global.brandVoice || global.alwaysInclude || global.neverInclude) {
    parts.push('BRAND INSTRUCTIONS (follow these exactly \u2014 user-defined):')
    if (global.customSummary) parts.push(global.customSummary as string)
    else if (global.brandVoice) parts.push(`Voice: ${global.brandVoice}`)
    if ((global.alwaysInclude as string[])?.length > 0) {
      parts.push(`Always include: ${(global.alwaysInclude as string[]).join(', ')}`)
    }
    if ((global.neverInclude as string[])?.length > 0) {
      parts.push(`Never include: ${(global.neverInclude as string[]).join(', ')}`)
    }
    if ((global.writingStyle as string[])?.length > 0) {
      parts.push(`Writing style: ${(global.writingStyle as string[]).join(', ')}`)
    }
  }

  const agentPrefs = (
    (agentPreferences?.[moduleType] as Record<string, unknown>)?.[agentName.toLowerCase()] as Record<string, unknown>
  ) || {}
  if (agentPrefs.instructions) {
    parts.push(`\n${agentName.toUpperCase()}-SPECIFIC INSTRUCTIONS (user-defined):`)
    parts.push(agentPrefs.instructions as string)
    if ((agentPrefs.alwaysInclude as string[])?.length > 0) {
      parts.push(`Always include: ${(agentPrefs.alwaysInclude as string[]).join(', ')}`)
    }
    if ((agentPrefs.neverInclude as string[])?.length > 0) {
      parts.push(`Never include: ${(agentPrefs.neverInclude as string[]).join(', ')}`)
    }
  }

  const learned = (
    (styleMemory?.[moduleType] as Record<string, unknown>)?.[agentName.toLowerCase()] as Record<string, unknown>
  ) || {}
  const signalCount = (learned.signalCount as number) || 0
  if (signalCount > 0) {
    parts.push(`\nAUTO-LEARNED PREFERENCES (${signalCount} signals \u2014 high confidence above 10):`)
    if ((learned.approvedAngles as string[])?.length > 0) {
      parts.push(`Approved angles: ${(learned.approvedAngles as string[]).join(', ')}`)
    }
    if ((learned.rejectedAngles as string[])?.length > 0) {
      parts.push(`Rejected angles: ${(learned.rejectedAngles as string[]).join(', ')}`)
    }
    if ((learned.tonePreferences as string[])?.length > 0) {
      parts.push(`Tone that works: ${(learned.tonePreferences as string[]).join(', ')}`)
    }
    if ((learned.avoidTones as string[])?.length > 0) {
      parts.push(`Tone to avoid: ${(learned.avoidTones as string[]).join(', ')}`)
    }
    if ((learned.preferredWords as string[])?.length > 0) {
      parts.push(`Words that resonate: ${(learned.preferredWords as string[]).join(', ')}`)
    }
    if ((learned.avoidWords as string[])?.length > 0) {
      parts.push(`Words to avoid: ${(learned.avoidWords as string[]).join(', ')}`)
    }
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
    moduleType: string
    outputId: string
    chatSessionId: string
    currentOutput: Record<string, unknown>
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
    userMessage: string
    currentInstructions?: string
  }
  try { body = await request.json() } catch { return apiError('Invalid body', 400, 'INVALID_BODY') }

  const {
    businessId, moduleType, outputId, chatSessionId,
    currentOutput, messages, userMessage, currentInstructions
  } = body

  if (!businessId || !moduleType || !userMessage || !chatSessionId) {
    return apiError('Missing required fields', 400, 'VALIDATION_ERROR')
  }

  const adminClient = createAdminClient()

  const { data: biz } = await adminClient
    .from('businesses')
    .select('customer_id, style_memory, agent_preferences')
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

  const learningProfile = buildLearningProfile(
    biz.style_memory as Record<string, unknown> | null,
    biz.agent_preferences as Record<string, unknown> | null,
    moduleType,
    agent.name
  )

  const classifyRes = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: 'You are a classifier. Return ONLY valid JSON:\n{"intent": "refine" | "question" | "general", "targetField": "string or null", "targetIdentifier": "string or null"}\nReturn ONLY valid JSON.',
    messages: [{
      role: 'user',
      content: `Output summary: ${JSON.stringify(currentOutput).slice(0, 800)}\nUser: ${userMessage}`
    }]
  })

  let intent = 'general'
  let targetField: string | null = null
  let targetIdentifier: string | null = null
  try {
    const ct = classifyRes.content.filter(b => b.type === 'text').map(b => b.type === 'text' ? b.text : '').join('')
    const cl = JSON.parse(ct.match(/\{[\s\S]*\}/)?.[0] || '{}')
    intent = cl.intent || 'general'
    targetField = cl.targetField || null
    targetIdentifier = cl.targetIdentifier || null
  } catch { /* use defaults */ }

  const systemPrompt = `${agent.personality}

Your specialty: ${agent.specialty}
Constraints: ${agent.constraints}
Out of scope \u2014 redirect warmly if asked about: ${agent.outOfScope}

${learningProfile}
${currentInstructions ? `\nSESSION INSTRUCTIONS FROM USER:\n${currentInstructions}\n` : ''}
${businessContext}

CURRENT OUTPUT:
${JSON.stringify(currentOutput, null, 2).slice(0, 3000)}

INSTRUCTIONS:
- Respond as ${agent.name} \u2014 expert but warm, never robotic, never sycophantic
- Keep responses to 1-3 sentences of explanation max
- When making a change return a patch with exact field and new value
- When answering a question respond conversationally with no patch
- Always tie reasoning to ICP data or business context
- Never make changes the user did not ask for
- If asked about something out of scope redirect warmly
- Apply brand instructions and learned preferences automatically without mentioning them

Return ONLY valid JSON:
{
  "message": "your conversational response",
  "patch": { "target": "fieldName_identifier", "value": "new content" } | null
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

  const refineText = refineRes.content
    .filter(b => b.type === 'text')
    .map(b => b.type === 'text' ? b.text : '')
    .join('')

  let agentMessage = ''
  let patch: { target: string; value: string } | null = null
  try {
    const parsed = JSON.parse(refineText.match(/\{[\s\S]*\}/)?.[0] || '{}')
    agentMessage = parsed.message || 'Could you rephrase that?'
    patch = parsed.patch || null
  } catch {
    agentMessage = refineText.slice(0, 500) || 'Something went wrong \u2014 try again.'
  }

  // Write to agent_chat_logs
  try {
    const { data: existingLog } = await adminClient
      .from('agent_chat_logs')
      .select('id, messages, patches_applied')
      .eq('id', chatSessionId)
      .maybeSingle()

    const updatedMessages = [
      ...((existingLog?.messages as unknown[]) || []),
      { role: 'user', content: userMessage, timestamp: new Date().toISOString() },
      { role: 'assistant', content: agentMessage, timestamp: new Date().toISOString() },
    ]

    const updatedPatches = patch
      ? [
          ...((existingLog?.patches_applied as unknown[]) || []),
          { target: patch.target, value: patch.value, userMessage, appliedAt: new Date().toISOString() },
        ]
      : ((existingLog?.patches_applied as unknown[]) || [])

    if (existingLog) {
      await adminClient
        .from('agent_chat_logs')
        .update({ messages: updatedMessages, patches_applied: updatedPatches, last_message_at: new Date().toISOString() })
        .eq('id', chatSessionId)
    } else {
      await adminClient
        .from('agent_chat_logs')
        .insert({
          id: chatSessionId, business_id: businessId, output_id: outputId || null,
          module_type: moduleType, agent_name: agent.name,
          messages: updatedMessages, patches_applied: updatedPatches,
        })
    }
  } catch { /* non-fatal */ }

  // Trigger preference extraction if patch was applied (fire and forget)
  if (patch) {
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/learn/extract-preferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.user.id}` },
      body: JSON.stringify({
        businessId,
        agentKey: `${moduleType}.${agent.name.toLowerCase()}`,
        signalType: 'patch_accepted',
        signalData: { target: patch.target, newValue: patch.value, userRequest: userMessage, context: JSON.stringify(currentOutput).slice(0, 500) },
        signalWeight: 1,
      }),
    }).catch(() => null)
  }

  return apiSuccess({ agentName: agent.name, message: agentMessage, patch, intent, targetField, targetIdentifier })
}
