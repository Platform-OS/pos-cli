module.exports = {
  theme: {
    screens: {
      'md': '1024px',
      'lg': '1280px',
      'xl': '1400px',
    },
    container: {
      center: true,
      padding: '0'
    },
  },
  plugins: [require('@tailwindcss/custom-forms')],
  future: {
    removeDeprecatedGapUtilities: true,
    purgeLayersByDefault: true,
    defaultLineHeights: true,
    standardFontWeights: true
  }
};
