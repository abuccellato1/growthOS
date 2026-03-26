import { createAdminClient } from '@/lib/supabase/admin'

// Logarithmic curve for review count scoring
function reviewCountScore(count: number): number {
  if (count <= 0) return 0
  if (count === 1) return 12
  if (count === 2) return 20
  if (count === 3) return 26
  if (count <= 5) return 32
  if (count <= 10) return 42
  if (count <= 20) return 54
  if (count <= 35) return 63
  if (count <= 50) return 70
  if (count <= 75) return 77
  if (count <= 100) return 83
  if (count <= 150) return 88
  if (count <= 250) return 93
  if (count <= 500) return 97
  return 100
}

function ratingScore(rating: number): number {
  if (rating <= 0) return 0
  if (rating < 3.0) return 10
  if (rating < 3.5) return 25
  if (rating < 4.0) return 45
  if (rating < 4.3) return 65
  if (rating < 4.5) return 75
  if (rating < 4.7) return 85
  if (rating < 4.9) return 93
  return 100
}

function vocPhraseScore(count: number): number {
  if (count <= 0) return 0
  if (count <= 3) return 20
  if (count <= 7) return 40
  if (count <= 14) return 60
  if (count <= 25) return 78
  if (count <= 40) return 90
  return 100
}

export interface BusinessScoreInputs {
  hasPlaceId: boolean
  websiteFound: boolean
  websiteQuality: string | null
  researchComplete: boolean
  reviewCount: number
  averageRating: number
  vocPhraseCount: number
  certificationsFound: boolean
  icpConfidence: number | null
  messagingClarity: number | null
  hasVocAlignment: boolean
  hasSignalAds: boolean
  hasSignalContent: boolean
  hasSignalSequences: boolean
  hasSignalLaunch: boolean
  hasSignalSprint: boolean
  gtmDataQuality: number | null
  feedbackGiven: boolean
}

export interface DimensionScores {
  visibility: number
  credibility: number
  clarity: number
  reach: number
  conversion: number
  total: number
}

export function calculateDimensions(inputs: BusinessScoreInputs): DimensionScores {
  // VISIBILITY (100 points)
  let visibility = 0
  if (inputs.hasPlaceId) visibility += 35
  if (inputs.websiteFound) visibility += 25
  if (inputs.websiteQuality === 'strong') visibility += 25
  else if (inputs.websiteQuality === 'moderate') visibility += 15
  else if (inputs.websiteQuality === 'weak') visibility += 5
  if (inputs.researchComplete) visibility += 15
  visibility = Math.min(visibility, 100)

  // CREDIBILITY (100 points)
  let credibility = 0
  credibility += Math.round(reviewCountScore(inputs.reviewCount) * 0.5)
  credibility += Math.round(ratingScore(inputs.averageRating) * 0.3)
  credibility += Math.round(vocPhraseScore(inputs.vocPhraseCount) * 0.15)
  if (inputs.certificationsFound) credibility += 5
  credibility = Math.min(credibility, 100)

  // CLARITY (100 points)
  let clarity = 0
  if (inputs.icpConfidence !== null) clarity += Math.round(inputs.icpConfidence * 0.55)
  if (inputs.messagingClarity !== null) clarity += Math.round(inputs.messagingClarity * 0.35)
  if (inputs.hasVocAlignment) clarity += 10
  clarity = Math.min(clarity, 100)

  // REACH (100 points)
  let reach = 0
  if (inputs.hasSignalAds) reach += 40
  if (inputs.hasSignalContent) reach += 35
  if (inputs.hasSignalSequences) reach += 25
  reach = Math.min(reach, 100)

  // CONVERSION (100 points)
  let conversion = 0
  if (inputs.hasSignalLaunch) conversion += 35
  if (inputs.hasSignalSprint) conversion += 30
  if (inputs.gtmDataQuality !== null) conversion += Math.round(inputs.gtmDataQuality * 0.25)
  if (inputs.feedbackGiven) conversion += 10
  conversion = Math.min(conversion, 100)

  // TOTAL — weighted average
  const total = Math.round(
    (visibility * 0.25) + (credibility * 0.25) + (clarity * 0.25) + (reach * 0.15) + (conversion * 0.10)
  )

  return { visibility, credibility, clarity, reach, conversion, total }
}

export async function calculateAndSaveScore(businessId: string): Promise<DimensionScores | null> {
  try {
    const adminClient = createAdminClient()

    const [businessResult, sessionResult, vocResult, moduleOutputsResult, feedbackResult] = await Promise.all([
      adminClient.from('businesses').select('*').eq('id', businessId).single(),
      adminClient.from('sessions').select('signal_score_inputs, gtm_data, status')
        .eq('business_id', businessId).eq('status', 'completed')
        .not('archived', 'is', true)
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      adminClient.from('voice_of_customer').select('extracted_phrases, top_phrases').eq('business_id', businessId),
      adminClient.from('module_outputs').select('module_type').eq('business_id', businessId),
      adminClient.from('feedback').select('id').eq('business_id', businessId).limit(1).maybeSingle(),
    ])

    const business = businessResult.data
    if (!business) return null

    const session = sessionResult.data
    const vocEntries = vocResult.data || []
    const moduleOutputs = moduleOutputsResult.data || []

    const research = business.business_research as Record<string, unknown> | null
    const gmbData = research?.gmbData as Record<string, unknown> | null

    const reviewCount = gmbData?.reviewCount ? parseInt(gmbData.reviewCount as string) || 0 : 0
    const averageRating = gmbData?.averageRating ? parseFloat(gmbData.averageRating as string) || 0 : 0
    const certifications = research?.certifications as string[] | null
    const certificationsFound = !!(certifications && certifications.length > 0)

    const vocPhraseCount = vocEntries.reduce(
      (sum, v) => sum + ((v.extracted_phrases as string[] | null)?.length || 0), 0
    )

    const scoreInputs = session?.signal_score_inputs as Record<string, unknown> | null

    const gtmData = session?.gtm_data as Record<string, unknown> | null
    const gtmDataQuality = gtmData
      ? Math.min(100, Object.values(gtmData).filter(v => v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)).length * 12)
      : null

    const moduleTypes = moduleOutputs.map((o: { module_type: string }) => o.module_type)

    const inputs: BusinessScoreInputs = {
      hasPlaceId: !!business.place_id,
      websiteFound: !!(research?.websiteFound),
      websiteQuality: (research?.websiteQuality as string) || null,
      researchComplete: business.research_status === 'complete',
      reviewCount,
      averageRating,
      vocPhraseCount,
      certificationsFound,
      icpConfidence: (scoreInputs?.icp_confidence as number) || null,
      messagingClarity: (scoreInputs?.messaging_clarity as number) || null,
      hasVocAlignment: vocPhraseCount > 5 && !!session,
      hasSignalAds: moduleTypes.includes('signal_ads'),
      hasSignalContent: moduleTypes.includes('signal_content'),
      hasSignalSequences: moduleTypes.includes('signal_sequences'),
      hasSignalLaunch: moduleTypes.includes('signal_launch'),
      hasSignalSprint: moduleTypes.includes('signal_sprint'),
      gtmDataQuality,
      feedbackGiven: !!feedbackResult.data,
    }

    const scores = calculateDimensions(inputs)

    // Save to signal_scores table (both old and new column names)
    await adminClient.from('signal_scores').insert({
      business_id: businessId,
      score_total: scores.total,
      score_foundation: scores.clarity,
      score_messaging: scores.credibility,
      score_competitive: scores.reach,
      score_content: scores.conversion,
      score_ads: scores.visibility,
      score_visibility: scores.visibility,
      score_credibility: scores.credibility,
      score_clarity: scores.clarity,
      score_reach: scores.reach,
      score_conversion: scores.conversion,
      score_breakdown: { inputs, scores },
    })

    // Update business.signal_score for quick access
    await adminClient.from('businesses').update({
      signal_score: {
        total: scores.total,
        visibility: scores.visibility,
        credibility: scores.credibility,
        clarity: scores.clarity,
        reach: scores.reach,
        conversion: scores.conversion,
        calculated_at: new Date().toISOString(),
      },
    }).eq('id', businessId)

    return scores
  } catch (err) {
    console.error('Signal score error:', String(err))
    return null
  }
}

// Backward compatibility alias
export async function saveSignalScore(
  businessId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _sessionData: Record<string, unknown>
): Promise<void> {
  await calculateAndSaveScore(businessId)
}
