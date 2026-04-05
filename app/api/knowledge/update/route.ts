import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateKB, type KBDomain } from '@/lib/knowledge-base'

const VALID_DOMAINS: KBDomain[] = [
  'identity', 'audience', 'competitive', 'performance', 'assets', 'zeno'
]

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  let body: {
    businessId: string
    domain: KBDomain
    merge: Record<string, unknown>
    regenerateSummary?: boolean
  }
  try { body = await request.json() } catch { return apiError('Invalid body', 400, 'INVALID_BODY') }

  const { businessId, domain, merge, regenerateSummary = true } = body
  if (!businessId || !domain || !merge) {
    return apiError('Missing required fields', 400, 'VALIDATION_ERROR')
  }
  if (!VALID_DOMAINS.includes(domain)) {
    return apiError('Invalid domain', 400, 'INVALID_DOMAIN')
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

  await updateKB(businessId, domain, merge, regenerateSummary)

  return apiSuccess({ updated: true, domain })
}
