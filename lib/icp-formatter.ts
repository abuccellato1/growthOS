export function buildICPMarkdown(data: Record<string, unknown>): string {
  const icp = data.icp_core as Record<string, unknown> | null
  const segments = data.segment_data as Record<string, unknown> | null
  if (!icp) return 'ICP data could not be parsed.'

  const lines: string[] = []

  lines.push('# SignalMap™ — Ideal Customer Profile')
  lines.push(`## ${(data as Record<string, unknown> & { business_name?: string }).business_name || 'Your Business'}`)
  lines.push('*Powered by SignalShot™*')
  lines.push('')
  lines.push('---')
  lines.push('')

  if (icp.one_sentence_icp) {
    lines.push('## The One-Sentence ICP')
    lines.push(`> ${icp.one_sentence_icp}`)
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  lines.push('## How To Position Your Business')
  if (icp.archetype_name) lines.push(`**The Archetype:** ${icp.archetype_name}`)
  if (icp.archetype_description) lines.push('')
  if (icp.archetype_description) lines.push(String(icp.archetype_description))
  if (icp.b2b_or_b2c) lines.push(`**B2B or B2C:** ${icp.b2b_or_b2c}`)
  if (icp.company_profile) lines.push(`**Company Profile:** ${icp.company_profile}`)
  if (icp.buyer_role) lines.push(`**Buyer Role:** ${icp.buyer_role}`)
  if (icp.decision_authority) lines.push(`**Decision Authority:** ${icp.decision_authority}`)
  if (icp.budget_reality) lines.push(`**Budget Reality:** ${icp.budget_reality}`)
  // GMB data from business research
  const bizResearch = data.business_research as Record<string, unknown> | null
  const gmbData = bizResearch?.gmbData as Record<string, string> | null
  if (gmbData) {
    const parts: string[] = []
    if (gmbData.reviewCount) parts.push(`${gmbData.reviewCount} reviews`)
    if (gmbData.averageRating) parts.push(`${gmbData.averageRating} avg rating`)
    if (gmbData.serviceArea) parts.push(`serving ${gmbData.serviceArea}`)
    if (parts.length > 0) lines.push(`**Local Presence:** ${parts.join(', ')}`)
  }
  lines.push('')
  lines.push('---')
  lines.push('')

  lines.push('## The Trigger Event')
  if (icp.trigger_event) {
    lines.push('**What had to happen before they\'d ever buy:**')
    lines.push(String(icp.trigger_event))
  }
  if (icp.already_tried) {
    lines.push('')
    lines.push('**What they\'d already tried:**')
    lines.push(String(icp.already_tried))
  }
  if (icp.why_now) {
    lines.push('')
    lines.push('**Why NOW instead of later:**')
    lines.push(String(icp.why_now))
  }
  lines.push('')
  lines.push('---')
  lines.push('')

  lines.push('## The 3-Level Problem Stack')
  if (icp.external_problem) {
    lines.push('**External Problem** *(what they say out loud)*:')
    lines.push(String(icp.external_problem))
  }
  if (icp.internal_problem) {
    lines.push('')
    lines.push('**Internal Problem** *(how it makes them feel)*:')
    lines.push(String(icp.internal_problem))
  }
  if (icp.philosophical_problem) {
    lines.push('')
    lines.push('**Philosophical Problem** *(why it feels wrong)*:')
    lines.push(String(icp.philosophical_problem))
  }
  lines.push('')
  lines.push('---')
  lines.push('')

  lines.push('## Psychology & Emotional Drivers')
  if (icp.primary_fear) lines.push(`**Primary Fear:** ${icp.primary_fear}`)
  if (icp.core_frustration) lines.push(`**Core Frustration:** ${icp.core_frustration}`)
  if (icp.deepest_aspiration) lines.push(`**Deepest Aspiration:** ${icp.deepest_aspiration}`)
  if (icp.identity_driver) lines.push(`**Identity Driver:** ${icp.identity_driver}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  lines.push('## The Dream Outcome')
  if (icp.dream_outcome_12months) {
    lines.push('**In 12 months if everything works:**')
    lines.push(String(icp.dream_outcome_12months))
  }
  if (icp.success_metrics) {
    lines.push('')
    lines.push('**How they\'ll measure success:**')
    lines.push(String(icp.success_metrics))
  }
  lines.push('')
  lines.push('---')
  lines.push('')

  lines.push('## How They Buy')
  if (icp.decision_process) {
    lines.push('**The Decision Process:**')
    lines.push(String(icp.decision_process))
  }
  if (icp.trust_signals) {
    lines.push('')
    lines.push('**What Makes Them Feel Safe Enough to Buy:**')
    lines.push(String(icp.trust_signals))
  }
  const objections = icp.top_objections as string[] | null
  if (objections && objections.length > 0) {
    lines.push('')
    lines.push('**Top Objections to Address:**')
    objections.forEach((obj, i) => lines.push(`${i + 1}. ${obj}`))
  }
  if (icp.where_they_show_up) {
    lines.push('')
    lines.push('**Where They Show Up:**')
    lines.push(String(icp.where_they_show_up))
  }
  lines.push('')
  lines.push('---')
  lines.push('')

  lines.push('## The Transformation Story')
  if (icp.transformation_story_before) {
    lines.push('**Before:**')
    lines.push(String(icp.transformation_story_before))
  }
  if (icp.transformation_story_after) {
    lines.push('')
    lines.push('**After:**')
    lines.push(String(icp.transformation_story_after))
  }
  if (icp.transformation_bridge) {
    lines.push('')
    lines.push('**The Bridge:**')
    lines.push(String(icp.transformation_bridge))
  }
  lines.push('')
  lines.push('---')
  lines.push('')

  // Segment breakdown — only if multiple segments exist
  const segData = segments as Record<string, unknown> | null
  const segs = segData?.segments as unknown[] | null
  if (segData?.has_multiple_segments && segs && segs.length > 0) {
    lines.push('## Segment Breakdown')
    segs.forEach((seg: unknown) => {
      const s = seg as Record<string, unknown>
      lines.push(`### ${s.label || 'Segment'}`)
      if (s.who_they_are) lines.push(`**Who they are:** ${s.who_they_are}`)
      if (s.trigger) lines.push(`**Trigger:** ${s.trigger}`)
      if (s.messaging_angle) lines.push(`**Messaging angle:** ${s.messaging_angle}`)
      if (s.proof_assets) lines.push(`**Proof assets:** ${s.proof_assets}`)
      if (s.job_titles) lines.push(`**Job titles to target:** ${s.job_titles}`)
      if (s.budget_range) lines.push(`**Budget range:** ${s.budget_range}`)
      lines.push('')
    })
    lines.push('---')
    lines.push('')
  }

  // Positioning Toolkit sections
  if (data.shareability) {
    const share = data.shareability as Record<string, unknown>
    if (share.sales_team_brief) {
      lines.push('## Sales Team Brief')
      lines.push('*Share this with anyone who sells for your business.*')
      lines.push('')
      lines.push(String(share.sales_team_brief))
      lines.push('')
      lines.push('---')
      lines.push('')
    }
  }

  if (data.proof_assets) {
    const pa = data.proof_assets as Record<string, unknown>
    lines.push('## Proof Assets')
    lines.push('*The evidence that makes your customer feel safe enough to buy.*')
    lines.push('')
    if (pa.result_metrics && Array.isArray(pa.result_metrics) && pa.result_metrics.length > 0) {
      lines.push('**Results to highlight:**')
      ;(pa.result_metrics as string[]).forEach(m => lines.push(`- ${m}`))
      lines.push('')
    }
    if (pa.testimonial_themes && Array.isArray(pa.testimonial_themes) && pa.testimonial_themes.length > 0) {
      lines.push('**What customers consistently praise:**')
      ;(pa.testimonial_themes as string[]).forEach(t => lines.push(`- ${t}`))
      lines.push('')
    }
    lines.push('---')
    lines.push('')
  }

  if (data.voice_of_customer_signals) {
    const voc = data.voice_of_customer_signals as Record<string, unknown>
    const phrases = voc.exact_phrases as string[] | null
    if (phrases && phrases.length > 0) {
      lines.push('## Voice of Customer')
      lines.push('*Exact language from real customers — use this in your copy.*')
      lines.push('')
      phrases.forEach(p => lines.push(`> "${p}"`))
      lines.push('')
      lines.push('---')
      lines.push('')
    }
  }

  lines.push('*Powered by SignalShot™*')
  lines.push('*[ICP_COMPLETE]*')

  return lines.join('\n')
}
