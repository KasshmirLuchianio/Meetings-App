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
    id: "free",
    tier: 'FREE' as const,
    name: 'Starter',
    price_monthly: 0,
    price_yearly: 0,
    audio_hours: 10,
    meetings_limit: 5,
    features: [
      '5 întâlniri / lună',
      '10 ore audio / lună',
      '2 verticale disponibile',
      'Export PDF',
      'Transcriere AI',
    ],
  },
  {
    id: "pro",
    tier: 'PRO' as const,
    name: 'Pro',
    price_monthly: 19,
    price_yearly: 182,
    audio_hours: 30,
    meetings_limit: 100,
    features: [
      '100 întâlniri / lună',
      '30 ore audio / lună',
      'Toate verticalele',
      'Export PDF + DOCX',
      'Transcriere AI avansată',
      'Suport prioritar',
    ],
    highlight: true,
  },
  {
    id: "enterprise",
    tier: 'ENTERPRISE' as const,
    name: 'Enterprise',
    price_monthly: 99,
    price_yearly: 950,
    audio_hours: -1,
    meetings_limit: -1,
    features: [
      'Întâlniri nelimitate',
      'Audio nelimitat',
      'Toate verticalele',
      'Export PDF + DOCX + API',
      'AI personalizat pe domeniu',
      'Manager dedicat',
      'SLA 99.9%',
      'Integrări custom',
    ],
  },
];
