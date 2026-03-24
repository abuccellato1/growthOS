import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface BetaSignupRequest {
  firstName: string
  lastName: string
  email: string
  betaCode: string
  password: string
}

export async function POST(request: Request) {
  let body: BetaSignupRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { firstName, lastName, email, betaCode, password } = body

  if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !betaCode?.trim() || !password) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Validate beta code
  const { data: codeRecord } = await adminClient
    .from('beta_codes')
    .select('*')
    .eq('code', betaCode.trim())
    .is('used_by', null)
    .single()

  if (!codeRecord) {
    return NextResponse.json({ error: 'Invalid or already used beta code' }, { status: 400 })
  }

  // Check if email already exists
  const { data: existingUsers } = await adminClient.auth.admin.listUsers()
  const emailExists = existingUsers?.users?.some(
    (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
  )
  if (emailExists) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 })
  }

  // Create auth user
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { role: 'customer' },
  })

  if (authError || !authData.user) {
    console.error('Beta signup auth error:', authError)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }

  // Create customer record
  const { data: customer, error: customerError } = await adminClient
    .from('customers')
    .insert({
      auth_user_id: authData.user.id,
      email: email.trim().toLowerCase(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      role: 'customer',
      beta_user: true,
    })
    .select()
    .single()

  if (customerError) {
    console.error('Beta signup customer error:', customerError)
    return NextResponse.json({ error: 'Failed to create customer record' }, { status: 500 })
  }

  // Mark beta code as used
  await adminClient
    .from('beta_codes')
    .update({
      used_by: customer.id,
      used_at: new Date().toISOString(),
    })
    .eq('code', betaCode.trim())

  // Create a purchase record for the ICP blueprint (beta users get it free)
  await adminClient.from('purchases').insert({
    customer_id: customer.id,
    product_type: 'icp_blueprint',
    amount: 0,
  })

  return NextResponse.json({ success: true })
}
