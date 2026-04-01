// Design tokens - Meetings.ro rebrand
export const COLORS = {
  // Brand colors
  ivory: '#FAF8F3',
  navy: '#1B2A4A',
  gold: '#B8962E',
  
  // Semantic colors
  success: 'hsl(160, 60%, 30%)',
  warning: 'hsl(45, 90%, 55%)',
  error: 'hsl(0, 72%, 50%)',
  
  // Neutrals
  textPrimary: '#1B2A4A',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  background: '#FAF8F3',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const FONT_SIZES = {
  xs: 12,
  sm: 14,
  base: 16, // Minimum pentru 45-50+ ani
  lg: 18,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const TOUCH_TARGET = {
  small: 44, // iOS minimum
  medium: 56, // Android optimal
  large: 72,
} as const;
