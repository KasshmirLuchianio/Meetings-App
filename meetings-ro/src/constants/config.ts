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

// Pricing plans — minute-based quota. Server-side keys: starter / pro / enterprise.
// Tier (FREE/PRO/ENTERPRISE) is the legacy DB string. minutes_limit must match
// backend PLAN_LIMITS in server.py.
export const PRICING_PLANS = [
  {
    id: "starter",
    tier: 'FREE' as const,
    name: 'Starter',
    price_monthly: 0,
    price_yearly: 0,
    audio_hours: 0.25,
    minutes_limit: 15,
    features: [
      '15 minute / lună',
      'Transcriere AI',
      '2 verticale disponibile',
      'Export PDF',
    ],
  },
  {
    id: "pro",
    tier: 'PRO' as const,
    name: 'Pro',
    price_monthly: 19,
    price_yearly: 182,
    audio_hours: 5,
    minutes_limit: 300,
    features: [
      '5 ore (300 min) / lună',
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
    minutes_limit: 99999,
    features: [
      'Minute nelimitate',
      'Toate verticalele',
      'Export PDF + DOCX + API',
      'AI personalizat pe domeniu',
      'Manager dedicat',
      'SLA 99.9%',
      'Integrări custom',
    ],
  },
];
