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

interface BusinessResearch {
  whatTheyDo: string
  yearsInBusiness: string
  primaryProduct: string
  apparentTargetCustomer: string
  differentiators: string
  websiteFound: boolean
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

  // If businessId provided, save to businesses table
  if (businessId) {
    const bizUpdate: Record<string, unknown> = {
      business_name: businessName,
      website_url: websiteUrl,
      primary_service: primaryService,
      geographic_market: geographicMarket,
      updated_at: new Date().toISOString(),
    }
    if (gmbUrl !== undefined) bizUpdate.gmb_url = gmbUrl || null
    await adminClient
      .from('businesses')
      .update(bizUpdate)
      .eq('id', businessId)
  } else if (customerId) {
    // Legacy: save to customers table
    await adminClient
      .from('customers')
      .update({
        business_name: businessName,
        website_url: websiteUrl,
        primary_service: primaryService,
        geographic_market: geographicMarket,
      })
      .eq('id', customerId)
  }

  // Run web research — non-fatal
  let research: BusinessResearch | null = null
  try {
    const researchResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }] as Parameters<typeof anthropic.messages.create>[0]['tools'],
      system:
        `You are doing pre-session research on a business. Search for the business and visit their website if available. Extract only verifiable facts. Return ONLY valid JSON with no markdown, no preamble: {"whatTheyDo":"one sentence description","yearsInBusiness":"number or empty string","primaryProduct":"main product or service","apparentTargetCustomer":"who the website targets","differentiators":"notable claims or unique aspects","websiteFound":true or false${gmbUrl ? ',"gmbData":{"reviewCount":"number or empty string","averageRating":"number or empty string","categories":"comma separated or empty string","serviceArea":"description or empty string"}' : ''}}. ${gmbUrl ? 'If a Google My Business URL is provided, use web_search to look it up and extract: review count, average rating, business categories, and service area. Include these in gmbData.' : ''} Never invent information. Use empty string for unknown fields.`,
      messages: [
        {
          role: 'user',
          content: `Research before a discovery session:\nBusiness: ${businessName}\nWebsite: ${websiteUrl}\nService: ${primaryService}\nMarket: ${geographicMarket}${gmbUrl ? `\nGoogle My Business: ${gmbUrl}` : ''}`,
        },
      ],
    })

    const textBlock = researchResponse?.content?.find((b: { type: string }) => b.type === 'text')
    if (textBlock && textBlock.type === 'text') {
      const raw = (textBlock as { type: 'text'; text: string }).text.trim()
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        research = JSON.parse(jsonMatch[0])
      }
    }
  } catch (err) {
    logger.warn('Business research failed — continuing without', { route: '/api/research', businessId: businessId })
  }

  // Save research result
  if (research) {
    if (businessId) {
      await adminClient
        .from('businesses')
        .update({ business_research: research, updated_at: new Date().toISOString() })
        .eq('id', businessId)
    } else if (customerId) {
      await adminClient
        .from('customers')
        .update({ business_research: research })
        .eq('id', customerId)
    }
  }

  logger.apiEnd('/api/research', start, 200)
  return apiSuccess({ research })
}
