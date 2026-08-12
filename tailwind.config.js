/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Court navy — the club's primary color, pulled from an indoor court.
        navy: {
          50: '#EEF2F6',
          100: '#D6E0EA',
          200: '#AEC1D6',
          300: '#7E9DBB',
          400: '#4F779D',
          500: '#325A80',
          600: '#244868',
          700: '#1E3A5F',
          800: '#172D49',
          900: '#101F33',
          950: '#0A141F',
        },
      },
    },
  },
  plugins: [],
};
