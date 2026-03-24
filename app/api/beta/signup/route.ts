import { createAdminClient } from '@/lib/supabase/admin'
import { validateBody } from '@/lib/validate'
import { logger } from '@/lib/logger'
import { apiError, apiSuccess } from '@/lib/api-response'
import { checkRateLimit, getIpIdentifier } from '@/lib/ratelimit'

interface BetaSignupRequest {
  firstName: string
  lastName: string
  email: string
  betaCode: string
  password: string
}

export async function POST(request: Request) {
  const start = logger.apiStart('/api/beta/signup')

  const allowed = await checkRateLimit(getIpIdentifier(request), 'signup', 5, 60)
  if (!allowed) {
    logger.warn('Rate limit exceeded for beta signup', { route: '/api/beta/signup', action: 'rate_limited' })
    return apiError('Too many signup attempts. Please try again later.', 429, 'RATE_LIMITED')
  }

  let body: BetaSignupRequest
  try {
    body = await request.json()
  } catch {
    logger.apiEnd('/api/beta/signup', start, 400)
    return apiError('Invalid request body', 400, 'INVALID_BODY')
  }

  const validation = validateBody(body as unknown as Record<string, unknown>, {
    firstName: { type: 'string', required: true, minLength: 1, maxLength: 50 },
    lastName: { type: 'string', required: true, minLength: 1, maxLength: 50 },
    email: { type: 'string', required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    password: { type: 'string', required: true, minLength: 8, maxLength: 100 },
    betaCode: { type: 'string', required: true, minLength: 3, maxLength: 50 },
  })

  if (!validation.valid) {
    logger.apiEnd('/api/beta/signup', start, 400)
    return apiError(validation.errors.join(', '), 400, 'VALIDATION_ERROR')
  }

  const { firstName, lastName, email, betaCode, password } = body

  const adminClient = createAdminClient()

  // Validate beta code
  const { data: codeRecord } = await adminClient
    .from('beta_codes')
    .select('*')
    .eq('code', betaCode.trim())
    .is('used_by', null)
    .single()

  if (!codeRecord) {
    logger.apiEnd('/api/beta/signup', start, 400)
    return apiError('Invalid or already used beta code', 400, 'INVALID_BETA_CODE')
  }

  // Check if email already exists
  const { data: existingUsers } = await adminClient.auth.admin.listUsers()
  const emailExists = existingUsers?.users?.some(
    (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
  )
  if (emailExists) {
    logger.apiEnd('/api/beta/signup', start, 400)
    return apiError('An account with this email already exists', 400, 'EMAIL_EXISTS')
  }

  // Create auth user
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { role: 'customer' },
  })

  if (authError || !authData.user) {
    logger.error('Beta signup auth error', authError, { route: '/api/beta/signup' })
    logger.apiEnd('/api/beta/signup', start, 500)
    return apiError('Failed to create account', 500, 'AUTH_CREATE_FAILED')
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
    logger.error('Beta signup customer error', customerError, { route: '/api/beta/signup' })
    logger.apiEnd('/api/beta/signup', start, 500)
    return apiError('Failed to create customer record', 500, 'CUSTOMER_CREATE_FAILED')
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

  logger.apiEnd('/api/beta/signup', start, 200)
  return apiSuccess({ success: true })
}
