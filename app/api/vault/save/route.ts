import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateKB } from '@/lib/knowledge-base'

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

  // Trigger 2x weighted preference extraction for vault save
  if (output?.module_type && output?.output_data) {
    const moduleAgentMap: Record<string, string> = {
      signal_ads: 'signal_ads.jaimie',
      signal_content: 'signal_content.sofia',
      signal_sequences: 'signal_sequences.emily',
    }
    const agentKey = moduleAgentMap[output.module_type as string]
    if (agentKey) {
      const outputData = output.output_data as Record<string, unknown>
      const ss = (outputData?.strategySignals || outputData?.strategy_signals) as Record<string, unknown> | undefined
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/learn/extract-preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          agentKey,
          signalType: 'vault_save',
          signalData: {
            primaryAngle: ss?.primaryAngle || '',
            keyDifferentiator: ss?.keyDifferentiator || '',
            toneNotes: ss?.toneNotes || '',
            sequenceGoal: ss?.sequenceGoal || '',
            formInputs: output.output_data,
          },
          signalWeight: 2,
        }),
      }).catch(() => null)
    }
  }

  // Vault save = strongest approval signal — update KB performance (non-blocking)
  if (businessId && output?.module_type) {
    const moduleType = output.module_type as string
    const outputDataObj = output.output_data as Record<string, unknown>
    const ss = (outputDataObj?.strategySignals || outputDataObj?.strategy_signals) as Record<string, unknown> | undefined
    if (ss) {
      const moduleUpdate: Record<string, unknown> = {}
      if (ss.primaryAngle) moduleUpdate.approvedAngles = [ss.primaryAngle as string]
      if (ss.primaryTheme) moduleUpdate.approvedFormats = [ss.primaryTheme as string]
      if (Object.keys(moduleUpdate).length > 0) {
        updateKB(businessId, 'performance', {
          byModule: { [moduleType]: moduleUpdate },
          globalPatterns: {
            whatAlwaysWorks: ss.primaryAngle ? [ss.primaryAngle as string] : [],
          },
        }, false).catch(() => null)
      }
    }
  }

  return apiSuccess({ saved: true })
}
