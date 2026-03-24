import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth-guard'
import { logger } from '@/lib/logger'
import { apiError, apiSuccess } from '@/lib/api-response'

export async function POST(request: Request) {
  const start = logger.apiStart('/api/businesses/switch')

  const auth = await requireAuth()
  if (auth.error) {
    logger.apiEnd('/api/businesses/switch', start, 401)
    return auth.error
  }

  let body: { businessId: string }
  try {
    body = await request.json()
  } catch {
    logger.apiEnd('/api/businesses/switch', start, 400, auth.customer.id)
    return apiError('Invalid request body', 400, 'INVALID_BODY')
  }

  const { businessId } = body
  if (!businessId) {
    logger.apiEnd('/api/businesses/switch', start, 400, auth.customer.id)
    return apiError('businessId required', 400, 'MISSING_FIELD')
  }

  const adminClient = createAdminClient()

  const { data: business } = await adminClient
    .from('businesses')
    .select('id')
    .eq('id', businessId)
    .eq('customer_id', auth.customer.id)
    .single()

  if (!business) {
    logger.apiEnd('/api/businesses/switch', start, 404, auth.customer.id)
    return apiError('Business not found', 404, 'NOT_FOUND')
  }

  logger.apiEnd('/api/businesses/switch', start, 200, auth.customer.id)
  return apiSuccess({ success: true })
}
