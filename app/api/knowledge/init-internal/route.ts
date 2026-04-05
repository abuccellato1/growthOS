import { apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateKB } from '@/lib/knowledge-base'

export async function POST(request: Request) {
  const authHeader = request.headers.get('x-internal-secret')
  if (authHeader !== process.env.INTERNAL_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: { businessId: string }
  try { body = await request.json() } catch {
    return new Response('Invalid body', { status: 400 })
  }

  const { businessId } = body
  if (!businessId) return new Response('Missing businessId', { status: 400 })

  const adminClient = createAdminClient()

  const { data: biz } = await adminClient
    .from('businesses')
    .select('business_research, agent_preferences, style_memory')
    .eq('id', businessId)
    .single()

  if (!biz) return new Response('Not found', { status: 404 })

  // Create the KB row so enrichment triggers can write to it
  const { data: existing } = await adminClient
    .from('knowledge_base')
    .select('id')
    .eq('business_id', businessId)
    .maybeSingle()

  if (!existing) {
    await adminClient.from('knowledge_base').insert({
      business_id: businessId,
      initialized: false,
    })
  }

  // If business has research data, populate identity
  const research = biz.business_research as Record<string, unknown> | null
  if (research) {
    await updateKB(businessId, 'identity', {
      positioningStatement: research.whatTheyDo || '',
      differentiator: research.differentiators || '',
    }, false).catch(() => null)
  }

  return apiSuccess({ created: true })
}
