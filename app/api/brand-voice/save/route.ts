import { requireAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateKB } from '@/lib/knowledge-base'

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  let body: {
    businessId: string
    scope: 'global' | 'agent'
    agentKey?: string
    data: Record<string, unknown>
  }
  try { body = await request.json() } catch { return apiError('Invalid body', 400, 'INVALID_BODY') }

  const { businessId, scope, agentKey, data } = body
  if (!businessId || !scope || !data) {
    return apiError('Missing required fields', 400, 'VALIDATION_ERROR')
  }
  if (scope === 'agent' && !agentKey) {
    return apiError('agentKey required for agent scope', 400, 'VALIDATION_ERROR')
  }

  const adminClient = createAdminClient()

  const { data: biz } = await adminClient
    .from('businesses')
    .select('customer_id, agent_preferences')
    .eq('id', businessId)
    .single()
  if (!biz) return apiError('Business not found', 404, 'NOT_FOUND')

  const { data: cust } = await adminClient
    .from('customers')
    .select('id')
    .eq('id', biz.customer_id)
    .eq('auth_user_id', auth.user.id)
    .single()
  if (!cust) return apiError('Access denied', 403, 'FORBIDDEN')

  const existing = (biz.agent_preferences as Record<string, unknown>) || {}

  let updated: Record<string, unknown>

  if (scope === 'global') {
    updated = {
      ...existing,
      global: {
        ...((existing.global as Record<string, unknown>) || {}),
        ...data,
        updatedAt: new Date().toISOString(),
      },
    }
  } else {
    const [moduleType, agentName] = (agentKey as string).split('.')
    updated = {
      ...existing,
      [moduleType]: {
        ...((existing[moduleType] as Record<string, unknown>) || {}),
        [agentName]: {
          ...(((existing[moduleType] as Record<string, unknown>)?.[agentName] as Record<string, unknown>) || {}),
          ...data,
          updatedAt: new Date().toISOString(),
        },
      },
    }
  }

  await adminClient
    .from('businesses')
    .update({ agent_preferences: updated })
    .eq('id', businessId)

  // Update KB identity domain with Brand Voice data — non-blocking
  if (scope === 'global') {
    updateKB(businessId, 'identity', {
      brandVoice: (data.brandVoice as string) || '',
      writingStyle: (data.writingStyle as string[]) || [],
      alwaysInclude: (data.alwaysInclude as string[]) || [],
      neverInclude: (data.neverInclude as string[]) || [],
      customSummary: (data.customSummary as string) || '',
    }, true).catch(() => null)
  }

  return apiSuccess({ saved: true, scope })
}
