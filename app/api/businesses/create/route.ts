// SQL to run in Supabase before deploying:
// ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS gmb_url text;

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth-guard'
import { validateBody } from '@/lib/validate'
import { logger } from '@/lib/logger'
import { apiError, apiSuccess } from '@/lib/api-response'

interface CreateBusinessRequest {
  businessName: string
  websiteUrl?: string
  primaryService?: string
  geographicMarket?: string
  gmbUrl?: string
  placeId?: string
  migratingFromCustomer?: boolean
}

export async function POST(request: Request) {
  const start = logger.apiStart('/api/businesses/create')

  const auth = await requireAuth()
  if (auth.error) {
    logger.apiEnd('/api/businesses/create', start, 401)
    return auth.error
  }

  let body: CreateBusinessRequest
  try {
    body = await request.json()
  } catch {
    logger.apiEnd('/api/businesses/create', start, 400)
    return apiError('Invalid request body', 400, 'INVALID_BODY')
  }

  const validation = validateBody(body as unknown as Record<string, unknown>, {
    businessName: { type: 'string', required: true, minLength: 1, maxLength: 100 },
    websiteUrl: { type: 'string', required: false, maxLength: 500 },
    primaryService: { type: 'string', required: false, maxLength: 200 },
    geographicMarket: { type: 'string', required: false, maxLength: 200 },
  })

  if (!validation.valid) {
    logger.apiEnd('/api/businesses/create', start, 400)
    return apiError(validation.errors.join(', '), 400, 'VALIDATION_ERROR')
  }

  const { businessName, websiteUrl, primaryService, geographicMarket, gmbUrl, placeId, migratingFromCustomer } = body

  const adminClient = createAdminClient()

  // Check business limit (skip during migration)
  if (!migratingFromCustomer) {
    if (!auth.customer.beta_user) {
      const { count } = await adminClient
        .from('businesses')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', auth.customer.id)

      if ((count ?? 0) >= 1) {
        logger.apiEnd('/api/businesses/create', start, 403, auth.customer.id)
        return apiError('Business limit reached. Upgrade to add more businesses.', 403, 'LIMIT_REACHED')
      }
    }
  }

  // Create business record
  const { data: business, error } = await adminClient
    .from('businesses')
    .insert({
      customer_id: auth.customer.id,
      business_name: businessName.trim(),
      website_url: websiteUrl?.trim() || null,
      primary_service: primaryService?.trim() || null,
      geographic_market: geographicMarket?.trim() || null,
      gmb_url: gmbUrl?.trim() || null,
      place_id: placeId || null,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    logger.error('Business create error', error, { route: '/api/businesses/create', customerId: auth.customer.id })
    logger.apiEnd('/api/businesses/create', start, 500, auth.customer.id)
    return apiError('Failed to create business', 500, 'CREATE_FAILED')
  }

  logger.apiEnd('/api/businesses/create', start, 200, auth.customer.id)

  // Fire Nora auto-research non-blocking after business creation
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/nora/auto-research`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': process.env.INTERNAL_SECRET || '',
    },
    body: JSON.stringify({ businessId: business.id }),
  }).catch(() => null)

  // Fire KB init non-blocking — creates row so enrichment triggers can write to it
  if (business?.id) {
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/knowledge/init-internal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_SECRET || '',
      },
      body: JSON.stringify({ businessId: business.id }),
    }).catch(() => null)
  }

  return apiSuccess({ business })
}
