import Anthropic from '@anthropic-ai/sdk'
import { logger } from '@/lib/logger'
import { apiError, apiSuccess } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSystemPrompt } from '@/lib/prompts'
import { Customer, Message } from '@/types'

const ROUTE = '/api/recover-session'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  const start = logger.apiStart(ROUTE, auth.customer.id)

  let body: { sessionId: string }
  try {
    body = await request.json()
  } catch {
    logger.apiEnd(ROUTE, start, 400, auth.customer.id)
    return apiError('Invalid request body', 400)
  }

  const { sessionId } = body
  if (!sessionId || typeof sessionId !== 'string') {
    logger.apiEnd(ROUTE, start, 400, auth.customer.id)
    return apiError('sessionId required', 400)
  }

  const adminClient = createAdminClient()

  // Fetch session
  const { data: sessionData } = await adminClient
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (!sessionData) {
    logger.apiEnd(ROUTE, start, 404, auth.customer.id)
    return apiError('Session not found', 404)
  }

  // Verify session belongs to this user
  if (sessionData.customer_id !== auth.customer.id) {
    logger.apiEnd(ROUTE, start, 403, auth.customer.id)
    return apiError('Forbidden', 403)
  }

  // Already has ICP — return immediately
  if (sessionData.icp_html && sessionData.icp_html.trim().length > 0) {
    logger.apiEnd(ROUTE, start, 200, auth.customer.id)
    return apiSuccess({ success: true, already_exists: true })
  }

  // Check for conversation data
  const messageHistory = (sessionData.message_history ?? []) as Message[]
  if (messageHistory.length === 0) {
    logger.apiEnd(ROUTE, start, 400, auth.customer.id)
    return apiError('No conversation data found', 400)
  }

  // Fetch full customer record for context
  const { data: customerFull } = await adminClient
    .from('customers')
    .select('*')
    .eq('id', auth.customer.id)
    .single()

  const customer = (customerFull || auth.customer) as Customer

  // Build context block
  let contextBlock = [
    'COMPLETE DISCOVERY SESSION TRANSCRIPT',
    `Business: ${customer.business_name || 'Not provided'}`,
    `Website: ${customer.website_url || 'Not provided'}`,
    `Service: ${customer.primary_service || 'Not provided'}`,
    `Market: ${customer.geographic_market || 'Not provided'}`,
  ].join('\n')

  if (customer.business_research?.websiteFound) {
    const r = customer.business_research
    contextBlock += `\n\nPRE-SESSION RESEARCH:\n`
    contextBlock += `What they do: ${r.whatTheyDo}\n`
    contextBlock += `Apparent target customer: ${r.apparentTargetCustomer}\n`
    contextBlock += `Differentiators: ${r.differentiators}\n`
  }

  // Assemble Phase 4 messages from the full message history
  const phase4Messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    {
      role: 'user' as const,
      content: contextBlock,
    },
    {
      role: 'assistant' as const,
      content: 'I have the business context. Ready to review the full discovery conversation.',
    },
    {
      role: 'user' as const,
      content: 'Here is the complete 3-phase discovery conversation:',
    },
    {
      role: 'assistant' as const,
      content: 'Ready. I will use every specific detail, exact language, and real example from this conversation.',
    },
    ...messageHistory.map((m: Message) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    {
      role: 'user' as const,
      content:
        'Now synthesize everything from this conversation into the complete ICP document following the exact output format in your instructions. Use specific details, exact language, and real examples from what was actually discussed. Do not generalize. Do not invent. Every section must reflect what was said in this conversation.',
    },
  ]

  // Call Anthropic
  let icpText: string
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: getSystemPrompt(4),
      messages: phase4Messages,
    })

    const replyContent = response.content[0]
    if (replyContent.type !== 'text') {
      logger.apiEnd(ROUTE, start, 500, auth.customer.id)
      return apiError('Unexpected response type from Claude', 500)
    }

    icpText = replyContent.text.replace('[ICP_COMPLETE]', '').trim()
  } catch (err) {
    logger.error('Anthropic error in recover-session', err, { route: ROUTE })
    logger.apiEnd(ROUTE, start, 500, auth.customer.id)
    return apiError('Failed to generate ICP', 500)
  }

  // Save to Supabase
  const { error: saveError } = await adminClient
    .from('sessions')
    .update({
      icp_data: { raw: icpText },
      icp_html: icpText,
      status: 'completed',
      phase: 4,
      phase_transcripts: {
        '1': [],
        '2': [],
        '3': messageHistory,
      },
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId)

  if (saveError) {
    logger.error('Save error in recover-session', saveError, { route: ROUTE })
    logger.apiEnd(ROUTE, start, 500, auth.customer.id)
    return apiError('Failed to save ICP', 500)
  }

  logger.apiEnd(ROUTE, start, 200, auth.customer.id)
  return apiSuccess({ success: true })
}
