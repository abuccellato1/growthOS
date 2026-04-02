import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  let body: {
    businessId: string
    outputId: string
    contentCalendar: Record<string, unknown>
  }
  try { body = await request.json() } catch {
    return apiError('Invalid body', 400, 'INVALID_BODY')
  }

  const { businessId, outputId, contentCalendar } = body
  if (!businessId || !outputId || !contentCalendar) {
    return apiError('Missing required fields', 400, 'VALIDATION_ERROR')
  }

  const adminClient = createAdminClient()

  const { data: biz } = await adminClient
    .from('businesses').select('customer_id').eq('id', businessId).single()
  if (!biz) return apiError('Business not found', 404, 'NOT_FOUND')

  const { data: cust } = await adminClient
    .from('customers').select('id')
    .eq('id', biz.customer_id).eq('auth_user_id', auth.user.id).single()
  if (!cust) return apiError('Access denied', 403, 'FORBIDDEN')

  const { data: existing } = await adminClient
    .from('module_outputs')
    .select('output_data')
    .eq('id', outputId)
    .single()

  if (!existing?.output_data) {
    return apiError('Output not found', 404, 'NOT_FOUND')
  }

  const { error: updateError } = await adminClient
    .from('module_outputs')
    .update({
      output_data: {
        ...(existing.output_data as Record<string, unknown>),
        contentCalendar,
      }
    })
    .eq('id', outputId)

  if (updateError) {
    console.error('[CalendarUpdate] Failed:', updateError.message)
    return apiError('Failed to save calendar', 500, 'UPDATE_FAILED')
  }

  return apiSuccess({ saved: true })
}
