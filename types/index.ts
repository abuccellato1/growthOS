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
  session_uuid: string;
  phase: Phase;
  message_history: Message[];
  phase_transcripts: Record<string, Message[]> | null;
  icp_data: Record<string, unknown> | null;
  icp_html: string | null;
  status: SessionStatus;
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
  session_id: string;
  deliverable_type: string;
  content: Record<string, unknown> | null;
  pdf_url: string | null;
  status: 'pending' | 'complete';
  generated_at: string | null;
  created_at: string;
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
