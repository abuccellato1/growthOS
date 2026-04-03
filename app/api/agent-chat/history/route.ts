import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')
  const outputId = searchParams.get('outputId')

  if (!businessId || !outputId) {
    return apiError('Missing businessId or outputId', 400, 'VALIDATION_ERROR')
  }

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

  const { data: log } = await adminClient
    .from('agent_chat_logs')
    .select('id, messages, patches_applied, agent_name, last_message_at')
    .eq('output_id', outputId)
    .eq('business_id', businessId)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return apiSuccess({
    hasHistory: !!log,
    chatSessionId: log?.id || null,
    messages: log?.messages || [],
    patchesApplied: log?.patches_applied || [],
    agentName: log?.agent_name || null,
    lastMessageAt: log?.last_message_at || null,
  })
}
