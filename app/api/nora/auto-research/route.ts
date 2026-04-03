import Anthropic from '@anthropic-ai/sdk'
import { apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  const authHeader = request.headers.get('x-internal-secret')
  if (authHeader !== process.env.INTERNAL_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: { businessId: string }
  try { body = await request.json() } catch { return new Response('Invalid body', { status: 400 }) }

  const { businessId } = body
  if (!businessId) return new Response('Missing businessId', { status: 400 })

  const adminClient = createAdminClient()

  const { data: biz } = await adminClient
    .from('businesses')
    .select('business_name, primary_service, geographic_market, business_research')
    .eq('id', businessId)
    .single()

  if (!biz) return new Response('Business not found', { status: 404 })

  const research = biz.business_research as Record<string, unknown> | null
  const competitors = (research?.competitorNames as string[]) || []
  const market = biz.geographic_market || 'United States'
  const service = biz.primary_service || ''
  const businessName = biz.business_name || ''

  const queries = [
    `Top competitors and market leaders in ${service} in ${market} — their messaging, positioning, and what they emphasize`,
    competitors.length > 0
      ? `Marketing strategy and messaging analysis for: ${competitors.slice(0, 3).join(', ')}`
      : `Most common marketing angles used by ${service} businesses and which ones are oversaturated`,
    `Current trends and emerging opportunities in ${service} market 2026`,
    `What do customers of ${service} businesses complain about most — common frustrations and unmet needs`,
  ].filter(Boolean)

  const systemPrompt = `You are Nora, a research specialist. You are running an automated baseline research session for a new client: ${businessName}, a ${service} business serving ${market}.

Research each topic thoroughly using web search. Be specific and data-driven.
Frame all findings in terms of marketing opportunities and competitive gaps.
After researching all topics, end with a consolidated "Key Opportunities" section.

At the very end of your complete response, include exactly:
{"_noraAction": "offer_save"}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }] as Parameters<typeof anthropic.messages.create>[0]['tools'],
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Run baseline market research for ${businessName}. Research these topics:\n\n${queries.map((q, i) => `${i + 1}. ${q}`).join('\n\n')}`,
      }],
    })

    const textContent = response.content
      .filter(b => b.type === 'text')
      .map(b => b.type === 'text' ? b.text : '')
      .join('')

    const cleanResponse = textContent.replace(/\{"_noraAction": "offer_save"\}/g, '').trim()

    const sessionMessages = [
      {
        role: 'user',
        content: `Run baseline market research for ${businessName}.`,
        timestamp: new Date().toISOString(),
      },
      {
        role: 'assistant',
        content: cleanResponse,
        timestamp: new Date().toISOString(),
      },
    ]

    const { data: newSession } = await adminClient
      .from('research_sessions')
      .insert({
        business_id: businessId,
        title: `Initial Market Research — ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        messages: sessionMessages,
        status: 'active',
        auto_generated: true,
      })
      .select('id')
      .single()

    if (newSession) {
      const extractRes = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: `Extract structured research findings. Return ONLY valid JSON:
{
  "summary": "3-sentence overview",
  "keyFindings": ["finding 1", "finding 2"],
  "competitorInsights": ["insight 1"],
  "marketData": ["data point 1"],
  "recommendedActions": ["action 1"],
  "relevantForModules": ["signal_ads", "signal_content", "signal_sequences"],
  "searchedTopics": ["topic 1"]
}
Return ONLY valid JSON.`,
        messages: [{
          role: 'user',
          content: `Extract findings:\n\nASSISTANT: ${cleanResponse.slice(0, 8000)}`,
        }],
      })

      const extractText = extractRes.content
        .filter(b => b.type === 'text')
        .map(b => b.type === 'text' ? b.text : '')
        .join('')

      let findings: Record<string, unknown> = {}
      try {
        const jsonMatch = extractText.match(/\{[\s\S]*\}/)
        if (jsonMatch) findings = JSON.parse(jsonMatch[0])
      } catch { /* keep empty */ }

      await adminClient
        .from('research_sessions')
        .update({
          vault_saved: true,
          vault_label: `Initial Market Research — ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
          findings,
          status: 'saved',
          updated_at: new Date().toISOString(),
        })
        .eq('id', newSession.id)
    }
  } catch { /* non-fatal */ }

  return apiSuccess({ started: true })
}
