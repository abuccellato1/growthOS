import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Public routes — allow through
  const publicRoutes = ['/login', '/auth/callback', '/beta', '/api/beta', '/share', '/api/share']
  const isPublicRoute = publicRoutes.some(route => path.startsWith(route))
  const isWebhook = path.startsWith('/api/webhooks')

  if (isPublicRoute || isWebhook) {
    return supabaseResponse
  }

  // No session — redirect to login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Admin routes — check role + optional IP restriction
  if (path.startsWith('/admin')) {
    const role = user.user_metadata?.role
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    const allowedIPs = process.env.ADMIN_ALLOWED_IPS
    if (allowedIPs) {
      const clientIP = request.headers.get('x-forwarded-for')
        ?.split(',')[0]?.trim() ?? ''
      const allowed = allowedIPs.split(',').map((ip: string) => ip.trim())
      if (!allowed.includes(clientIP)) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}
