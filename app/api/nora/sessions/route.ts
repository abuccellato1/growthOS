import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')
  if (!businessId) return apiError('Missing businessId', 400, 'VALIDATION_ERROR')

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

  const { data: sessions } = await adminClient
    .from('research_sessions')
    .select('id, title, vault_saved, vault_label, status, auto_generated, created_at, updated_at')
    .eq('business_id', businessId)
    .order('updated_at', { ascending: false })
    .limit(50)

  return apiSuccess({ sessions: sessions || [] })
}
