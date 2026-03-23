import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  const { error } = await adminClient
    .from('sessions')
    .update({ icp_html: icpMarkdown })
    .eq('id', sessionId)
    .eq('customer_id', customer.id)

  if (error) {
    console.error('save-icp error:', error)
    return NextResponse.json({ error: 'Failed to save ICP' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
