import { createAdminClient } from '@/lib/supabase/admin'

interface ScoreInputs {
  icp_confidence: number
  messaging_clarity: number
  competitive_position: number
  content_coverage: number
  data_completeness: number
}

export function calculateScoreFromInputs(inputs: ScoreInputs): {
  total: number
  foundation: number
  messaging: number
  competitive: number
  content: number
  ads: number
} {
  // Weighted scoring
  // Foundation (ICP quality) = 30% of total
  const foundation = Math.round(
    (inputs.icp_confidence * 0.6) + (inputs.data_completeness * 0.4)
  )

  // Messaging = 25% of total
  const messaging = Math.round(inputs.messaging_clarity)

  // Competitive = 20% of total
  const competitive = Math.round(inputs.competitive_position)

  // Content = 15% of total
  const content = Math.round(inputs.content_coverage)

  // Ads readiness = 10% of total
  // Starts at 0 — increases when SignalAds is used
  const ads = 0

  const total = Math.round(
    (foundation * 0.30) +
    (messaging * 0.25) +
    (competitive * 0.20) +
    (content * 0.15) +
    (ads * 0.10)
  )

  return { total, foundation, messaging, competitive, content, ads }
}

export async function saveSignalScore(
  businessId: string,
  sessionData: Record<string, unknown>
): Promise<void> {
  try {
    const adminClient = createAdminClient()

    const inputs = sessionData.signal_score_inputs as ScoreInputs | null
    if (!inputs) return

    const scores = calculateScoreFromInputs(inputs)

    await adminClient.from('signal_scores').insert({
      business_id: businessId,
      score_total: scores.total,
      score_foundation: scores.foundation,
      score_messaging: scores.messaging,
      score_competitive: scores.competitive,
      score_content: scores.content,
      score_ads: scores.ads,
      score_breakdown: {
        inputs,
        weights: {
          foundation: 0.30,
          messaging: 0.25,
          competitive: 0.20,
          content: 0.15,
          ads: 0.10,
        },
      },
    })

    // Update the business record with latest score
    await adminClient.from('businesses').update({
      signal_score: {
        total: scores.total,
        foundation: scores.foundation,
        messaging: scores.messaging,
        competitive: scores.competitive,
        content: scores.content,
        ads: scores.ads,
        calculated_at: new Date().toISOString(),
      },
    }).eq('id', businessId)
  } catch (err) {
    console.error('Signal score save error:', err)
    // Non-fatal — never block the ICP save
  }
}
