// API Configuration
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://meetings-ro-api.onrender.com';

export const API_ENDPOINTS = {
  meetings: '/api/meetings',
  localities: '/api/localities',
  verticals: '/api/v1/verticals',
  health: '/api/health',
} as const;

// Recording settings
export const RECORDING_CONFIG = {
  maxDurationMs: 3600000, // 1 hour
  maxFileSizeMB: 100,
  sampleRate: 44100,
  bitRate: 128000,
  numberOfChannels: 1,
} as const;

// Upload settings
export const UPLOAD_CONFIG = {
  maxRetries: 3,
  backoffMs: [1000, 2000, 4000],
  chunkSize: 1024 * 1024, // 1MB chunks
  maxFileSizeMB: 100,
} as const;

// Vertical types
export const VERTICAL_TYPES = {
  GAL: 'GAL',
  JOURNALISM: 'JOURNALISM',
  LEGAL: 'LEGAL',
  BANKING: 'BANKING',
  HEALTHCARE: 'HEALTHCARE',
  STARTUPS: 'STARTUPS',
} as const;

// Pricing plans
export const PRICING_PLANS = [
  {
    tier: 'FREE' as const,
    name: 'Starter',
    price_monthly: 0,
    price_yearly: 0,
    meetings_per_month: 5,
    max_duration_minutes: 30,
    verticals: ['GAL', 'JOURNALISM'] as const,
    features: [
      '5 întâlniri / lună',
      'Max 30 min / înregistrare',
      '2 verticale disponibile',
      'Export PDF',
      'Transcriere AI',
    ],
  },
  {
    tier: 'PRO' as const,
    name: 'Professional',
    price_monthly: 49,
    price_yearly: 470,
    meetings_per_month: 100,
    max_duration_minutes: 120,
    verticals: 'all' as const,
    features: [
      '100 întâlniri / lună',
      'Max 2 ore / înregistrare',
      'Toate verticalele',
      'Export PDF + DOCX',
      'Transcriere AI avansată',
      'Suport prioritar',
    ],
    highlight: true,
  },
  {
    tier: 'ENTERPRISE' as const,
    name: 'Enterprise',
    price_monthly: 199,
    price_yearly: 1910,
    meetings_per_month: null, // unlimited
    max_duration_minutes: 480,
    verticals: 'all' as const,
    features: [
      'Întâlniri nelimitate',
      'Max 8 ore / înregistrare',
      'Toate verticalele',
      'Export PDF + DOCX + API',
      'AI personalizat pe domeniu',
      'Manager dedicat',
      'SLA 99.9%',
      'Integrări custom',
    ],
  },
];
