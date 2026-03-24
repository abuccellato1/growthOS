import { createAdminClient } from '@/lib/supabase/admin'
import { timingSafeEqual } from 'crypto'
import { PinballWebhookPayload, ProductType } from '@/types'
import { logger } from '@/lib/logger'
import { apiError, apiSuccess } from '@/lib/api-response'

const VALID_PRODUCT_TYPES: ProductType[] = [
  'icp_blueprint',
  'complete_alex_pack',
  'complete_intelligence_stack',
  'founders_circle',
  'ad_pack',
  'social_pack',
  'email_pack',
  'gtm_plan',
  'action_plan',
]

export async function POST(request: Request) {
  const start = logger.apiStart('/api/webhooks/pinball')

  const signature = request.headers.get('x-pinball-signature')
  const webhookSecret = process.env.PINBALL_WEBHOOK_SECRET

  if (!signature || !webhookSecret) {
    logger.apiEnd('/api/webhooks/pinball', start, 401)
    return apiError('Invalid signature', 401, 'INVALID_SIGNATURE')
  }

  // Timing-safe signature check
  try {
    const sigBuf = Buffer.from(signature)
    const secretBuf = Buffer.from(webhookSecret)
    const valid = sigBuf.length === secretBuf.length && timingSafeEqual(sigBuf, secretBuf)
    if (!valid) {
      logger.apiEnd('/api/webhooks/pinball', start, 401)
      return apiError('Invalid signature', 401, 'INVALID_SIGNATURE')
    }
  } catch {
    logger.apiEnd('/api/webhooks/pinball', start, 401)
    return apiError('Invalid signature', 401, 'INVALID_SIGNATURE')
  }

  let body: PinballWebhookPayload
  try {
    body = await request.json()
  } catch {
    logger.apiEnd('/api/webhooks/pinball', start, 400)
    return apiError('Missing required fields', 400, 'INVALID_BODY')
  }

  const { email, first_name, last_name, products, order_id, amount } = body

  if (!email || !first_name || !last_name || !products || !order_id) {
    logger.apiEnd('/api/webhooks/pinball', start, 400)
    return apiError('Missing required fields', 400, 'MISSING_FIELDS')
  }

  logger.info('Webhook received', { route: '/api/webhooks/pinball', action: 'webhook_received', productCount: products.length })

  const adminClient = createAdminClient()

  // Upsert customer
  const { data: customer, error: customerError } = await adminClient
    .from('customers')
    .upsert(
      {
        email,
        first_name,
        last_name,
        pinball_customer_id: order_id,
      },
      { onConflict: 'email', ignoreDuplicates: false }
    )
    .select()
    .single()

  if (customerError || !customer) {
    logger.error('Customer upsert error', customerError, { route: '/api/webhooks/pinball' })
    logger.apiEnd('/api/webhooks/pinball', start, 500)
    return apiError('Database error', 500, 'DB_ERROR')
  }

  logger.info('Customer upserted', { route: '/api/webhooks/pinball', action: 'customer_upserted', customerId: customer.id.slice(0, 8) + '...' })

  // Create purchase records for each product
  const validProducts = products.filter((p) => VALID_PRODUCT_TYPES.includes(p as ProductType))

  if (validProducts.length > 0) {
    const purchaseRecords = validProducts.map((product_type) => ({
      customer_id: customer.id,
      product_type,
      pinball_order_id: order_id,
      amount: Math.round((amount / products.length) * 100), // store in cents, split evenly
    }))

    const { error: purchaseError } = await adminClient
      .from('purchases')
      .insert(purchaseRecords)

    if (purchaseError) {
      logger.error('Purchase insert error', purchaseError, { route: '/api/webhooks/pinball' })
    }

    logger.info('Purchases created', { route: '/api/webhooks/pinball', action: 'purchases_created', count: validProducts.length })
  }

  // Send magic link email via Supabase auth — redirect to /welcome
  const { error: magicLinkError } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/welcome`,
    },
  })

  if (magicLinkError) {
    logger.error('Magic link error', magicLinkError, { route: '/api/webhooks/pinball' })
  }

  logger.apiEnd('/api/webhooks/pinball', start, 200)
  return apiSuccess({ success: true })
}
