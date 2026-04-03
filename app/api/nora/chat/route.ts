import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildAgentContext } from '@/lib/agent-context'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  let body: {
    businessId: string
    sessionId?: string
    userMessage: string
    attachmentUrls?: Array<{ url: string; filename: string; mediaType: string }>
    urlContent?: { url: string; title: string; content: string }
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
    isAutoResearch?: boolean
  }
  try { body = await request.json() } catch { return apiError('Invalid body', 400, 'INVALID_BODY') }

  const {
    businessId, sessionId, userMessage,
    attachmentUrls, urlContent, messages, isAutoResearch
  } = body
  if (!businessId || !userMessage) return apiError('Missing required fields', 400, 'VALIDATION_ERROR')

  const adminClient = createAdminClient()

  const { data: biz } = await adminClient
    .from('businesses')
    .select('customer_id, business_name, primary_service, style_memory, agent_preferences, business_research')
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

  const context = await buildAgentContext(businessId)
  const icp = context?.icpCore as Record<string, unknown> | null
  const messaging = context?.messagingData as Record<string, unknown> | null
  const competitive = context?.competitiveData as Record<string, unknown> | null
  const research = biz.business_research as Record<string, unknown> | null

  const businessContext = `
BUSINESS: ${biz.business_name}
PRIMARY SERVICE: ${biz.primary_service}
ICP: ${icp?.one_sentence_icp || 'not yet defined'}
Primary fear: ${icp?.primary_fear || ''}
Dream outcome: ${icp?.dream_outcome_12months || ''}
Core positioning: ${messaging?.core_positioning_statement || ''}
Known competitors: ${JSON.stringify(competitive?.known_competitors || [])}
Competitive advantages: ${JSON.stringify(competitive?.competitive_advantages || [])}

YOUR CLIENT'S OWN BUSINESS PROFILE (BusinessSignals):
What they do: ${research?.whatTheyDo || ''}
Differentiators: ${research?.differentiators || ''}
Years in business: ${research?.yearsInBusiness || ''}
Services: ${JSON.stringify(research?.services || [])}
GMB rating: ${(research?.gmbData as Record<string, unknown>)?.averageRating || ''} (${(research?.gmbData as Record<string, unknown>)?.reviewCount || ''} reviews)
Customer quotes: ${((research?.gmbData as Record<string, unknown>)?.reviews as Array<{text: string}> || []).slice(0, 3).map(r => r.text).join(' | ')}
Certifications/Awards: ${JSON.stringify([...(research?.certifications as string[] || []), ...(research?.awards as string[] || [])])}
`

  type ContentBlock =
    | { type: 'text'; text: string }
    | { type: 'document'; source: { type: 'base64'; media_type: string; data: string }; title?: string }

  const userContent: ContentBlock[] = []

  if (attachmentUrls && attachmentUrls.length > 0) {
    for (const attachment of attachmentUrls) {
      try {
        const { data: fileData } = await adminClient
          .storage
          .from('nora-attachments')
          .download(attachment.url)
        if (fileData) {
          const buffer = await fileData.arrayBuffer()
          const base64 = Buffer.from(buffer).toString('base64')
          userContent.push({
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
            title: attachment.filename,
          })
        }
      } catch { /* non-fatal */ }
    }
  }

  if (urlContent) {
    userContent.push({
      type: 'text',
      text: `[URL CONTENT FROM ${urlContent.url}]\nTitle: ${urlContent.title}\n\n${urlContent.content.slice(0, 8000)}`,
    })
  }

  userContent.push({ type: 'text', text: userMessage })

  const systemPrompt = `You are Nora, a deep research specialist working exclusively for ${biz.business_name}.

Your role: Go deep. Find what matters. Surface insights that help the marketing team \u2014 Jaimie (ads), Emily (email), and Sofia (content) \u2014 do their jobs better. Always frame research findings relative to your client's own business profile so insights are immediately actionable.

${businessContext}

YOUR CAPABILITIES:
- Web search: Use liberally. Always search before answering questions about competitors, markets, or current data.
- Document analysis: When the user shares files, read them thoroughly and extract what matters for marketing.
- URL analysis: When given URL content, analyze it in the context of the business's marketing needs.

YOUR RESEARCH STANDARDS:
- Never fabricate data or statistics. If you cannot find something, say so clearly.
- Always frame findings in terms of what they mean for THIS business specifically.
- Be specific \u2014 vague research is useless research.
- When you find competitor intelligence, always note gaps they are NOT covering that this business could own.
- Connect every finding back to the client's differentiators and positioning.

YOUR OUTPUT STYLE:
- Use clear headers to organize findings.
- Lead with the most actionable insight first.
- End each research thread with a clear "What this means for your marketing" summary.
- When a research topic feels complete, offer to save findings to SignalVault.

SAVE TO VAULT TRIGGER:
When you sense the research on a topic is wrapping up, end your message with exactly this JSON on its own line:
{"_noraAction": "offer_save"}
Only trigger this when the research feels genuinely complete \u2014 not mid-conversation.`

  const allMessages = [
    ...messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    {
      role: 'user' as const,
      content: userContent.length > 1 || userContent[0]?.type !== 'text'
        ? userContent
        : userMessage,
    },
  ]

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }] as Parameters<typeof anthropic.messages.create>[0]['tools'],
    system: systemPrompt,
    messages: allMessages,
  })

  const textContent = response.content
    .filter(b => b.type === 'text')
    .map(b => b.type === 'text' ? b.text : '')
    .join('')

  const offerSave = textContent.includes('{"_noraAction": "offer_save"}')
  const cleanResponse = textContent.replace(/\{"_noraAction": "offer_save"\}/g, '').trim()

  const newMessages = [
    ...messages,
    { role: 'user', content: userMessage, timestamp: new Date().toISOString() },
    { role: 'assistant', content: cleanResponse, timestamp: new Date().toISOString() },
  ]

  let activeSessionId = sessionId
  if (sessionId) {
    await adminClient
      .from('research_sessions')
      .update({ messages: newMessages, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('business_id', businessId)
  } else {
    const title = userMessage.slice(0, 60) + (userMessage.length > 60 ? '\u2026' : '')
    const { data: newSession } = await adminClient
      .from('research_sessions')
      .insert({
        business_id: businessId,
        title,
        messages: newMessages,
        status: 'active',
        auto_generated: isAutoResearch || false,
      })
      .select('id')
      .single()
    activeSessionId = newSession?.id || null
  }

  return apiSuccess({
    response: cleanResponse,
    sessionId: activeSessionId,
    offerSave,
  })
}
