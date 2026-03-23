import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSystemPrompt } from '@/lib/prompts'
import { Phase, Message, Customer } from '@/types'
import { sanitizeMessage } from '@/lib/sanitize'
import { checkRateLimit, getIpIdentifier } from '@/lib/ratelimit'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const MODEL: Record<number, string> = {
  1: 'claude-haiku-4-5-20251001',
  2: 'claude-haiku-4-5-20251001',
  3: 'claude-haiku-4-5-20251001',
  4: 'claude-sonnet-4-6',
}

const MAX_TOKENS: Record<number, number> = {
  1: 400,
  2: 500,
  3: 600,
  4: 8000,
}

interface ChatRequest {
  messages: Message[]
  phase: Phase
  customerContext?: string
  sessionId?: string
}

function buildMessages(
  messages: Message[],
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))
}

export async function POST(request: Request) {
  // Rate limiting
  const allowed = await checkRateLimit(getIpIdentifier(request), 'chat', 150, 60)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many messages. Please wait a moment before continuing.' },
      { status: 429 }
    )
  }

  let body: ChatRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { messages, phase, customerContext, sessionId } = body

  if (!messages || !phase) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Security — duplicate message guard (phases 1-3 only; phase 4 sends empty array)
  if (phase !== 4 && messages.length > 0) {
    const userMessages = messages.filter((m) => m.role === 'user')
    const lastTwo = userMessages.slice(-2)
    if (lastTwo.length === 2 && lastTwo[0].content === lastTwo[1].content) {
      return NextResponse.json({ error: 'Duplicate message' }, { status: 429 })
    }
  }

  // Security — sanitize last user message
  const sanitizedMessages = messages.map((m, i) => {
    if (i === messages.length - 1 && m.role === 'user') {
      return { ...m, content: sanitizeMessage(m.content) }
    }
    return m
  })

  // ─── Phase 4: server-side transcript assembly ──────────────────────────────
  // Client sends empty messages array. Server fetches all phase transcripts
  // from Supabase and assembles the full conversation context itself.
  // This eliminates the 413 error and ensures 100% of conversation data
  // reaches the model — no summaries, no compression, no data loss.
  if (phase === 4) {
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required for Phase 4' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    const { data: sessionData } = await adminClient
      .from('sessions')
      .select('phase_transcripts, customer_id')
      .eq('id', sessionId)
      .single()

    if (!sessionData) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const { data: customerData } = await adminClient
      .from('customers')
      .select('*')
      .eq('id', sessionData.customer_id)
      .single()

    const transcripts = sessionData.phase_transcripts as Record<string, Message[]> | null
    const phase4Messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

    // Inject customer profile and pre-session research as opening context
    if (customerData) {
      const cust = customerData as Customer
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
    }

    // Inject each phase transcript in full — no summaries, no compression
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

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: getSystemPrompt(4),
      messages: phase4Messages,
    })

    const replyContent = response.content[0]
    if (replyContent.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response type' }, { status: 500 })
    }

    const rawReply = replyContent.text
    const isIcpComplete = rawReply.includes('[ICP_COMPLETE]')
    const cleanReply = rawReply.replace('[ICP_COMPLETE]', '').trim()

    return NextResponse.json({
      reply: cleanReply,
      shouldAdvancePhase: isIcpComplete,
      isIcpComplete,
      icpDocument: isIcpComplete ? cleanReply : undefined,
      phaseSummary: null,
    })
  }

  // ─── Phases 1-3: current phase messages only ──────────────────────────────
  let systemPrompt = getSystemPrompt(phase)
  if (phase === 1 && customerContext) {
    systemPrompt = `${customerContext}${systemPrompt}`
  }

  const anthropicMessages = buildMessages(sanitizedMessages)

  const response = await anthropic.messages.create({
    model: MODEL[phase] ?? 'claude-haiku-4-5-20251001',
    max_tokens: MAX_TOKENS[phase] ?? 400,
    system: systemPrompt,
    messages: anthropicMessages,
  })

  const replyContent = response.content[0]
  if (replyContent.type !== 'text') {
    return NextResponse.json(
      { error: 'Unexpected response type from Claude' },
      { status: 500 }
    )
  }

  const rawReply = replyContent.text
  const shouldAdvancePhase = rawReply.includes('[PHASE_COMPLETE]')
  const isIcpComplete = rawReply.includes('[ICP_COMPLETE]')
  const cleanReply = rawReply
    .replace('[PHASE_COMPLETE]', '')
    .replace('[ICP_COMPLETE]', '')
    .trim()

  let phaseSummary: string | null = null
  if (shouldAdvancePhase) {
    try {
      const summaryResponse = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system:
          'Summarize the key facts from this conversation in under 200 words. Be specific — names, numbers, details only. No analysis.',
        messages: [
          ...anthropicMessages,
          { role: 'assistant' as const, content: rawReply },
        ],
      })
      const summaryContent = summaryResponse?.content?.[0]
      if (summaryContent && summaryContent.type === 'text') {
        phaseSummary = summaryContent.text.trim()
      }
    } catch (err) {
      console.error('Phase summarization error:', err)
    }
  }

  return NextResponse.json({
    reply: cleanReply,
    shouldAdvancePhase: shouldAdvancePhase || isIcpComplete,
    isIcpComplete,
    icpDocument: isIcpComplete ? cleanReply : undefined,
    phaseSummary,
  })
}
