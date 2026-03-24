// SQL to run in Supabase before deploying:
// ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS gmb_url text;

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface CreateBusinessRequest {
  businessName: string
  websiteUrl?: string
  primaryService?: string
  geographicMarket?: string
  gmbUrl?: string
  migratingFromCustomer?: boolean
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: CreateBusinessRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { businessName, websiteUrl, primaryService, geographicMarket, gmbUrl, migratingFromCustomer } = body

  if (!businessName?.trim()) {
    return NextResponse.json({ error: 'Business name is required' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Fetch customer record
  const { data: customer } = await adminClient
    .from('customers')
    .select('id, beta_user')
    .eq('auth_user_id', user.id)
    .single()

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  // Check business limit (skip during migration)
  if (!migratingFromCustomer) {
    if (!customer.beta_user) {
      const { count } = await adminClient
        .from('businesses')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', customer.id)

      if ((count ?? 0) >= 1) {
        return NextResponse.json(
          { error: 'Business limit reached. Upgrade to add more businesses.' },
          { status: 403 }
        )
      }
    }
  }

  // Create business record
  const { data: business, error } = await adminClient
    .from('businesses')
    .insert({
      customer_id: customer.id,
      business_name: businessName.trim(),
      website_url: websiteUrl?.trim() || null,
      primary_service: primaryService?.trim() || null,
      geographic_market: geographicMarket?.trim() || null,
      gmb_url: gmbUrl?.trim() || null,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    console.error('Business create error:', error)
    return NextResponse.json({ error: 'Failed to create business' }, { status: 500 })
  }

  return NextResponse.json({ success: true, business })
}
