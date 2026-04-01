module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ivory: '#FAF8F3',
        navy: '#1B2A4A',
        gold: '#B8962E',
        success: 'hsl(160, 60%, 30%)',
        warning: 'hsl(45, 90%, 55%)',
        error: 'hsl(0, 72%, 50%)',
      },
      fontFamily: {
        heading: ['PlayfairDisplay_700Bold'],
        body: ['DMSans_400Regular', 'DMSans_500Medium', 'DMSans_600SemiBold'],
      },
      fontSize: {
        // R-005: Minimum 16sp/16pt for 45-50+ age demographic
        xs: ['14px', { lineHeight: '20px' }],    // Badge text, secondary labels
        sm: ['16px', { lineHeight: '24px' }],    // Body text minimum (PRD requirement)
        base: ['16px', { lineHeight: '24px' }],  // Standard body
        lg: ['18px', { lineHeight: '28px' }],    // Headings
        xl: ['20px', { lineHeight: '28px' }],    // Large headings
        '2xl': ['24px', { lineHeight: '32px' }], // Page titles
      },
    },
  },
  plugins: [],
};
