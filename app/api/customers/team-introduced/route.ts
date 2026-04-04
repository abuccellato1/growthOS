import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(_request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  const adminClient = createAdminClient()

  const { data: cust } = await adminClient
    .from('customers')
    .select('id')
    .eq('auth_user_id', auth.user.id)
    .single()
  if (!cust) return apiError('Customer not found', 404, 'NOT_FOUND')

  await adminClient
    .from('customers')
    .update({ team_introduced: true })
    .eq('id', cust.id)

  return apiSuccess({ updated: true })
}
