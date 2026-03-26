import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAdmin } from '@/lib/auth-guard'
import { apiError, apiSuccess } from '@/lib/api-response'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateAndSaveScore } from '@/lib/signal-score'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const { sessionId } = await request.json()

  if (!sessionId) {
    return apiError('sessionId required', 400, 'MISSING_PARAM')
  }

  const adminClient = createAdminClient()

  const { data: session } = await adminClient
    .from('sessions')
    .select('id, icp_html, business_id, status')
    .eq('id', sessionId)
    .single()

  if (!session) {
    return apiError('Session not found', 404, 'NOT_FOUND')
  }

  if (!session.icp_html) {
    return apiError('Session has no ICP content to extract from', 400, 'NO_CONTENT')
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    system: `You are extracting structured marketing intelligence from an existing ICP document. Read the document carefully and extract ALL available information into the specified JSON structure.

CRITICAL: Return ONLY valid JSON. No markdown. No preamble. No explanation. Just the JSON object.

Extract this exact structure from the document:
{
  "icp_core": {
    "one_sentence_icp": "",
    "business_snapshot": "",
    "archetype_name": "",
    "archetype_description": "",
    "b2b_or_b2c": "",
    "company_profile": "",
    "buyer_role": "",
    "decision_authority": "",
    "budget_reality": "",
    "trigger_event": "",
    "already_tried": "",
    "why_now": "",
    "external_problem": "",
    "internal_problem": "",
    "philosophical_problem": "",
    "primary_fear": "",
    "core_frustration": "",
    "deepest_aspiration": "",
    "identity_driver": "",
    "dream_outcome_12months": "",
    "success_metrics": "",
    "transformation_story_before": "",
    "transformation_story_after": "",
    "transformation_bridge": "",
    "decision_process": "",
    "trust_signals": "",
    "top_objections": [],
    "where_they_show_up": ""
  },
  "segment_data": {
    "has_multiple_segments": false,
    "segments": []
  },
  "messaging_data": {
    "language_that_resonates": [],
    "language_to_avoid": [],
    "core_positioning_statement": "",
    "trust_statement": "",
    "differentiator_statement": "",
    "proof_type_needed": "",
    "ad_angles": {
      "problem_led": "",
      "outcome_led": "",
      "differentiator_led": ""
    },
    "homepage_headline": ""
  },
  "competitive_data": {
    "direct_competitors": [],
    "market_scope": "",
    "positioning_edge": "",
    "anti_icp": ""
  },
  "targeting_data": {
    "job_titles": [],
    "industries": [],
    "company_sizes": [],
    "income_ranges": [],
    "age_ranges": [],
    "interests": [],
    "linkedin_groups": [],
    "geographic_targets": []
  },
  "proof_assets": {
    "testimonial_themes": [],
    "result_metrics": [],
    "case_study_angles": [],
    "credential_signals": [],
    "social_proof_types": []
  },
  "anti_icp_signals": {
    "who_to_exclude": "",
    "wrong_searches": [],
    "wrong_messaging": [],
    "disqualifiers": [],
    "negative_keywords": []
  },
  "content_data": {
    "awareness_searches": [],
    "problem_clusters": [],
    "consideration_questions": [],
    "content_topics": [],
    "seo_keyword_clusters": [],
    "buyer_path": ""
  },
  "gtm_data": {
    "priority_channels": [],
    "funnel_strategy": "",
    "offer_positioning": "",
    "seasonal_timing": "",
    "referral_mechanics": "",
    "referral_ask_script": "",
    "client_journey_stages": [],
    "action_items": [],
    "budget_by_segment": ""
  },
  "voice_of_customer_signals": {
    "exact_phrases": [],
    "problem_descriptions": [],
    "outcome_descriptions": [],
    "emotional_language": [],
    "repeated_themes": []
  },
  "signal_score_inputs": {
    "icp_confidence": 0,
    "messaging_clarity": 0,
    "competitive_position": 0,
    "content_coverage": 0,
    "data_completeness": 0,
    "score_rationale": ""
  },
  "shareability": {
    "one_page_summary": "",
    "sales_team_brief": "",
    "agency_brief": ""
  }
}

For signal_score_inputs: score each dimension 0-100 based on the depth and specificity of data in the document. Be honest — a rich detailed document scores 70-85. A thin document scores 30-50.

Use ONLY information present in the document. Never invent. If a field has no data write null or [].`,
    messages: [{
      role: 'user',
      content: `Extract structured data from this ICP document:\n\n${session.icp_html}`,
    }],
  })

  const textBlocks = response.content.filter(b => b.type === 'text')
  const lastBlock = textBlocks[textBlocks.length - 1]

  if (!lastBlock || lastBlock.type !== 'text') {
    return apiError('No text response from extraction', 500, 'EXTRACTION_FAILED')
  }

  let extracted: Record<string, unknown>
  try {
    const jsonMatch = lastBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return apiError('No JSON found in response', 500, 'PARSE_FAILED')
    }
    extracted = JSON.parse(jsonMatch[0])
  } catch {
    return apiError('Failed to parse extraction JSON', 500, 'PARSE_FAILED')
  }

  const { error: updateError } = await adminClient
    .from('sessions')
    .update({
      icp_core: extracted.icp_core || null,
      segment_data: extracted.segment_data || null,
      messaging_data: extracted.messaging_data || null,
      competitive_data: extracted.competitive_data || null,
      targeting_data: extracted.targeting_data || null,
      proof_assets: extracted.proof_assets || null,
      anti_icp_signals: extracted.anti_icp_signals || null,
      content_data: extracted.content_data || null,
      gtm_data: extracted.gtm_data || null,
      voice_of_customer_signals: extracted.voice_of_customer_signals || null,
      signal_score_inputs: extracted.signal_score_inputs || null,
      shareability: extracted.shareability || null,
    })
    .eq('id', sessionId)

  if (updateError) {
    return apiError('Failed to save extracted data', 500, 'SAVE_FAILED')
  }

  if (session.business_id) {
    await calculateAndSaveScore(session.business_id).catch(err =>
      console.error('Score recalc error:', err)
    )
  }

  return apiSuccess({
    sessionId,
    columnsPopulated: Object.keys(extracted).filter(k => extracted[k] !== null),
    signalScoreInputs: extracted.signal_score_inputs,
  })
}
