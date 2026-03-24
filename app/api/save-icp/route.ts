import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendICPCompletionEmail } from '@/lib/email'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { sessionId: string; icpMarkdown: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { sessionId, icpMarkdown } = body
  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
  }
  if (!icpMarkdown || typeof icpMarkdown !== 'string') {
    return NextResponse.json({ error: 'icpMarkdown required' }, { status: 400 })
  }

  // Verify the session belongs to this user
  const adminClient = createAdminClient()
  const { data: customer } = await adminClient
    .from('customers')
    .select('id, email, first_name')
    .eq('auth_user_id', user.id)
    .single()

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  // Save ICP with icp_generated_at
  const { error } = await adminClient
    .from('sessions')
    .update({
      icp_data: { raw: icpMarkdown },
      icp_html: icpMarkdown,
      icp_generated_at: new Date().toISOString(),
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('customer_id', customer.id)

  if (error) {
    console.error('save-icp error:', error)
    return NextResponse.json({ error: 'Failed to save ICP' }, { status: 500 })
  }

  // Verify the write succeeded
  const { data: verification } = await adminClient
    .from('sessions')
    .select('icp_html, icp_generated_at, business_id')
    .eq('id', sessionId)
    .single()

  if (!verification?.icp_html) {
    return NextResponse.json(
      { error: 'ICP save verification failed' },
      { status: 500 }
    )
  }

  // Send completion email — non-fatal
  try {
    let businessName = 'your business'
    if (verification.business_id) {
      const { data: biz } = await adminClient
        .from('businesses')
        .select('business_name')
        .eq('id', verification.business_id)
        .single()
      if (biz?.business_name) businessName = biz.business_name
    }

    await sendICPCompletionEmail({
      email: customer.email,
      firstName: customer.first_name || 'there',
      businessName,
      appUrl: process.env.NEXT_PUBLIC_APP_URL || '',
    })
  } catch (emailErr) {
    console.error('ICP completion email failed:', emailErr)
  }

  return NextResponse.json({ ok: true })
}
