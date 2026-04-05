import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateKB } from '@/lib/knowledge-base'

interface AdFeedbackItem {
  blockId: string
  contentText: string
  rating: number
  reasons: string[]
}

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  let body: {
    businessId: string
    outputId: string
    rating?: number
    feedbackText?: string
    contentBlockId?: string
    adFeedbackItems?: AdFeedbackItem[]
  }
  try { body = await request.json() } catch { return apiError('Invalid body', 400, 'INVALID_BODY') }

  const { businessId, outputId, rating, feedbackText, contentBlockId, adFeedbackItems } = body
  if (!businessId || !outputId) return apiError('Missing required fields', 400, 'VALIDATION_ERROR')

  const adminClient = createAdminClient()

  const { data: biz } = await adminClient.from('businesses').select('customer_id').eq('id', businessId).single()
  if (!biz) return apiError('Business not found', 404, 'NOT_FOUND')
  const { data: cust } = await adminClient.from('customers').select('id').eq('id', biz.customer_id).eq('auth_user_id', auth.user.id).single()
  if (!cust) return apiError('Access denied', 403, 'FORBIDDEN')

  // Batch per-ad feedback items
  if (adFeedbackItems && adFeedbackItems.length > 0) {
    const rows = adFeedbackItems.map(item => ({
      business_id: businessId,
      deliverable_type: 'signal_ads',
      content_block_id: item.blockId,
      content_text: item.contentText,
      rating: item.rating,
      feedback_text: item.reasons.length > 0 ? item.reasons.join(', ') : null,
    }))
    await adminClient.from('feedback').insert(rows)
  }

  // Overall output rating
  if (rating !== undefined) {
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
  }

  // Update KB performance domain — non-blocking
  if (businessId) {
    const performanceUpdate: Record<string, unknown> = { byModule: { signal_ads: {} } }
    const adsModule = (performanceUpdate.byModule as Record<string, unknown>).signal_ads as Record<string, unknown>

    if (rating !== undefined) {
      if (rating >= 4) {
        const { data: outputData } = await adminClient
          .from('module_outputs')
          .select('output_data, form_inputs')
          .eq('id', outputId)
          .single()

        if (outputData?.output_data) {
          const output = outputData.output_data as Record<string, unknown>
          const ss = output.strategySignals as Record<string, unknown> | undefined
          const formInputs = outputData.form_inputs as Record<string, unknown> | undefined
          if (ss?.primaryAngle) adsModule.approvedAngles = [ss.primaryAngle as string]
          if (formInputs?.tone) adsModule.approvedTones = [formInputs.tone as string]
        }
      } else if (rating <= 2) {
        const { data: outputData } = await adminClient
          .from('module_outputs')
          .select('output_data')
          .eq('id', outputId)
          .single()

        if (outputData?.output_data) {
          const output = outputData.output_data as Record<string, unknown>
          const ss = output.strategySignals as Record<string, unknown> | undefined
          if (ss?.primaryAngle) adsModule.rejectedAngles = [ss.primaryAngle as string]
        }
      }
    }

    if (adFeedbackItems && adFeedbackItems.length > 0) {
      const flagged = adFeedbackItems.filter(i => i.rating === -1)
      if (flagged.length > 0) {
        adsModule.rejectedPatterns = flagged
          .map(i => i.contentText.slice(0, 100))
          .filter(Boolean)
      }
    }

    if (Object.keys(adsModule).length > 0) {
      updateKB(businessId, 'performance', performanceUpdate, false).catch(() => null)
    }
  }

  return apiSuccess({ saved: true })
}
