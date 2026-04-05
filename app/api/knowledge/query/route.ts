import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'
import { queryKB, type KBDomain } from '@/lib/knowledge-base'

const VALID_DOMAINS: KBDomain[] = [
  'identity', 'audience', 'competitive', 'performance', 'assets', 'zeno'
]

export async function GET(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')
  const domainsParam = searchParams.get('domains')

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

  const requestedDomains = domainsParam
    ? (domainsParam.split(',').filter(d => VALID_DOMAINS.includes(d as KBDomain)) as KBDomain[])
    : VALID_DOMAINS

  const kb = await queryKB(businessId, requestedDomains)

  return apiSuccess({ kb, domains: requestedDomains })
}
