import { Business } from '@/types'

export interface PreflightResult {
  ready: boolean
  issues: string[]
  warnings: string[]
  hasPlaceId: boolean
  hasResearch: boolean
  hasVoiceOfCustomer: boolean
}

export function checkBusinessReady(
  business: Business | null
): PreflightResult {
  if (!business) {
    return {
      ready: false,
      issues: ['No active business found'],
      warnings: [],
      hasPlaceId: false,
      hasResearch: false,
      hasVoiceOfCustomer: false,
    }
  }

  const issues: string[] = []
  const warnings: string[] = []

  const hasPlaceId = !!business.place_id
  const hasResearch = !!business.business_research
  const hasVoiceOfCustomer = !!(
    business.voice_of_customer &&
    Object.keys(business.voice_of_customer).length > 0
  )

  // BETA MODE: these are warnings not hard blocks
  // After launch, move these to issues array
  if (!hasPlaceId) {
    warnings.push(
      'Business not verified on Google — verify in BusinessSignals for richer ad data and auto-review extraction'
    )
  }

  if (!hasResearch) {
    warnings.push(
      'Business research not completed — run research in BusinessSignals first'
    )
  }

  if (business.research_status === 'running') {
    warnings.push(
      'Business research is still running — data may be incomplete'
    )
  }

  // ready = true in beta even with warnings
  // After launch: ready = issues.length === 0
  const ready = issues.length === 0

  return {
    ready,
    issues,
    warnings,
    hasPlaceId,
    hasResearch,
    hasVoiceOfCustomer,
  }
}

// Helper: returns true if we're in beta mode
// Flip this to false when launching to paying customers
export const BETA_MODE = true
