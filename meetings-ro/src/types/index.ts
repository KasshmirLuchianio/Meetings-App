// Core types pentru Meetings.ro

export type VerticalType = 'GAL' | 'JOURNALISM' | 'LEGAL' | 'BANKING' | 'HEALTHCARE' | 'STARTUPS';

// Pricing tiers
export type PricingTier = 'FREE' | 'PRO' | 'ENTERPRISE';

export interface PricingPlan {
  tier: PricingTier;
  name: string;
  price_monthly: number;
  price_yearly: number;
  audio_hours: number;
  meetings_limit: number;
  features: string[];
  highlight?: boolean;
}

// User & Auth
export interface User {
  _id: string;
  email: string;
  name: string;
  company?: string;
  plan: PricingTier;
  meetings_used_this_month: number;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export type MeetingStatus = 'pending' | 'uploading' | 'processing' | 'done' | 'error';

export interface Meeting {
  _id: string;
  title: string | null;
  locality: string | null;
  date: string;
  audio_path: string | null;
  audio_url: string | null;
  transcript: string | null;
  segments: TranscriptSegment[];
  status: MeetingStatus;
  error: string | null;
  duration: number;
  created_at: string;
  updated_at: string;
  
  // Vertical system (EP-02)
  vertical_type: VerticalType;
  vertical_config: Record<string, any>;
  
  // GAL specific (backward compat)
  data_desfasurare?: string | null;
  format_intalnire?: string | null;
  loc_desfasurare?: string | null;
  mod_promovare?: string | null;
  obiectiv?: string | null;
  tematica?: string | null;
  scurta_descriere?: string | null;
  numar_participanti?: string | null;
  concluzia?: string | null;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface Locality {
  name: string;
  count: number;
  created_at?: string;
  is_default?: boolean;
}

export interface OutputField {
  key: string;
  label_ro: string;
  field_type: 'text' | 'textarea' | 'list' | 'number';
  required: boolean;
}

export interface VerticalConfig {
  name: VerticalType;
  display_name_ro: string;
  icon: string;
  description_ro: string;
  prompt_template: string;
  output_fields: OutputField[];
  predefined_locations: string[] | null;
  color_accent: string;
  has_predefined_locations: boolean;
}

export interface UploadProgress {
  totalBytesSent: number;
  totalBytesExpectedToSend: number;
  percentage: number;
}
