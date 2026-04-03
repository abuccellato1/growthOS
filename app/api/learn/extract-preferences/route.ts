import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PREFERENCE_SCHEMA = `{
  "tonePreferences": ["string — tones that work"],
  "avoidTones": ["string — tones to avoid"],
  "approvedAngles": ["string — angles/themes that work"],
  "rejectedAngles": ["string — angles/themes to avoid"],
  "approvedPatterns": ["string — specific copy patterns that work"],
  "rejectedPatterns": ["string — specific copy patterns to avoid"],
  "avoidWords": ["string — specific words or phrases to never use"],
  "preferredWords": ["string — specific words or phrases that resonate"],
  "copyPatterns": {
    "prefersShorterCopy": "boolean or null",
    "usesSpecificNumbers": "boolean or null",
    "avoidsQuestions": "boolean or null",
    "prefersStoryLed": "boolean or null",
    "prefersDirectResponse": "boolean or null"
  },
  "signalCount": "number — increment existing count by signals in this batch"
}`

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  let body: {
    businessId: string
    agentKey: string
    signalType: 'field_flag' | 'patch_accepted' | 'vault_save' | 'overall_positive' | 'regeneration_requested'
    signalData: Record<string, unknown>
    signalWeight?: number
  }
  try { body = await request.json() } catch { return apiError('Invalid body', 400, 'INVALID_BODY') }

  const { businessId, agentKey, signalType, signalData, signalWeight = 1 } = body
  if (!businessId || !agentKey || !signalType) {
    return apiError('Missing required fields', 400, 'VALIDATION_ERROR')
  }

  const adminClient = createAdminClient()

  const { data: biz } = await adminClient
    .from('businesses')
    .select('customer_id, style_memory')
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

  const existingMemory = (biz.style_memory as Record<string, unknown>) || {}
  const [moduleType, agentName] = agentKey.split('.')
  const existingAgentPrefs = (
    (existingMemory[moduleType] as Record<string, unknown>)?.[agentName] as Record<string, unknown>
  ) || {}

  const signalDescriptions: Record<string, string> = {
    field_flag: 'User explicitly flagged this content as not working with specific reasons',
    patch_accepted: 'User asked the agent to change something and accepted the result',
    vault_save: 'User saved this output to their vault — strong positive signal of overall style approval',
    overall_positive: 'User gave overall thumbs up to the full output',
    regeneration_requested: 'User requested full regeneration — something systemic missed the mark',
  }

  const extractRes = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    system: `You extract marketing preference signals from user feedback.
Analyze the signal and update the existing preferences accordingly.
Signal weight ${signalWeight}x means this signal is ${signalWeight}x more important than normal.
Only extract preferences clearly indicated by the signal — never invent preferences.
Merge with existing preferences — preserve what's already there unless the new signal contradicts it.
Return ONLY valid JSON matching this schema exactly:
${PREFERENCE_SCHEMA}`,
    messages: [{
      role: 'user',
      content: `EXISTING PREFERENCES:\n${JSON.stringify(existingAgentPrefs, null, 2)}\n\nNEW SIGNAL:\nType: ${signalType} — ${signalDescriptions[signalType]}\nWeight: ${signalWeight}x\nData: ${JSON.stringify(signalData, null, 2)}\n\nExtract updated preferences. Increment signalCount by ${signalWeight}.\nReturn ONLY valid JSON.`
    }]
  })

  const extractText = extractRes.content
    .filter(b => b.type === 'text')
    .map(b => b.type === 'text' ? b.text : '')
    .join('')

  let updatedAgentPrefs: Record<string, unknown> = existingAgentPrefs
  try {
    const jsonMatch = extractText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      updatedAgentPrefs = {
        ...JSON.parse(jsonMatch[0]),
        lastUpdated: new Date().toISOString(),
      }
    }
  } catch { /* keep existing if parse fails */ }

  // Merge back into style_memory
  const updatedMemory = {
    ...existingMemory,
    [moduleType]: {
      ...((existingMemory[moduleType] as Record<string, unknown>) || {}),
      [agentName]: updatedAgentPrefs,
    },
  }

  await adminClient
    .from('businesses')
    .update({ style_memory: updatedMemory })
    .eq('id', businessId)

  return apiSuccess({ extracted: true, agentKey, signalCount: updatedAgentPrefs.signalCount })
}
