import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSystemPrompt } from '@/lib/prompts'
import { buildICPMarkdown } from '@/lib/icp-formatter'
import { saveSignalScore, calculateAndSaveScore } from '@/lib/signal-score'
import { Phase, Message, Customer } from '@/types'
import { sanitizeMessage } from '@/lib/sanitize'
import { checkRateLimit, getIpIdentifier } from '@/lib/ratelimit'
import { logger } from '@/lib/logger'
import { apiError } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-guard'
import { validateBody } from '@/lib/validate'

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
  const auth = await requireAuth()
  if (auth.error) return auth.error

  const start = logger.apiStart('/api/chat', auth.customer.id)

  // Rate limiting
  const allowed = await checkRateLimit(getIpIdentifier(request), 'chat', 150, 60)
  if (!allowed) {
    logger.warn('Rate limit exceeded', { route: '/api/chat', action: 'rate_limited' })
    logger.apiEnd('/api/chat', start, 429, auth.customer.id)
    return apiError('Too many messages. Please wait a moment before continuing.', 429, 'RATE_LIMITED')
  }

  let body: ChatRequest
  try {
    body = await request.json()
  } catch {
    logger.apiEnd('/api/chat', start, 400, auth.customer.id)
    return apiError('Invalid request body', 400, 'INVALID_BODY')
  }

  const { valid, errors } = validateBody(body as unknown as Record<string, unknown>, {
    messages: { type: 'array', required: true },
    phase: { type: 'number', required: true },
    sessionId: { type: 'string', required: true },
  })
  if (!valid) {
    logger.apiEnd('/api/chat', start, 400, auth.customer.id)
    return apiError(errors.join(', '), 400, 'VALIDATION_ERROR')
  }

  const { messages, phase, customerContext, sessionId } = body

  // Session ownership verification
  if (sessionId) {
    const adminClientCheck = createAdminClient()
    const { data: sessionOwner } = await adminClientCheck
      .from('sessions')
      .select('customer_id')
      .eq('id', sessionId)
      .single()

    if (sessionOwner && sessionOwner.customer_id !== auth.customer.id) {
      logger.warn('Session does not belong to authenticated customer', {
        route: '/api/chat',
        sessionId,
        customerId: auth.customer.id,
        sessionOwnerId: sessionOwner.customer_id,
      })
      logger.apiEnd('/api/chat', start, 403, auth.customer.id)
      return apiError('Session does not belong to this customer', 403, 'FORBIDDEN')
    }
  }

  // Security — duplicate message guard (phases 1-3 only; phase 4 sends empty array)
  if (phase !== 4 && messages.length > 0) {
    const userMessages = messages.filter((m) => m.role === 'user')
    const lastTwo = userMessages.slice(-2)
    if (lastTwo.length === 2 && lastTwo[0].content === lastTwo[1].content) {
      logger.apiEnd('/api/chat', start, 429, auth.customer.id)
      return apiError('Duplicate message', 429, 'DUPLICATE_MESSAGE')
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
      logger.apiEnd('/api/chat', start, 400, auth.customer.id)
      return apiError('sessionId required for Phase 4', 400, 'MISSING_SESSION_ID')
    }

    const adminClient = createAdminClient()

    const { data: sessionData } = await adminClient
      .from('sessions')
      .select('phase_transcripts, customer_id')
      .eq('id', sessionId)
      .single()

    if (!sessionData) {
      logger.apiEnd('/api/chat', start, 404, auth.customer.id)
      return apiError('Session not found', 404, 'NOT_FOUND')
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
      logger.apiEnd('/api/chat', start, 500, auth.customer.id)
      return apiError('Unexpected response type', 500, 'UNEXPECTED_RESPONSE')
    }

    const rawText = replyContent.text
    const isIcpComplete = rawText.includes('[ICP_COMPLETE]')
    const cleanText = rawText.replace('[ICP_COMPLETE]', '').trim()

    // Parse the JSON response
    let parsedData: Record<string, unknown> = {}
    try {
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0])
      }
    } catch (err) {
      logger.error('Failed to parse ICP JSON', err, { route: '/api/chat', sessionId: sessionId })
      // Fall back to saving raw text if JSON parsing fails
      parsedData = { raw: cleanText }
    }

    // Save structured data to Supabase if sessionId provided and JSON parsed successfully
    if (sessionId && parsedData.icp_core) {
      await adminClient.from('sessions').update({
        icp_core: parsedData.icp_core || null,
        segment_data: parsedData.segment_data || null,
        messaging_data: parsedData.messaging_data || null,
        competitive_data: parsedData.competitive_data || null,
        content_data: parsedData.content_data || null,
        targeting_data: parsedData.targeting_data || null,
        proof_assets: parsedData.proof_assets || null,
        anti_icp_signals: parsedData.anti_icp_signals || null,
        voice_of_customer_signals: parsedData.voice_of_customer_signals || null,
        signal_score_inputs: parsedData.signal_score_inputs || null,
        shareability: parsedData.shareability || null,
        gtm_data: parsedData.gtm_data || null,
        icp_data: parsedData,
        icp_html: cleanText,
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', sessionId)

      // Calculate and save Signal Score (non-fatal)
      const { data: sessionRecord } = await adminClient
        .from('sessions')
        .select('business_id')
        .eq('id', sessionId)
        .single()

      if (sessionRecord?.business_id) {
        calculateAndSaveScore(sessionRecord.business_id).catch(err =>
          console.error('Score calc error:', err)
        )
      }
    }

    const icpMarkdown = buildICPMarkdown(parsedData)

    if (isIcpComplete) {
      logger.info('ICP complete', { route: '/api/chat', sessionId, customerId: auth.customer.id })
    }

    logger.apiEnd('/api/chat', start, 200, auth.customer.id)
    return NextResponse.json({
      reply: icpMarkdown,
      shouldAdvancePhase: isIcpComplete,
      isIcpComplete,
      icpDocument: isIcpComplete ? icpMarkdown : undefined,
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
    logger.apiEnd('/api/chat', start, 500, auth.customer.id)
    return apiError('Unexpected response type from Claude', 500, 'UNEXPECTED_RESPONSE')
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
    logger.info('Phase complete', { route: '/api/chat', phase, sessionId, customerId: auth.customer.id })
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
      logger.error('Phase summarization error', err, { route: '/api/chat', action: 'phase_summary' })
    }
  }

  if (isIcpComplete) {
    logger.info('ICP complete', { route: '/api/chat', sessionId, customerId: auth.customer.id })
  }

  logger.apiEnd('/api/chat', start, 200, auth.customer.id)
  return NextResponse.json({
    reply: cleanReply,
    shouldAdvancePhase: shouldAdvancePhase || isIcpComplete,
    isIcpComplete,
    icpDocument: isIcpComplete ? cleanReply : undefined,
    phaseSummary,
  })
}
