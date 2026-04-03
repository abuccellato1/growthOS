import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  let body: { businessId: string; sessionId: string; label?: string }
  try { body = await request.json() } catch { return apiError('Invalid body', 400, 'INVALID_BODY') }

  const { businessId, sessionId, label } = body
  if (!businessId || !sessionId) return apiError('Missing required fields', 400, 'VALIDATION_ERROR')

  const adminClient = createAdminClient()

  const { data: biz } = await adminClient
    .from('businesses')
    .select('customer_id')
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

  const { data: session } = await adminClient
    .from('research_sessions')
    .select('messages, title')
    .eq('id', sessionId)
    .eq('business_id', businessId)
    .single()

  if (!session) return apiError('Session not found', 404, 'NOT_FOUND')

  const conversationText = (session.messages as Array<{ role: string; content: string }>)
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n')
    .slice(0, 8000)

  let findings: Record<string, unknown> = {}
  try {
    const extractRes = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: `Extract structured research findings from this conversation.
Return ONLY valid JSON:
{
  "summary": "3-sentence overview of what was researched and key conclusions",
  "keyFindings": ["specific finding 1", "specific finding 2"],
  "competitorInsights": ["insight about competitors if any"],
  "marketData": ["specific data points or statistics found"],
  "recommendedActions": ["action 1 for marketing team"],
  "relevantForModules": ["signal_ads", "signal_content", "signal_sequences"],
  "searchedTopics": ["topic 1", "topic 2"]
}
Only include fields that have actual data. Return ONLY valid JSON.`,
      messages: [{
        role: 'user',
        content: `Extract findings from this research:\n\n${conversationText}`,
      }],
    })

    const extractText = extractRes.content
      .filter(b => b.type === 'text')
      .map(b => b.type === 'text' ? b.text : '')
      .join('')

    const jsonMatch = extractText.match(/\{[\s\S]*\}/)
    if (jsonMatch) findings = JSON.parse(jsonMatch[0])
  } catch { /* keep empty findings */ }

  await adminClient
    .from('research_sessions')
    .update({
      vault_saved: true,
      vault_label: label || session.title || 'Research',
      findings,
      status: 'saved',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)

  return apiSuccess({ saved: true, findings })
}
