import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth-guard'
import { logger } from '@/lib/logger'
import { apiError, apiSuccess } from '@/lib/api-response'

export async function GET(request: Request) {
  const start = logger.apiStart('/api/businesses/list')

  const auth = await requireAuth()
  if (auth.error) {
    logger.apiEnd('/api/businesses/list', start, 401)
    return auth.error
  }

  const url = new URL(request.url)
  const includeInactive = url.searchParams.get('includeInactive') === 'true'

  const adminClient = createAdminClient()

  const query = adminClient
    .from('businesses')
    .select('*')
    .eq('customer_id', auth.customer.id)
    .order('created_at', { ascending: true })

  if (!includeInactive) {
    query.eq('is_active', true)
  }

  const { data: businesses, error } = await query

  if (error) {
    logger.error('Business list error', error, { route: '/api/businesses/list', customerId: auth.customer.id })
    logger.apiEnd('/api/businesses/list', start, 500, auth.customer.id)
    return apiError('Failed to list businesses', 500, 'LIST_FAILED')
  }

  logger.apiEnd('/api/businesses/list', start, 200, auth.customer.id)
  return apiSuccess({ businesses: businesses || [] })
}
