import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  let body: {
    businessId: string
    outputId: string
    pillarNames: string[]
    platforms: string[]
    postingFrequency: string
    contentGoal: string
    tone: string
    businessName: string
    primaryService: string
  }
  try { body = await request.json() } catch { return apiError('Invalid body', 400, 'INVALID_BODY') }

  const { businessId, outputId, pillarNames, platforms, postingFrequency, contentGoal, tone, businessName, primaryService } = body
  if (!businessId || !outputId || !pillarNames?.length) {
    return apiError('Missing required fields', 400, 'VALIDATION_ERROR')
  }

  const adminClient = createAdminClient()

  const { data: biz } = await adminClient.from('businesses').select('customer_id').eq('id', businessId).single()
  if (!biz) return apiError('Business not found', 404, 'NOT_FOUND')
  const { data: cust } = await adminClient.from('customers').select('id').eq('id', biz.customer_id).eq('auth_user_id', auth.user.id).single()
  if (!cust) return apiError('Access denied', 403, 'FORBIDDEN')

  const bonusRes = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2500,
    system: `You are a social media content strategist for service businesses. Generate bonus content formats and a content calendar. Be specific and actionable — every script and framework should be ready to execute with minimal editing.

For reelScripts: write actual word-for-word scripts the business owner can read on camera. Keep total reel under 60 seconds.
For carouselFrameworks: each slide needs a clear headline and 1-2 sentences of body text. 6-8 slides per carousel.
For storySequences: 4-5 frames per sequence. Each frame is one screen — keep text under 10 words.
For contentCalendar: distribute pillars evenly across 4 weeks. Match posting frequency. Only include platforms from the list.

Return ONLY valid JSON. No markdown. No preamble.`,
    messages: [{
      role: 'user',
      content: `Generate bonus content formats and a 4-week calendar for ${businessName} (${primaryService}).

Content pillars already generated: ${pillarNames.map((n, i) => `Pillar ${i + 1}: ${n}`).join(', ')}
Platforms: ${platforms.join(', ')}
Posting frequency: ${postingFrequency}
Content goal: ${contentGoal}
Tone: ${tone}

Generate:
- 4-week content calendar distributing all 5 pillars across ${postingFrequency} posts
- 3 reel scripts (one per top 3 pillars)
- 3 carousel frameworks (one per top 3 pillars)
- 2 story sequences (for top 2 pillars)

Return this exact JSON:
{"contentCalendar":{"week1":[{"day":"Mon","platform":"","pillar":"","postType":""}],"week2":[],"week3":[],"week4":[]},"reelScripts":[{"pillar":"","totalDuration":"","hook":"","segments":[{"timeCode":"0-3s","script":"","visualNote":""}],"cta":"","captionSuggestion":""}],"carouselFrameworks":[{"pillar":"","slideCount":0,"coverSlide":{"headline":"","subtext":""},"slides":[{"slideNumber":1,"headline":"","bodyText":"","visualNote":""}],"closingSlide":{"cta":"","text":""}}],"storySequences":[{"pillar":"","frameCount":0,"frames":[{"frameNumber":1,"text":"","visualNote":"","stickerSuggestion":""}]}]}`
    }],
  })

  const textBlocks = bonusRes.content.filter(b => b.type === 'text')
  const lastBlock = textBlocks[textBlocks.length - 1]
  if (!lastBlock || lastBlock.type !== 'text') return apiError('No response from bonus generation', 500, 'GENERATION_FAILED')

  let parsedBonus: Record<string, unknown>
  try {
    const jsonMatch = lastBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return apiError('No JSON in bonus response', 500, 'PARSE_FAILED')
    parsedBonus = JSON.parse(jsonMatch[0])
  } catch { return apiError('Failed to parse bonus JSON', 500, 'PARSE_FAILED') }

  // Merge bonus content into the existing module_output
  const { data: existing } = await adminClient
    .from('module_outputs')
    .select('output_data')
    .eq('id', outputId)
    .single()

  if (existing?.output_data) {
    await adminClient
      .from('module_outputs')
      .update({
        output_data: { ...(existing.output_data as Record<string, unknown>), ...parsedBonus }
      })
      .eq('id', outputId)
  }

  return apiSuccess({ bonus: parsedBonus })
}
