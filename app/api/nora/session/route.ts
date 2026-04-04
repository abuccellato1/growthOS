import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')
  const sessionId = searchParams.get('sessionId')
  if (!businessId || !sessionId) return apiError('Missing params', 400, 'VALIDATION_ERROR')

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
    .select('id, title, messages, attachments, vault_saved, vault_label, auto_generated, status, created_at, updated_at')
    .eq('id', sessionId)
    .eq('business_id', businessId)
    .single()

  if (!session) return apiError('Session not found', 404, 'NOT_FOUND')

  return apiSuccess({ session })
}
