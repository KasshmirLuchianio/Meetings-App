// Core types pentru Meetings.ro

export type VerticalType = 'GAL' | 'JOURNALISM' | 'LEGAL' | 'BANKING';

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
  prompt_template: string;
  output_fields: OutputField[];
  predefined_locations: string[] | null;
  color_accent: string;
}

export interface UploadProgress {
  totalBytesSent: number;
  totalBytesExpectedToSend: number;
  percentage: number;
}
