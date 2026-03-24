import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-response'
import { NextResponse } from 'next/server'

export interface AuthResult {
  user: { id: string; email: string }
  customer: {
    id: string
    email: string
    beta_user: boolean
    role: string
  }
  error?: NextResponse
}

export async function requireAuth(): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      user: { id: '', email: '' },
      customer: { id: '', email: '', beta_user: false, role: '' },
      error: apiError('Unauthorized', 401, 'UNAUTHORIZED'),
    }
  }

  const adminClient = createAdminClient()
  const { data: customer } = await adminClient
    .from('customers')
    .select('id, email, beta_user, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!customer) {
    return {
      user: { id: user.id, email: user.email ?? '' },
      customer: { id: '', email: '', beta_user: false, role: '' },
      error: apiError('Customer not found', 404, 'NOT_FOUND'),
    }
  }

  return { user: { id: user.id, email: user.email ?? '' }, customer }
}

export async function requireAdmin(): Promise<AuthResult> {
  const result = await requireAuth()
  if (result.error) return result

  if (result.customer.role !== 'admin') {
    return {
      ...result,
      error: apiError('Forbidden', 403, 'FORBIDDEN'),
    }
  }

  return result
}
