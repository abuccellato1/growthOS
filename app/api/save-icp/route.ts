import { logger } from '@/lib/logger'
import { apiError, apiSuccess } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendICPCompletionEmail } from '@/lib/email'

const ROUTE = '/api/save-icp'

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  const start = logger.apiStart(ROUTE, auth.customer.id)

  let body: { sessionId: string; icpMarkdown: string }
  try {
    body = await request.json()
  } catch {
    logger.apiEnd(ROUTE, start, 400, auth.customer.id)
    return apiError('Invalid request body', 400)
  }

  const { sessionId, icpMarkdown } = body
  if (!sessionId || typeof sessionId !== 'string') {
    logger.apiEnd(ROUTE, start, 400, auth.customer.id)
    return apiError('sessionId required', 400)
  }
  if (!icpMarkdown || typeof icpMarkdown !== 'string') {
    logger.apiEnd(ROUTE, start, 400, auth.customer.id)
    return apiError('icpMarkdown required', 400)
  }

  const adminClient = createAdminClient()

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
    .eq('customer_id', auth.customer.id)

  if (error) {
    logger.error('save-icp error', error, { route: ROUTE })
    logger.apiEnd(ROUTE, start, 500, auth.customer.id)
    return apiError('Failed to save ICP', 500)
  }

  // Verify the write succeeded
  const { data: verification } = await adminClient
    .from('sessions')
    .select('icp_html, icp_generated_at, business_id')
    .eq('id', sessionId)
    .single()

  if (!verification?.icp_html) {
    logger.apiEnd(ROUTE, start, 500, auth.customer.id)
    return apiError('ICP save verification failed', 500)
  }

  logger.info('ICP save verified', {
    route: '/api/save-icp',
    action: 'icp_saved',
    sessionId: sessionId,
    contentLength: icpMarkdown.length,
  })

  // Send completion email — non-fatal
  try {
    // Fetch first_name and business_name for email
    const { data: fullCustomer } = await adminClient
      .from('customers')
      .select('first_name')
      .eq('id', auth.customer.id)
      .single()

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
      email: auth.customer.email,
      firstName: fullCustomer?.first_name || 'there',
      businessName,
      appUrl: process.env.NEXT_PUBLIC_APP_URL || '',
    })
  } catch (emailErr) {
    logger.error('ICP completion email failed', emailErr, { route: ROUTE })
  }

  logger.apiEnd(ROUTE, start, 200, auth.customer.id)
  return apiSuccess({ ok: true })
}
