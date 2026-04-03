import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  let body: {
    businessId: string
    brandVoice: string
    alwaysInclude: string[]
    neverInclude: string[]
    writingStyle: string[]
    additionalNotes?: string
  }
  try { body = await request.json() } catch { return apiError('Invalid body', 400, 'INVALID_BODY') }

  const { businessId, brandVoice, alwaysInclude, neverInclude, writingStyle, additionalNotes } = body
  if (!businessId) return apiError('Missing businessId', 400, 'VALIDATION_ERROR')

  const adminClient = createAdminClient()

  const { data: biz } = await adminClient
    .from('businesses')
    .select('customer_id, business_name, primary_service')
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

  const summaryRes = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: `You write concise brand voice summaries for marketing AI agents.
Write in second person ("Your brand...") — 3-5 sentences max.
Be specific and actionable — agents will use this as a brief.
Never be generic. Reference the actual inputs provided.
Return ONLY the summary paragraph — no preamble, no labels.`,
    messages: [{
      role: 'user',
      content: `Business: ${biz.business_name} — ${biz.primary_service}

Brand voice: ${brandVoice || 'not specified'}
Writing style: ${writingStyle.join(', ') || 'not specified'}
Always include: ${alwaysInclude.join(', ') || 'nothing specified'}
Never include: ${neverInclude.join(', ') || 'nothing specified'}
Additional notes: ${additionalNotes || 'none'}

Write a brand voice summary paragraph for this business.`
    }]
  })

  const summary = summaryRes.content
    .filter(b => b.type === 'text')
    .map(b => b.type === 'text' ? b.text : '')
    .join('')
    .trim()

  return apiSuccess({ summary })
}
