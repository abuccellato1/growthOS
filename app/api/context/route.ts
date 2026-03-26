import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { buildAgentContext } from '@/lib/agent-context'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  const url = new URL(request.url)
  const businessId = url.searchParams.get('businessId')

  if (!businessId) {
    return apiError('businessId is required', 400, 'MISSING_PARAM')
  }

  // Verify business belongs to this user
  const adminClient = createAdminClient()
  const { data: business } = await adminClient
    .from('businesses')
    .select('id, customer_id')
    .eq('id', businessId)
    .single()

  if (!business) {
    return apiError('Business not found', 404, 'NOT_FOUND')
  }

  const { data: customer } = await adminClient
    .from('customers')
    .select('id')
    .eq('id', business.customer_id)
    .eq('auth_user_id', auth.user.id)
    .single()

  if (!customer) {
    return apiError('Access denied', 403, 'FORBIDDEN')
  }

  const context = await buildAgentContext(businessId)

  if (!context) {
    return apiError('Failed to build context', 500, 'CONTEXT_ERROR')
  }

  return apiSuccess({ context })
}
