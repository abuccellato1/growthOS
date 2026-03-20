import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { getSystemPrompt } from '@/lib/prompts'
import { Phase, Message } from '@/types'
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
  1: 300,
  2: 400,
  3: 400,
  4: 4000,
}

interface BusinessResearch {
  whatTheyDo: string
  yearsInBusiness: string
  primaryProduct: string
  apparentTargetCustomer: string
  differentiators: string
  websiteFound: boolean
}

interface ChatRequest {
  messages: Message[]
  phase: Phase
  customerContext?: string
  phaseSummaries?: Partial<Record<Phase, string>>
  intakeData?: {
    businessName: string
    websiteUrl: string
    primaryService: string
    geographicMarket: string
  }
}

async function researchBusiness(
  businessName: string,
  websiteUrl: string,
  primaryService: string
): Promise<BusinessResearch | null> {
  try {
    const researchResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }] as Parameters<typeof anthropic.messages.create>[0]['tools'],
      system:
        'You are doing pre-session research on a business. Search for the business and visit their website if available. Extract only verifiable facts. Return ONLY valid JSON with no markdown, no preamble: {"whatTheyDo":"one sentence description","yearsInBusiness":"number or empty string","primaryProduct":"main product or service","apparentTargetCustomer":"who the website targets","differentiators":"notable claims or unique aspects","websiteFound":true or false}. Never invent information. Use empty string for unknown fields.',
      messages: [
        {
          role: 'user',
          content: `Research before a discovery session:\nBusiness: ${businessName}\nWebsite: ${websiteUrl}\nService: ${primaryService}`,
        },
      ],
    })
    const textBlock = researchResponse?.content?.find((b: { type: string }) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return null
    const raw = (textBlock as { type: 'text'; text: string }).text.trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    return JSON.parse(jsonMatch[0])
  } catch (err) {
    console.warn('Business research failed — continuing without research:', err)
    return null
  }
}

function buildResearchContext(research: BusinessResearch | null): string {
  if (!research || !research.websiteFound) return ''
  return (
    `PRE-SESSION RESEARCH (gathered before this conversation): Alex has already reviewed this business. ` +
    `Use this to skip surface questions and open with informed context. ` +
    `Do NOT re-ask for information already known here.\n\n` +
    `What they do: ${research.whatTheyDo || 'unclear from website'}\n` +
    `Years in business: ${research.yearsInBusiness || 'unknown'}\n` +
    `Primary product: ${research.primaryProduct || 'unclear'}\n` +
    `Apparent target customer: ${research.apparentTargetCustomer || 'unclear'}\n` +
    `Notable differentiators: ${research.differentiators || 'none noted'}\n\n` +
    `IMPORTANT: This is surface-level only. The website shows who they WANT to appear as. ` +
    `Your job is to find who is ACTUALLY buying. Use this to build rapport and skip basics — not to make assumptions.\n\n`
  )
}

function buildMessagesWithContext(
  messages: Message[],
  phaseSummaries?: Partial<Record<Phase, string>>
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const result: Array<{ role: 'user' | 'assistant'; content: string }> = []
  const PHASE_TITLES: Record<number, string> = {
    1: 'Phase 1 — Business & Customer Reality Check',
    2: 'Phase 2 — Best Customer Forensics',
    3: 'Phase 3 — Psychology & Motivation Deep Dive',
    4: 'Phase 4 — ICP Document',
  }
  if (phaseSummaries && Object.keys(phaseSummaries).length > 0) {
    const summaryLines = ['CONTEXT FROM PREVIOUS PHASES:']
    for (const [p, summary] of Object.entries(phaseSummaries)) {
      if (summary) summaryLines.push(`${PHASE_TITLES[Number(p)]}: ${summary}`)
    }
    if (summaryLines.length > 1) {
      result.push({ role: 'user', content: summaryLines.join('\n\n') })
      result.push({
        role: 'assistant',
        content: 'Understood. I have the context from the previous phases and am ready to continue.',
      })
    }
  }
  result.push(
    ...messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))
  )
  return result
}

export async function POST(request: Request) {
  // Security — request size guard
  const contentLength = request.headers.get('content-length')
  if (contentLength && parseInt(contentLength) > 100_000) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }

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

  const { messages, phase, customerContext, phaseSummaries, intakeData } = body

  if (!messages || !phase) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Security — duplicate message guard
  const userMessages = messages.filter((m) => m.role === 'user')
  const lastTwo = userMessages.slice(-2)
  if (lastTwo.length === 2 && lastTwo[0].content === lastTwo[1].content) {
    return NextResponse.json({ error: 'Duplicate message' }, { status: 429 })
  }

  // Security — sanitize last user message
  const sanitizedMessages = messages.map((m, i) => {
    if (i === messages.length - 1 && m.role === 'user') {
      return { ...m, content: sanitizeMessage(m.content) }
    }
    return m
  })

  // Web research on Phase 1 first message only
  let researchContext = ''
  if (phase === 1 && messages.length === 0 && intakeData) {
    const research = await researchBusiness(
      intakeData.businessName,
      intakeData.websiteUrl,
      intakeData.primaryService
    )
    researchContext = buildResearchContext(research)
  }

  let systemPrompt = getSystemPrompt(phase)

  // Prepend research context and/or customer context to Phase 1 system prompt
  if (phase === 1) {
    const prefix = [researchContext, customerContext].filter(Boolean).join('\n')
    if (prefix) systemPrompt = `${prefix}${systemPrompt}`
  }

  const anthropicMessages = buildMessagesWithContext(sanitizedMessages, phaseSummaries)

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
  if (shouldAdvancePhase && phase < 4) {
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
