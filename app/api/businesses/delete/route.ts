import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  let body: { businessId: string; confirmName: string }
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_BODY')
  }

  const { businessId, confirmName } = body
  if (!businessId || !confirmName) {
    return apiError('businessId and confirmName are required', 400, 'VALIDATION_ERROR')
  }

  const adminClient = createAdminClient()

  // Fetch business and verify ownership
  const { data: business } = await adminClient
    .from('businesses')
    .select('id, business_name, customer_id')
    .eq('id', businessId)
    .single()

  if (!business) {
    return apiError('Business not found', 404, 'NOT_FOUND')
  }

  if (business.customer_id !== auth.customer.id) {
    return apiError('Business does not belong to this user', 403, 'FORBIDDEN')
  }

  // Verify exact name match
  if (confirmName !== business.business_name) {
    return apiError('Business name does not match', 400, 'NAME_MISMATCH')
  }

  // Soft delete: set status to deleted, is_active to false
  const deletedAt = new Date().toISOString()
  await adminClient.from('businesses').update({
    status: 'deleted',
    is_active: false,
    updated_at: deletedAt,
  }).eq('id', businessId)

  return apiSuccess({ deletedAt })
}
