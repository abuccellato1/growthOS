import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface ResearchRequest {
  customerId: string
  businessName: string
  websiteUrl: string
  primaryService: string
  geographicMarket: string
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
  let body: ResearchRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { customerId, businessName, websiteUrl, primaryService, geographicMarket } = body

  if (!customerId || !businessName || !websiteUrl || !primaryService) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Save intake fields immediately
  await adminClient
    .from('customers')
    .update({
      business_name: businessName,
      website_url: websiteUrl,
      primary_service: primaryService,
      geographic_market: geographicMarket,
    })
    .eq('id', customerId)

  // Run web research — non-fatal
  let research: BusinessResearch | null = null
  try {
    const researchResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      tools: [{ type: 'web_search_20250305' as any, name: 'web_search' }] as any,
      system:
        'You are doing pre-session research on a business. Search for the business and visit their website if available. Extract only verifiable facts. Return ONLY valid JSON with no markdown, no preamble: {"whatTheyDo":"one sentence description","yearsInBusiness":"number or empty string","primaryProduct":"main product or service","apparentTargetCustomer":"who the website targets","differentiators":"notable claims or unique aspects","websiteFound":true or false}. Never invent information. Use empty string for unknown fields.',
      messages: [
        {
          role: 'user',
          content: `Research before a discovery session:\nBusiness: ${businessName}\nWebsite: ${websiteUrl}\nService: ${primaryService}\nMarket: ${geographicMarket}`,
        },
      ],
    })

    const textBlock = researchResponse?.content?.find((b: any) => b.type === 'text')
    if (textBlock && textBlock.type === 'text') {
      const raw = (textBlock as any).text.trim()
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        research = JSON.parse(jsonMatch[0])
      }
    }
  } catch (err) {
    console.warn('Business research failed — continuing without:', err)
  }

  // Save research result back to customer record
  if (research) {
    await adminClient
      .from('customers')
      .update({ business_research: research })
      .eq('id', customerId)
  }

  return NextResponse.json({ success: true, research })
}
