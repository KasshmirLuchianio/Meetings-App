// API Configuration
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://gal-transcribe.preview.emergentagent.com';

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
} as const;

// Vertical types
export const VERTICAL_TYPES = {
  GAL: 'GAL',
  JOURNALISM: 'JOURNALISM',
  LEGAL: 'LEGAL',
  BANKING: 'BANKING',
} as const;
