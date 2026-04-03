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

  const { data: biz } = await adminClient.from('businesses').select('customer_id').eq('id', businessId).single()
  if (!biz) return apiError('Business not found', 404, 'NOT_FOUND')
  const { data: cust } = await adminClient.from('customers').select('id').eq('id', biz.customer_id).eq('auth_user_id', auth.user.id).single()
  if (!cust) return apiError('Access denied', 403, 'FORBIDDEN')

  const { data: outputs } = await adminClient
    .from('module_outputs')
    .select('id, module_type, output_data, form_inputs, generation_number, vault_label, vault_pinned_at, created_at')
    .eq('business_id', businessId)
    .eq('vault_saved', true)
    .order('vault_pinned_at', { ascending: false })

  // Group by module_type
  const grouped: Record<string, unknown[]> = {}
  for (const row of outputs || []) {
    const key = row.module_type as string
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(row)
  }

  return apiSuccess({ vault: grouped })
}
