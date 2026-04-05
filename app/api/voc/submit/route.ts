import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { calculateAndSaveScore } from '@/lib/signal-score'
import { updateKB } from '@/lib/knowledge-base'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  let body: {
    businessId: string
    source: string
    sourceUrl?: string
    rawText: string
  }
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_BODY')
  }

  const { businessId, source, sourceUrl, rawText } = body

  if (!businessId || !source || !rawText) {
    return apiError('businessId, source, and rawText are required', 400, 'VALIDATION_ERROR')
  }

  if (rawText.length < 50 || rawText.length > 10000) {
    return apiError('rawText must be between 50 and 10000 characters', 400, 'VALIDATION_ERROR')
  }

  const validSources = [
    'google_reviews',
    'google_places_api',
    'facebook_reviews',
    'email_testimonials',
    'case_studies',
    'testimonials',
    'email_replies',
    'web_search',
    'other',
  ]
  if (!validSources.includes(source)) {
    return apiError('Invalid source type', 400, 'VALIDATION_ERROR')
  }

  const adminClient = createAdminClient()

  // Verify business belongs to user
  const { data: business } = await adminClient
    .from('businesses')
    .select('id, customer_id')
    .eq('id', businessId)
    .single()

  if (!business) {
    return apiError('Business not found', 404, 'NOT_FOUND')
  }

  const { data: customer } = await adminClient
    .from('customers')
    .select('id')
    .eq('id', business.customer_id)
    .eq('auth_user_id', auth.user.id)
    .single()

  if (!customer) {
    return apiError('Business does not belong to this user', 403, 'FORBIDDEN')
  }

  // Extract marketing language with Claude Haiku
  let parsedData: Record<string, unknown> = {}
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: `You are a marketing language analyst. Extract the most valuable marketing copy signals from this customer feedback. Return ONLY valid JSON, no markdown:
{
  "extracted_phrases": [],
  "outcome_language": [],
  "emotional_language": [],
  "problem_language": [],
  "top_phrases": [],
  "copy_themes": [],
  "social_proof_statements": []
}`,
      messages: [
        {
          role: 'user',
          content: `Extract marketing language from this customer feedback:\n\n${rawText}`,
        },
      ],
    })

    const replyContent = response.content[0]
    if (replyContent.type === 'text') {
      const jsonMatch = replyContent.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0])
      }
    }
  } catch (err) {
    console.error('VOC extraction error:', err)
    // Non-fatal — save raw text even if extraction fails
    parsedData = {
      extracted_phrases: [],
      outcome_language: [],
      emotional_language: [],
      problem_language: [],
      top_phrases: [],
      copy_themes: [],
      social_proof_statements: [],
    }
  }

  // Save to voice_of_customer table
  await adminClient.from('voice_of_customer').insert({
    business_id: businessId,
    source,
    source_url: sourceUrl || null,
    raw_text: rawText,
    extracted_phrases: parsedData.extracted_phrases || null,
    outcome_language: parsedData.outcome_language || null,
    emotional_language: parsedData.emotional_language || null,
    problem_language: parsedData.problem_language || null,
    top_phrases: parsedData.top_phrases || null,
    times_used_in_generation: 0,
    performance_score: 0,
  })

  // Aggregate top phrases from all VOC records for this business
  const { data: allVoc } = await adminClient
    .from('voice_of_customer')
    .select('top_phrases')
    .eq('business_id', businessId)

  const aggregatedPhrases: string[] = []
  if (allVoc) {
    for (const entry of allVoc) {
      if (entry.top_phrases && Array.isArray(entry.top_phrases)) {
        aggregatedPhrases.push(...(entry.top_phrases as string[]))
      }
    }
  }

  // Update business.voice_of_customer with aggregated data
  await adminClient.from('businesses').update({
    voice_of_customer: {
      top_phrases: aggregatedPhrases.slice(0, 20),
      total_entries: allVoc?.length || 0,
      last_updated: new Date().toISOString(),
    },
  }).eq('id', businessId)

  // Recalculate Signal Score with new VOC data
  if (businessId) {
    calculateAndSaveScore(businessId).catch(err =>
      console.error('Score calc error:', err)
    )
  }

  // Update KB audience domain with VOC language — non-blocking
  if (businessId && parsedData) {
    const vocData = parsedData as Record<string, unknown>
    updateKB(businessId, 'audience', {
      languageThatWorks: [
        ...((vocData.top_phrases as string[]) || []),
        ...((vocData.outcome_language as string[]) || []),
      ].slice(0, 20),
    }, true).catch(() => null)
  }

  return apiSuccess({ extracted: parsedData })
}
