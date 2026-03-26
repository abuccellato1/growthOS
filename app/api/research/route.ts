/*
  Run in Supabase before deploying:
  ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS last_research_at timestamptz;

  ALTER TABLE public.voice_of_customer
  ADD COLUMN IF NOT EXISTS raw_reviews jsonb;
*/

import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { apiError, apiSuccess } from '@/lib/api-response'
import { calculateAndSaveScore } from '@/lib/signal-score'

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
  placeId?: string
}

async function getPlaceReviews(
  businessName: string,
  city: string,
  gmbUrl?: string,
  placeId?: string
): Promise<{
  reviews: Array<{ text: string; rating: number; authorName: string }>
  resolvedPlaceId: string | null
  rating: number | null
  totalRatings: number | null
}> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return { reviews: [], resolvedPlaceId: null, rating: null, totalRatings: null }
  }

  try {
    let resolvedPlaceId = placeId || null

    // Step 1: If no place_id, find it via text search
    if (!resolvedPlaceId) {
      const searchQuery = `${businessName} ${city}`.trim()
      const searchRes = await fetch(
        'https://places.googleapis.com/v1/places:searchText',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount',
          },
          body: JSON.stringify({ textQuery: searchQuery, maxResultCount: 1 }),
          signal: AbortSignal.timeout(8000),
        }
      )
      if (searchRes.ok) {
        const searchData = await searchRes.json()
        resolvedPlaceId = searchData.places?.[0]?.id || null
      }
    }

    if (!resolvedPlaceId) {
      return { reviews: [], resolvedPlaceId: null, rating: null, totalRatings: null }
    }

    // Step 2: Get place details including reviews
    const detailsRes = await fetch(
      `https://places.googleapis.com/v1/places/${resolvedPlaceId}`,
      {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'id,displayName,rating,userRatingCount,reviews',
        },
        signal: AbortSignal.timeout(8000),
      }
    )

    if (!detailsRes.ok) {
      return { reviews: [], resolvedPlaceId, rating: null, totalRatings: null }
    }

    const detailsData = await detailsRes.json()
    const reviews = (detailsData.reviews || [])
      .map((r: {
        text?: { text?: string }
        rating?: number
        authorAttribution?: { displayName?: string }
      }) => ({
        text: r.text?.text || '',
        rating: r.rating || 0,
        authorName: r.authorAttribution?.displayName || 'Anonymous',
      }))
      .filter((r: { text: string }) => r.text.length > 10)

    return {
      reviews,
      resolvedPlaceId,
      rating: detailsData.rating || null,
      totalRatings: detailsData.userRatingCount || null,
    }
  } catch (err) {
    console.error('Places API error:', String(err))
    return { reviews: [], resolvedPlaceId: null, rating: null, totalRatings: null }
  }
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

  const { businessId, customerId, businessName, websiteUrl, primaryService, geographicMarket, gmbUrl, placeId } = body

  if (!businessName || !websiteUrl || !primaryService) {
    logger.apiEnd('/api/research', start, 400)
    return apiError('Missing required fields', 400, 'MISSING_FIELDS')
  }

  const adminClient = createAdminClient()

  // Set research_status to running
  if (businessId) {
    const statusUpdate: Record<string, unknown> = { research_status: 'running' }
    if (placeId) statusUpdate.place_id = placeId
    await adminClient.from('businesses').update(statusUpdate).eq('id', businessId)
  }

  // Extract city from geographicMarket
  const cityForSearch = geographicMarket.replace(/metro\s+/i, '').split(',')[0].trim()

  // Get real review text from Places API
  const placesData = await getPlaceReviews(businessName, cityForSearch, gmbUrl, placeId)

  // If Places returned a place_id, save it
  if (placesData.resolvedPlaceId && businessId && !placeId) {
    await adminClient.from('businesses').update({ place_id: placesData.resolvedPlaceId }).eq('id', businessId)
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
  "testimonialQuotes": [],
  "caseStudyHighlights": [],
  "pressOrMediaMentions": [],
  "awardsOrRecognition": [],
  "beforeAfterStories": [],
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
        content: `Research this business thoroughly:\nBusiness Name: ${businessName}\nWebsite: ${websiteUrl}\nPrimary Service: ${primaryService}\nGeographic Market: ${geographicMarket}${gmbUrl ? `\nGoogle Business Profile: ${gmbUrl}` : ''}\n\nSEARCH INSTRUCTIONS:\n1. Visit their website and look specifically for:\n   - Testimonials or reviews page\n   - Case studies or success stories\n   - About page (often has founding story)\n   - Any quoted customer language\n   - Before/after or results sections\n   - Press or media mentions\n   - Awards or certifications page\n2. Search Google for: "${businessName}" reviews testimonials\n3. Search for: "${businessName}" site:${websiteUrl.replace(/https?:\/\//, '').replace(/\/$/, '')} testimonials OR "case study"\n4. Check their Google Business Profile if provided\n\nExtract every detail available including verbatim customer quotes where found.`,
      }],
    })

    // CALL 2 — Review and voice of customer extraction
    const reviewText = placesData.reviews.length > 0
      ? `Here are real customer reviews from Google:\n\n${placesData.reviews.map((r, i) => `Review ${i + 1} (${r.rating}★ — ${r.authorName}):\n"${r.text}"`).join('\n\n')}\n\nAlso search for any additional reviews online.`
      : `Search for customer reviews of: ${businessName} ${cityForSearch}`

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
            content: reviewText,
          }],
        })
      : Promise.resolve(null)

    const [res1, res2] = await Promise.all([call1Promise, call2Promise])

    // Parse call 1 — use last text block (first is often preamble)
    const textBlocks1 = res1?.content?.filter((b: { type: string }) => b.type === 'text')
    const textBlock1 = textBlocks1?.[textBlocks1.length - 1]
    if (textBlock1 && textBlock1.type === 'text') {
      const raw = (textBlock1 as { type: 'text'; text: string }).text.trim()
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        call1Result = JSON.parse(jsonMatch[0])
      }
    }

    // Parse call 2 — use last text block
    if (res2) {
      const textBlocks2 = res2.content?.filter((b: { type: string }) => b.type === 'text')
      const textBlock2 = textBlocks2?.[textBlocks2.length - 1]
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
      await adminClient.from('businesses').update({ research_status: 'failed' }).eq('id', businessId)
    }
    logger.apiEnd('/api/research', start, 200)
    return apiSuccess({ research: null })
  }

  // Merge results with Places data
  const call1Gmb = (call1Result as Record<string, unknown> | null)?.gmbData as Record<string, unknown> | undefined
  const enhancedResearch = {
    ...(call1Result || {}),
    gmbData: {
      reviewCount: placesData.totalRatings?.toString() || (call1Gmb?.reviewCount as string) || '',
      averageRating: placesData.rating?.toString() || (call1Gmb?.averageRating as string) || '',
      categories: (call1Gmb?.categories as string) || '',
      serviceArea: (call1Gmb?.serviceArea as string) || '',
      placeId: placesData.resolvedPlaceId || '',
      reviewsExtracted: placesData.reviews.length,
    },
    actualReviews: placesData.reviews,
    voiceOfCustomer: call2Result,
  }

  // Save to businesses table
  if (businessId) {
    await adminClient.from('businesses').update({
      business_research: enhancedResearch,
      research_status: 'complete',
      last_research_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', businessId)

    // Recalculate Signal Score with new research data
    calculateAndSaveScore(businessId).catch(err =>
      console.error('Score calc error:', err)
    )

    // Save VOC to voice_of_customer table — runs when Places API returns reviews OR Call 2 extracts phrases
    try {
      const hasRealReviews = placesData.reviews.length > 0
      const hasExtractedPhrases = !!(
        call2Result &&
        (call2Result as Record<string, unknown>).reviewsFound &&
        ((call2Result as Record<string, unknown>).extractedPhrases as string[] | undefined)?.length
      )

      if (hasRealReviews || hasExtractedPhrases) {
        const voc = (call2Result || {}) as Record<string, unknown>

        const rawReviewText = placesData.reviews.length > 0
          ? placesData.reviews.map((r, i) => `Review ${i + 1} — ${r.authorName} (${r.rating}★):\n"${r.text}"`).join('\n\n')
          : JSON.stringify(call2Result || {})

        const { data: existingVoc } = await adminClient
          .from('voice_of_customer')
          .select('id')
          .eq('business_id', businessId)
          .eq('source', 'google_places_api')
          .maybeSingle()

        const vocPayload = {
          business_id: businessId,
          source: 'google_places_api',
          source_url: gmbUrl || websiteUrl,
          raw_text: rawReviewText,
          raw_reviews: placesData.reviews.length > 0 ? placesData.reviews : null,
          extracted_phrases: (voc.extractedPhrases as string[]) || null,
          outcome_language: (voc.outcomeLanguage as string[]) || null,
          emotional_language: (voc.emotionalLanguage as string[]) || null,
          problem_language: (voc.problemLanguage as string[]) || null,
          top_phrases: (voc.topPhrases as string[]) || null,
          updated_at: new Date().toISOString(),
        }

        if (existingVoc) {
          await adminClient.from('voice_of_customer').update(vocPayload).eq('id', existingVoc.id)
        } else {
          await adminClient.from('voice_of_customer').insert(vocPayload)
        }

        logger.info('VOC saved', {
          route: '/api/research',
          businessId: businessId.slice(0, 8),
          reviewCount: placesData.reviews.length,
          hasExtractedPhrases,
        })
      }
    } catch (vocErr) {
      logger.warn('VOC save failed (non-fatal)', { route: '/api/research', error: String(vocErr) })
    }
  } else if (customerId) {
    await adminClient.from('customers').update({
      business_research: enhancedResearch,
    }).eq('id', customerId)
  }

  logger.apiEnd('/api/research', start, 200)
  return apiSuccess({ research: enhancedResearch })
}
