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
  // Verify authenticated user
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  const adminClient = createAdminClient()

  // Fetch the session
  const { data: sessionData } = await adminClient
    .from('sessions')
    .select('id, customer_id, phase_transcripts, icp_html')
    .eq('id', sessionId)
    .single()

  if (!sessionData) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // Verify session belongs to authenticated user
  const { data: customerData } = await adminClient
    .from('customers')
    .select('*')
    .eq('id', sessionData.customer_id)
    .single()

  if (!customerData || customerData.auth_user_id !== user.id) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // If ICP already exists, return immediately
  if (sessionData.icp_html && sessionData.icp_html.trim().length > 0) {
    return NextResponse.json({ success: true, already_exists: true })
  }

  // Assemble Phase 4 messages — same logic as app/api/chat/route.ts Phase 4 handler
  const cust = customerData as Customer
  const transcripts = sessionData.phase_transcripts as Record<string, Message[]> | null
  const phase4Messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

  // Customer profile and pre-session research
  const contextLines = [
    'CUSTOMER PROFILE (collected before session):',
    `Business: ${cust.business_name || 'Not provided'}`,
    `Website: ${cust.website_url || 'Not provided'}`,
    `Primary Service: ${cust.primary_service || 'Not provided'}`,
    `Geographic Market: ${cust.geographic_market || 'Not provided'}`,
  ]
  if (cust.business_research?.websiteFound) {
    const r = cust.business_research
    contextLines.push(
      '\nPRE-SESSION RESEARCH:',
      `What they do: ${r.whatTheyDo}`,
      `Years in business: ${r.yearsInBusiness}`,
      `Apparent target customer: ${r.apparentTargetCustomer}`,
      `Differentiators: ${r.differentiators}`
    )
  }
  phase4Messages.push({ role: 'user', content: contextLines.join('\n') })
  phase4Messages.push({
    role: 'assistant',
    content: 'I have reviewed the customer profile and pre-session research.',
  })

  // Inject each phase transcript in full
  const phaseLabels: Record<string, string> = {
    '1': 'PHASE 1 — Business & Customer Reality Check',
    '2': 'PHASE 2 — Best Customer Forensics',
    '3': 'PHASE 3 — Psychology & Motivation Deep Dive',
  }
  for (const phaseNum of ['1', '2', '3']) {
    const transcript = transcripts?.[phaseNum]
    if (transcript && transcript.length > 0) {
      phase4Messages.push({
        role: 'user',
        content: `Here is the complete ${phaseLabels[phaseNum]} conversation transcript:`,
      })
      phase4Messages.push({
        role: 'assistant',
        content: `Ready. I will use every detail from ${phaseLabels[phaseNum]} in the ICP.`,
      })
      phase4Messages.push(
        ...transcript.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
      )
    }
  }

  // Final synthesis instruction
  phase4Messages.push({
    role: 'user',
    content:
      'Now synthesize everything from all three phases into the complete ICP document following the exact output format in your instructions. Use specific details, exact language, and real examples from the conversation. Do not generalize. Do not invent. Every section must reflect what was actually said.',
  })

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
    console.error('Anthropic error in regenerate-icp:', err)
    return NextResponse.json({ error: 'Failed to generate ICP' }, { status: 500 })
  }

  // Save to sessions table
  const { error: saveError } = await adminClient
    .from('sessions')
    .update({
      icp_data: { raw: icpText },
      icp_html: icpText,
    })
    .eq('id', sessionId)

  if (saveError) {
    console.error('save error in regenerate-icp:', saveError)
    return NextResponse.json({ error: 'Failed to save ICP' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
