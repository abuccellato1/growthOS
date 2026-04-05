import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateKB } from '@/lib/knowledge-base'

interface ContentFeedbackItem {
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
    contentFeedbackItems?: ContentFeedbackItem[]
  }
  try { body = await request.json() } catch { return apiError('Invalid body', 400, 'INVALID_BODY') }

  const { businessId, outputId, rating, feedbackText, contentFeedbackItems } = body
  if (!businessId || !outputId) return apiError('Missing required fields', 400, 'VALIDATION_ERROR')

  const adminClient = createAdminClient()

  const { data: biz } = await adminClient.from('businesses').select('customer_id').eq('id', businessId).single()
  if (!biz) return apiError('Business not found', 404, 'NOT_FOUND')
  const { data: cust } = await adminClient.from('customers').select('id').eq('id', biz.customer_id).eq('auth_user_id', auth.user.id).single()
  if (!cust) return apiError('Access denied', 403, 'FORBIDDEN')

  if (contentFeedbackItems && contentFeedbackItems.length > 0) {
    const rows = contentFeedbackItems.map(item => ({
      business_id: businessId,
      deliverable_type: 'signal_content',
      content_block_id: item.blockId,
      content_text: item.contentText,
      rating: item.rating,
      feedback_text: item.reasons.length > 0 ? item.reasons.join(', ') : null,
    }))
    await adminClient.from('feedback').insert(rows)
  }

  if (rating !== undefined) {
    await adminClient.from('feedback').insert({
      business_id: businessId,
      deliverable_type: 'signal_content',
      content_block_id: null,
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
    const performanceUpdate: Record<string, unknown> = { byModule: { signal_content: {} } }
    const contentModule = (performanceUpdate.byModule as Record<string, unknown>).signal_content as Record<string, unknown>

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
          if (ss?.primaryTheme) contentModule.approvedFormats = [ss.primaryTheme as string]

          const pillars = output.pillars as Array<Record<string, unknown>> | undefined
          if (pillars && pillars.length > 0) {
            const hooks = pillars
              .map(p => {
                const posts = p.posts as Record<string, unknown> | undefined
                const linkedin = posts?.linkedin as Record<string, unknown> | undefined
                return linkedin?.hook as string | undefined
              })
              .filter(Boolean) as string[]
            if (hooks.length > 0) contentModule.approvedHooks = hooks.slice(0, 5)
          }
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
          if (ss?.primaryTheme) contentModule.rejectedPatterns = [ss.primaryTheme as string]
        }
      }
    }

    if (contentFeedbackItems && contentFeedbackItems.length > 0) {
      const flagged = contentFeedbackItems.filter(i => i.rating === -1)
      if (flagged.length > 0) {
        contentModule.rejectedPatterns = [
          ...((contentModule.rejectedPatterns as string[]) || []),
          ...flagged.map(i => i.contentText.slice(0, 100)),
        ]
      }
    }

    if (Object.keys(contentModule).length > 0) {
      updateKB(businessId, 'performance', performanceUpdate, false).catch(() => null)
    }
  }

  return apiSuccess({ saved: true })
}
