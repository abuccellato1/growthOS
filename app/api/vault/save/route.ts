import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  let body: { businessId: string; outputId: string; label?: string }
  try { body = await request.json() } catch { return apiError('Invalid body', 400, 'INVALID_BODY') }
  const { businessId, outputId, label } = body
  if (!businessId || !outputId) return apiError('Missing required fields', 400, 'VALIDATION_ERROR')

  const adminClient = createAdminClient()

  const { data: biz } = await adminClient.from('businesses').select('customer_id, style_memory').eq('id', businessId).single()
  if (!biz) return apiError('Business not found', 404, 'NOT_FOUND')
  const { data: cust } = await adminClient.from('customers').select('id').eq('id', biz.customer_id).eq('auth_user_id', auth.user.id).single()
  if (!cust) return apiError('Access denied', 403, 'FORBIDDEN')

  const { data: output } = await adminClient
    .from('module_outputs')
    .update({ vault_saved: true, vault_pinned_at: new Date().toISOString(), vault_label: label || null })
    .eq('id', outputId)
    .eq('business_id', businessId)
    .select('output_data, module_type')
    .single()

  if (!output) return apiError('Output not found', 404, 'NOT_FOUND')

  // Extract style signals into style_memory (non-blocking)
  try {
    const outputData = output.output_data as Record<string, unknown>
    const ss = (outputData?.strategySignals || outputData?.strategy_signals) as Record<string, unknown> | undefined
    if (ss) {
      const existing = (biz.style_memory as Record<string, unknown[]>) || {}
      const moduleKey = output.module_type as string
      const prev = (existing[moduleKey] as unknown[]) || []
      const entry = {
        savedAt: new Date().toISOString(),
        primaryAngle: ss.primaryAngle || ss.primary_angle || '',
        keyDifferentiator: ss.keyDifferentiator || ss.sequenceGoal || '',
        toneNotes: ss.toneNotes || '',
        dataSourcesUsed: ss.dataSourcesUsed || [],
      }
      const updated = [entry, ...prev].slice(0, 10)
      await adminClient
        .from('businesses')
        .update({ style_memory: { ...existing, [moduleKey]: updated } })
        .eq('id', businessId)
    }
  } catch { /* non-fatal */ }

  return apiSuccess({ saved: true })
}
