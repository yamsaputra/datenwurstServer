/** @type {import('tailwindcss').Config} */
const config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base:    '#080e1a',
          surface: '#0d1629',
          raised:  '#142038',
        },
        border: '#1e3054',
        accent: {
          DEFAULT: '#2f6fef',
          dim:     '#1a4db3',
          glow:    '#4d8fff',
        },
        text: {
          primary: '#e8edf5',
          muted:   '#7a93b8',
        },
        success: '#22c97a',
        warning: '#f5a623',
        danger:  '#e8394a',
      },
      borderRadius: {
        xs:   '4px',
        sm:   '6px',
        DEFAULT: '10px',
        md:   '10px',
        lg:   '16px',
        xl:   '26px',
        full: '9999px',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
