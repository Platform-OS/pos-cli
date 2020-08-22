module.exports = {
  future: {
    removeDeprecatedGapUtilities: true,
  },
  purge: {
    mode: 'all',
    content: ['./src/pages/**/*.svelte'],
  },
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
  corePlugins: {
    gridTemplateColumns: false,
    gridColumn: false,
    gridColumnStart: false,
    gridColumnEnd: false,
    gridTemplateRows: false,
    gridRow: false,
    gridRowStart: false,
    gridRowEnd: false,
    gap: false,
    transform: false,
    transformOrigin: false,
    scale: false,
    rotate: false,
    translate: false,
    skew: false,
    transitionProperty: false,
    transitionTimingFunction: false,
    transitionDuration: false,
    transitionDelay: false,
    appearance: false,
    backgroundAttachment: false,
    backgroundPosition: false,
    backgroundRepeat: false,
    backgroundSize: false,
  },
  plugins: [require('@tailwindcss/custom-forms')],
};
