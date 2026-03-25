import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Fetch share link
  const { data: link } = await adminClient
    .from('share_links')
    .select('*')
    .eq('token', token)
    .single()

  if (!link) {
    return NextResponse.json({ error: 'This link is no longer available.' }, { status: 404 })
  }

  // Check expiry
  if (new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This link has expired.' }, { status: 410 })
  }

  // Increment view count (non-fatal)
  await adminClient
    .from('share_links')
    .update({ view_count: (link.view_count || 0) + 1 })
    .eq('id', link.id)

  // Fetch session data
  const { data: session } = await adminClient
    .from('sessions')
    .select('icp_html, shareability')
    .eq('id', link.session_id)
    .single()

  if (!session?.icp_html) {
    return NextResponse.json({ error: 'Document not found.' }, { status: 404 })
  }

  // Fetch business name
  const { data: business } = await adminClient
    .from('businesses')
    .select('business_name')
    .eq('id', link.business_id)
    .single()

  return NextResponse.json({
    data: {
      icp_html: session.icp_html,
      business_name: business?.business_name || 'Business',
      expires_at: link.expires_at,
      shareability: session.shareability || null,
    },
  })
}
