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
    },
  },
  plugins: [],
};
