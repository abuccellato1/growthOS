import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  let body: {
    businessId: string
    outputId: string
    rating: number
    feedbackText?: string
    contentBlockId?: string
  }
  try { body = await request.json() } catch { return apiError('Invalid body', 400, 'INVALID_BODY') }

  const { businessId, outputId, rating, feedbackText, contentBlockId } = body
  if (!businessId || !outputId || rating === undefined) {
    return apiError('Missing required fields', 400, 'VALIDATION_ERROR')
  }

  const adminClient = createAdminClient()

  // Verify ownership
  const { data: biz } = await adminClient.from('businesses').select('customer_id').eq('id', businessId).single()
  if (!biz) return apiError('Business not found', 404, 'NOT_FOUND')
  const { data: cust } = await adminClient.from('customers').select('id').eq('id', biz.customer_id).eq('auth_user_id', auth.user.id).single()
  if (!cust) return apiError('Access denied', 403, 'FORBIDDEN')

  await adminClient.from('feedback').insert({
    business_id: businessId,
    deliverable_type: 'signal_ads',
    content_block_id: contentBlockId || null,
    content_text: null,
    rating,
    feedback_text: feedbackText || null,
  })

  await adminClient.from('module_outputs').update({
    feedback_rating: rating,
    feedback_text: feedbackText || null,
  }).eq('id', outputId)

  return apiSuccess({ saved: true })
}
