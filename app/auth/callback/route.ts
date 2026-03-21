import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Check intake completion
        const { data: customer } = await supabase
          .from('customers')
          .select('business_name, website_url, primary_service, geographic_market')
          .eq('auth_user_id', user.id)
          .single()

        const intakeComplete = !!(
          customer?.business_name?.trim() &&
          customer?.website_url?.trim() &&
          customer?.primary_service?.trim() &&
          customer?.geographic_market?.trim()
        )

        // Update last_login
        await supabase
          .from('customers')
          .update({ last_login: new Date().toISOString() })
          .eq('auth_user_id', user.id)

        if (!intakeComplete) {
          return NextResponse.redirect(
            new URL('/dashboard?onboarding=true', request.url)
          )
        }
      }

      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth_failed', request.url))
}
