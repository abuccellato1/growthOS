import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { apiError, apiSuccess } from '@/lib/api-response'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface ResearchRequest {
  businessId?: string
  customerId?: string
  businessName: string
  websiteUrl: string
  primaryService: string
  geographicMarket: string
  gmbUrl?: string
}

export async function POST(request: Request) {
  const start = logger.apiStart('/api/research')

  let body: ResearchRequest
  try {
    body = await request.json()
  } catch {
    logger.apiEnd('/api/research', start, 400)
    return apiError('Invalid request body', 400, 'INVALID_BODY')
  }

  const { businessId, customerId, businessName, websiteUrl, primaryService, geographicMarket, gmbUrl } = body

  if (!businessName || !websiteUrl || !primaryService) {
    logger.apiEnd('/api/research', start, 400)
    return apiError('Missing required fields', 400, 'MISSING_FIELDS')
  }

  const adminClient = createAdminClient()

  // Set research_status to running
  if (businessId) {
    await adminClient.from('businesses').update({
      research_status: 'running',
    }).eq('id', businessId)
  }

  let call1Result: Record<string, unknown> | null = null
  let call2Result: Record<string, unknown> | null = null

  try {
    // CALL 1 — Website and GMB deep scan
    const call1Promise = anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }] as Parameters<typeof anthropic.messages.create>[0]['tools'],
      system: `You are researching a business before a marketing discovery session. Search for the business website and Google Business Profile. Extract as much factual intelligence as possible. Return ONLY valid JSON, no markdown, no preamble:
{
  "whatTheyDo": "one sentence description",
  "yearsInBusiness": "number or empty string",
  "primaryProduct": "main product or service",
  "apparentTargetCustomer": "who the website targets",
  "differentiators": "notable claims or unique aspects",
  "websiteFound": true or false,
  "services": [],
  "serviceAreas": [],
  "teamSize": "estimated or empty string",
  "foundedYear": "year or empty string",
  "certifications": [],
  "awards": [],
  "testimonialThemes": [],
  "websiteQuality": "strong/moderate/weak",
  "blogTopics": [],
  "pricingSignals": "premium/mid/budget/unknown",
  "gmbData": {
    "reviewCount": "",
    "averageRating": "",
    "categories": "",
    "serviceArea": "",
    "hoursAvailable": true or false,
    "photosCount": ""
  }
}`,
      messages: [{
        role: 'user',
        content: `Research this business thoroughly:\nBusiness Name: ${businessName}\nWebsite: ${websiteUrl}\nPrimary Service: ${primaryService}\nGeographic Market: ${geographicMarket}${gmbUrl ? `\nGoogle Business Profile: ${gmbUrl}` : ''}\n\nSearch for their website, Google Business Profile, and any business directory listings. Extract every detail available.`,
      }],
    })

    // CALL 2 — Review and voice of customer extraction (only if we have a URL)
    const call2Promise = (gmbUrl || websiteUrl)
      ? anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }] as Parameters<typeof anthropic.messages.create>[0]['tools'],
          system: `You are extracting voice of customer data from business reviews. Search for customer reviews of this business on Google, Yelp, Facebook, or any review platform. Return ONLY valid JSON, no markdown:
{
  "reviewsFound": true or false,
  "totalReviewsAnalyzed": 0,
  "extractedPhrases": [],
  "outcomeLanguage": [],
  "emotionalLanguage": [],
  "problemLanguage": [],
  "topPhrases": [],
  "commonComplaints": [],
  "commonPraises": [],
  "averageSentiment": "positive/neutral/negative",
  "copyThemes": [],
  "socialProofStatements": []
}`,
          messages: [{
            role: 'user',
            content: `Find and analyze customer reviews for:\nBusiness: ${businessName}\nWebsite: ${websiteUrl}${gmbUrl ? `\nGoogle Business Profile: ${gmbUrl}` : ''}\n\nSearch Google reviews, Yelp, Facebook reviews, and any other review platform. Extract the exact language customers use — especially how they describe their problem before hiring this business and the results they got after.`,
          }],
        })
      : Promise.resolve(null)

    const [res1, res2] = await Promise.all([call1Promise, call2Promise])

    // Parse call 1
    const textBlock1 = res1?.content?.find((b: { type: string }) => b.type === 'text')
    if (textBlock1 && textBlock1.type === 'text') {
      const raw = (textBlock1 as { type: 'text'; text: string }).text.trim()
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        call1Result = JSON.parse(jsonMatch[0])
      }
    }

    // Parse call 2
    if (res2) {
      const textBlock2 = res2.content?.find((b: { type: string }) => b.type === 'text')
      if (textBlock2 && textBlock2.type === 'text') {
        const raw = (textBlock2 as { type: 'text'; text: string }).text.trim()
        const jsonMatch = raw.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          call2Result = JSON.parse(jsonMatch[0])
        }
      }
    }
  } catch (err) {
    logger.warn('Business research failed', { route: '/api/research', businessId, error: String(err) })
    if (businessId) {
      await adminClient.from('businesses').update({
        research_status: 'failed',
      }).eq('id', businessId)
    }
    logger.apiEnd('/api/research', start, 200)
    return apiSuccess({ research: null })
  }

  // Merge results
  const enhancedResearch = {
    ...(call1Result || {}),
    voiceOfCustomer: call2Result,
  }

  // Save to businesses table
  if (businessId) {
    await adminClient.from('businesses').update({
      business_research: enhancedResearch,
      research_status: 'complete',
      updated_at: new Date().toISOString(),
    }).eq('id', businessId)

    // Save VOC to voice_of_customer table if reviews found
    if (call2Result && (call2Result as Record<string, unknown>).reviewsFound) {
      const voc = call2Result as Record<string, unknown>
      const phrases = voc.extractedPhrases as string[] | undefined
      if (phrases && phrases.length > 0) {
        await adminClient.from('voice_of_customer').insert({
          business_id: businessId,
          source: 'google_reviews',
          source_url: gmbUrl || websiteUrl,
          raw_text: JSON.stringify(call2Result),
          extracted_phrases: voc.extractedPhrases || null,
          outcome_language: voc.outcomeLanguage || null,
          emotional_language: voc.emotionalLanguage || null,
          problem_language: voc.problemLanguage || null,
          top_phrases: voc.topPhrases || null,
        }) // Non-fatal — errors ignored
      }
    }
  } else if (customerId) {
    // Legacy: save to customers table
    await adminClient.from('customers').update({
      business_research: enhancedResearch,
    }).eq('id', customerId)
  }

  logger.apiEnd('/api/research', start, 200)
  return apiSuccess({ research: enhancedResearch })
}
