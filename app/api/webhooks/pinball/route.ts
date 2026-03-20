import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { PinballWebhookPayload, ProductType } from '@/types'

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
  const signature = request.headers.get('x-pinball-signature')
  const webhookSecret = process.env.PINBALL_WEBHOOK_SECRET

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Timing-safe signature check
  try {
    const sigBuf = Buffer.from(signature)
    const secretBuf = Buffer.from(webhookSecret)
    const valid = sigBuf.length === secretBuf.length && timingSafeEqual(sigBuf, secretBuf)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: PinballWebhookPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { email, first_name, last_name, products, order_id, amount } = body

  if (!email || !first_name || !last_name || !products || !order_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

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
    console.error('Customer upsert error:', customerError)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

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
      console.error('Purchase insert error:', purchaseError)
    }
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
    console.error('Magic link error:', magicLinkError)
  }

  return NextResponse.json({ success: true }, { status: 200 })
}
