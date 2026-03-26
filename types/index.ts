export type Phase = 1 | 2 | 3 | 4;

export interface PhaseConfig {
  phase: Phase;
  title: string;
  subtitle: string;
  minMessages: number;
  systemPrompt: string;
}

export interface BusinessResearch {
  whatTheyDo: string;
  yearsInBusiness: string;
  primaryProduct: string;
  apparentTargetCustomer: string;
  differentiators: string;
  websiteFound: boolean;
  services?: string[];
  serviceAreas?: string[];
  teamSize?: string;
  foundedYear?: string;
  certifications?: string[];
  awards?: string[];
  testimonialThemes?: string[];
  websiteQuality?: string;
  blogTopics?: string[];
  pricingSignals?: string;
  voiceOfCustomer?: Record<string, unknown> | null;
  gmbData?: {
    reviewCount: string;
    averageRating: string;
    categories: string;
    serviceArea: string;
    hoursAvailable?: boolean;
    photosCount?: string;
  } | null;
}

export interface Business {
  id: string;
  customer_id: string;
  business_name: string;
  website_url: string | null;
  primary_service: string | null;
  geographic_market: string | null;
  business_type: string | null;
  business_research: BusinessResearch | null;
  gmb_url: string | null;
  place_id: string | null;
  is_active: boolean;
  research_status: string | null;
  voice_of_customer: Record<string, unknown> | null;
  signal_score: Record<string, unknown> | null;
  last_research_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  auth_user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  website_url: string | null;
  business_type: string | null;
  primary_service: string | null;
  geographic_market: string | null;
  marketing_challenge: string | null;
  current_channels: string[] | null;
  business_research: BusinessResearch | null;
  beta_user: boolean;
  role: string;
  stripe_customer_id: string | null;
  pinball_customer_id: string | null;
  created_at: string;
  last_login: string | null;
  updated_at: string;
}

export interface Purchase {
  id: string;
  customer_id: string;
  business_id: string | null;
  product_type: ProductType;
  stripe_payment_id: string | null;
  stripe_price_id: string | null;
  pinball_order_id: string | null;
  amount: number | null;
  created_at: string;
}

export type ProductType =
  | 'icp_blueprint'
  | 'complete_alex_pack'
  | 'complete_intelligence_stack'
  | 'founders_circle'
  | 'ad_pack'
  | 'social_pack'
  | 'email_pack'
  | 'gtm_plan'
  | 'action_plan';

export type SessionStatus = 'not_started' | 'in_progress' | 'completed' | 'generating';

export interface Session {
  id: string;
  customer_id: string;
  business_id: string | null;
  session_uuid: string;
  phase: Phase;
  message_history: Message[];
  phase_transcripts: Record<string, Message[]> | null;
  icp_data: Record<string, unknown> | null;
  icp_html: string | null;
  icp_core: Record<string, unknown> | null;
  messaging_data: Record<string, unknown> | null;
  competitive_data: Record<string, unknown> | null;
  content_data: Record<string, unknown> | null;
  targeting_data: Record<string, unknown> | null;
  proof_assets: Record<string, unknown> | null;
  anti_icp_signals: Record<string, unknown> | null;
  voice_of_customer_signals: Record<string, unknown> | null;
  signal_score_inputs: Record<string, unknown> | null;
  shareability: Record<string, unknown> | null;
  gtm_data: Record<string, unknown> | null;
  segment_data: Record<string, unknown> | null;
  status: SessionStatus;
  archived: boolean;
  icp_generated_at: string | null;
  started_at: string | null;
  last_activity: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface Deliverable {
  id: string;
  customer_id: string;
  business_id: string | null;
  session_id: string;
  deliverable_type: string;
  content: Record<string, unknown> | null;
  pdf_url: string | null;
  status: 'pending' | 'complete';
  generated_at: string | null;
  created_at: string;
}

export interface VoiceOfCustomer {
  id: string;
  business_id: string;
  source: string;
  source_url: string | null;
  raw_text: string;
  extracted_phrases: string[] | null;
  outcome_language: string[] | null;
  emotional_language: string[] | null;
  problem_language: string[] | null;
  top_phrases: string[] | null;
  times_used_in_generation: number;
  performance_score: number;
  created_at: string;
  updated_at: string;
}

export interface SignalScore {
  id: string;
  business_id: string;
  score_total: number;
  score_foundation: number;
  score_messaging: number;
  score_competitive: number;
  score_content: number;
  score_ads: number;
  score_breakdown: Record<string, unknown> | null;
  calculated_at: string;
}

export interface Feedback {
  id: string;
  business_id: string;
  deliverable_type: string;
  content_block_id: string | null;
  content_text: string | null;
  rating: number | null;
  feedback_text: string | null;
  voc_phrases_used: string[] | null;
  used_in_regeneration: boolean;
  created_at: string;
}

// Module output types
export type ModuleType =
  | 'signal_ads'
  | 'signal_content'
  | 'signal_sequences'
  | 'signal_launch'
  | 'signal_sprint'
  | 'gmb_audit'
  | 'keyword_suggester'
  | 'seo_scanner'
  | 'content_writer'
  | 'competitive_intel'
  | 'funnel_auditor'

export interface ModuleOutput {
  id: string;
  business_id: string;
  session_id: string | null;
  module_type: ModuleType;
  generation_number: number;
  input_snapshot: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  feedback_rating: number | null;
  feedback_text: string | null;
  feedback_used: boolean;
  status: string;
  regenerations_used: number;
  created_at: string;
  updated_at: string;
}

// Job types for agent orchestration
export type JobType =
  | 'research'
  | 'voc_extraction'
  | 'signal_score_calculation'
  | 'ads_generation'
  | 'content_generation'
  | 'email_generation'
  | 'gtm_generation'
  | 'sprint_generation'
  | 'gmb_audit'
  | 'keyword_research'
  | 'competitive_research'

export interface Job {
  id: string;
  business_id: string;
  job_type: JobType;
  status: 'pending' | 'running' | 'complete' | 'failed';
  priority: number;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  error_message: string | null;
  retry_count: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

// Agent context — the standardized data package passed to every agent/module
export interface AgentContext {
  business: Business;
  session: Session | null;
  icpCore: Record<string, unknown> | null;
  messagingData: Record<string, unknown> | null;
  competitiveData: Record<string, unknown> | null;
  contentData: Record<string, unknown> | null;
  gtmData: Record<string, unknown> | null;
  targetingData: Record<string, unknown> | null;
  proofAssets: Record<string, unknown> | null;
  antiIcpSignals: Record<string, unknown> | null;
  voiceOfCustomerSignals: Record<string, unknown> | null;
  shareability: Record<string, unknown> | null;
  vocSummary: {
    totalEntries: number;
    totalPhrases: number;
    topPhrases: string[];
    outcomeLanguage: string[];
    emotionalLanguage: string[];
    problemLanguage: string[];
    reviewHighlights: string[];
    rawReviews: Array<{ text: string; rating: number; authorName: string }>;
  } | null;
  signalScore: SignalScore | null;
  moduleOutputs: ModuleOutput[];
  feedbackHistory: Feedback[];
  researchComplete: boolean;
  placeId: string | null;
  lastResearchAt: string | null;
  readiness: {
    hasInterview: boolean;
    hasResearch: boolean;
    hasPlaceId: boolean;
    hasVocData: boolean;
    hasSignalScore: boolean;
    hasSignalAds: boolean;
    hasSignalContent: boolean;
    hasSignalSequences: boolean;
    hasSignalLaunch: boolean;
    hasSignalSprint: boolean;
  };
}

export interface PinballWebhookPayload {
  email: string;
  first_name: string;
  last_name: string;
  event: string;
  products: string[];
  order_id: string;
  amount: number;
}
