import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSystemPrompt } from '@/lib/prompts'
import { Customer, Message } from '@/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: Request) {
  let body: { sessionId: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { sessionId } = body
  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
  }

  // Validate authenticated user
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch customer record
  const adminClient = createAdminClient()
  const { data: customerData } = await adminClient
    .from('customers')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!customerData) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  // Fetch session
  const { data: sessionData } = await adminClient
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (!sessionData) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // Verify session belongs to this user
  if (sessionData.customer_id !== customerData.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Already has ICP — return immediately
  if (sessionData.icp_html && sessionData.icp_html.trim().length > 0) {
    return NextResponse.json({ success: true, already_exists: true })
  }

  // Check for conversation data
  const messageHistory = (sessionData.message_history ?? []) as Message[]
  if (messageHistory.length === 0) {
    return NextResponse.json({ error: 'No conversation data found' }, { status: 400 })
  }

  const customer = customerData as Customer

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
      return NextResponse.json({ error: 'Unexpected response type from Claude' }, { status: 500 })
    }

    icpText = replyContent.text.replace('[ICP_COMPLETE]', '').trim()
  } catch (err) {
    console.error('Anthropic error in recover-session:', err)
    return NextResponse.json({ error: 'Failed to generate ICP' }, { status: 500 })
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
    console.error('Save error in recover-session:', saveError)
    return NextResponse.json({ error: 'Failed to save ICP' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
