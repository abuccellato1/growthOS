/*
=== RUN IN SUPABASE SQL EDITOR BEFORE DEPLOYING ===

-- Module outputs table (replaces all per-module tables)
-- Every module (SignalAds, SignalContent, etc.) writes here
CREATE TABLE IF NOT EXISTS public.module_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id)
    ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions(id)
    ON DELETE SET NULL,
  module_type text NOT NULL,
  generation_number integer DEFAULT 1,
  input_snapshot jsonb,
  output_data jsonb,
  feedback_rating integer,
  feedback_text text,
  feedback_used boolean DEFAULT false,
  status text DEFAULT 'complete',
  regenerations_used integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.module_outputs
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "module_outputs_own_data"
  ON public.module_outputs FOR ALL
  USING (
    business_id IN (
      SELECT b.id FROM public.businesses b
      JOIN public.customers c ON c.id = b.customer_id
      WHERE c.auth_user_id = auth.uid()
    )
  );

-- Jobs table (orchestration layer for agent swarm)
CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id)
    ON DELETE CASCADE,
  job_type text NOT NULL,
  status text DEFAULT 'pending',
  priority integer DEFAULT 5,
  input_data jsonb,
  output_data jsonb,
  error_message text,
  retry_count integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs_own_data"
  ON public.jobs FOR ALL
  USING (
    business_id IN (
      SELECT b.id FROM public.businesses b
      JOIN public.customers c ON c.id = b.customer_id
      WHERE c.auth_user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS module_outputs_business_idx
  ON public.module_outputs (business_id, module_type);

CREATE INDEX IF NOT EXISTS module_outputs_type_idx
  ON public.module_outputs (module_type, created_at DESC);

CREATE INDEX IF NOT EXISTS jobs_business_status_idx
  ON public.jobs (business_id, status);

CREATE INDEX IF NOT EXISTS jobs_status_priority_idx
  ON public.jobs (status, priority DESC, created_at ASC);

=== END SQL ===
*/

import { createAdminClient } from '@/lib/supabase/admin'
import {
  Business,
  Session,
  SignalScore,
  ModuleOutput,
  Feedback,
  AgentContext,
} from '@/types'

export async function buildAgentContext(
  businessId: string
): Promise<AgentContext | null> {
  try {
    const adminClient = createAdminClient()

    const [
      businessResult,
      sessionResult,
      vocResult,
      scoreResult,
      outputsResult,
      feedbackResult,
    ] = await Promise.all([
      adminClient.from('businesses').select('*').eq('id', businessId).single(),

      adminClient.from('sessions').select('*')
        .eq('business_id', businessId)
        .eq('status', 'completed')
        .not('archived', 'is', true)
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle(),

      adminClient.from('voice_of_customer').select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false }),

      adminClient.from('signal_scores').select('*')
        .eq('business_id', businessId)
        .order('calculated_at', { ascending: false })
        .limit(1).maybeSingle(),

      adminClient.from('module_outputs').select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false }),

      adminClient.from('feedback').select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    const business = businessResult.data as Business | null
    if (!business) return null

    const session = sessionResult.data as Session | null
    const vocEntries = vocResult.data || []
    const signalScore = scoreResult.data as SignalScore | null
    const moduleOutputs = (outputsResult.data || []) as ModuleOutput[]
    const feedbackHistory = (feedbackResult.data || []) as Feedback[]

    // Build VOC summary
    const allPhrases = vocEntries.flatMap(v => (v.extracted_phrases as string[] | null) || [])
    const topPhrases = vocEntries
      .flatMap(v => (v.top_phrases as string[] | null) || [])
      .filter((p, i, arr) => arr.indexOf(p) === i)
      .slice(0, 15)
    const outcomeLanguage = vocEntries
      .flatMap(v => (v.outcome_language as string[] | null) || [])
      .filter((p, i, arr) => arr.indexOf(p) === i)
      .slice(0, 10)
    const emotionalLanguage = vocEntries
      .flatMap(v => (v.emotional_language as string[] | null) || [])
      .filter((p, i, arr) => arr.indexOf(p) === i)
      .slice(0, 10)
    const problemLanguage = vocEntries
      .flatMap(v => (v.problem_language as string[] | null) || [])
      .filter((p, i, arr) => arr.indexOf(p) === i)
      .slice(0, 10)

    const reviewHighlights: string[] = []
    const rawReviews: Array<{ text: string; rating: number; authorName: string }> = []

    for (const entry of vocEntries) {
      const reviews = entry.raw_reviews as Array<{ text: string; rating: number; authorName: string }> | null
      if (reviews) {
        rawReviews.push(...reviews)
        const best = [...reviews].sort((a, b) => b.text.length - a.text.length)[0]
        if (best && reviewHighlights.length < 3) {
          reviewHighlights.push(
            `"${best.text.slice(0, 200)}${best.text.length > 200 ? '...' : ''}" — ${best.authorName}`
          )
        }
      }
    }

    // Compute readiness flags
    const moduleTypeExists = (type: string) => moduleOutputs.some(o => o.module_type === type)

    const readiness = {
      hasInterview: !!session,
      hasResearch: !!business.business_research,
      hasPlaceId: !!business.place_id,
      hasVocData: vocEntries.length > 0,
      hasSignalScore: !!signalScore,
      hasSignalAds: moduleTypeExists('signal_ads'),
      hasSignalContent: moduleTypeExists('signal_content'),
      hasSignalSequences: moduleTypeExists('signal_sequences'),
      hasSignalLaunch: moduleTypeExists('signal_launch'),
      hasSignalSprint: moduleTypeExists('signal_sprint'),
    }

    return {
      business,
      session,
      icpCore: session?.icp_core || null,
      messagingData: session?.messaging_data || null,
      competitiveData: session?.competitive_data || null,
      contentData: session?.content_data || null,
      gtmData: session?.gtm_data || null,
      targetingData: session?.targeting_data || null,
      proofAssets: session?.proof_assets || null,
      antiIcpSignals: session?.anti_icp_signals || null,
      voiceOfCustomerSignals: session?.voice_of_customer_signals || null,
      shareability: session?.shareability || null,
      vocSummary: vocEntries.length > 0 ? {
        totalEntries: vocEntries.length,
        totalPhrases: allPhrases.length,
        topPhrases,
        outcomeLanguage,
        emotionalLanguage,
        problemLanguage,
        reviewHighlights,
        rawReviews: rawReviews.slice(0, 20),
      } : null,
      signalScore,
      moduleOutputs,
      feedbackHistory,
      researchComplete: business.research_status === 'complete',
      placeId: business.place_id || null,
      lastResearchAt: business.last_research_at || null,
      readiness,
    }
  } catch (err) {
    console.error('buildAgentContext error:', String(err))
    return null
  }
}

// Lightweight version — just the business and readiness
export async function buildLightContext(
  businessId: string
): Promise<Pick<AgentContext, 'business' | 'readiness' | 'signalScore'> | null> {
  try {
    const adminClient = createAdminClient()

    const [businessResult, sessionResult, vocResult, scoreResult, outputsResult] = await Promise.all([
      adminClient.from('businesses').select('*').eq('id', businessId).single(),
      adminClient.from('sessions').select('id, status')
        .eq('business_id', businessId).eq('status', 'completed')
        .not('archived', 'is', true).limit(1).maybeSingle(),
      adminClient.from('voice_of_customer').select('id')
        .eq('business_id', businessId).limit(1).maybeSingle(),
      adminClient.from('signal_scores').select('*')
        .eq('business_id', businessId)
        .order('calculated_at', { ascending: false })
        .limit(1).maybeSingle(),
      adminClient.from('module_outputs').select('module_type')
        .eq('business_id', businessId),
    ])

    const business = businessResult.data as Business | null
    if (!business) return null

    const moduleOutputs = outputsResult.data || []
    const moduleTypeExists = (type: string) =>
      moduleOutputs.some((o: { module_type: string }) => o.module_type === type)

    return {
      business,
      signalScore: scoreResult.data as SignalScore | null,
      readiness: {
        hasInterview: !!sessionResult.data,
        hasResearch: !!business.business_research,
        hasPlaceId: !!business.place_id,
        hasVocData: !!vocResult.data,
        hasSignalScore: !!scoreResult.data,
        hasSignalAds: moduleTypeExists('signal_ads'),
        hasSignalContent: moduleTypeExists('signal_content'),
        hasSignalSequences: moduleTypeExists('signal_sequences'),
        hasSignalLaunch: moduleTypeExists('signal_launch'),
        hasSignalSprint: moduleTypeExists('signal_sprint'),
      },
    }
  } catch (err) {
    console.error('buildLightContext error:', String(err))
    return null
  }
}
