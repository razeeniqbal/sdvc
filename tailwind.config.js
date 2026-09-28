/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Court navy — the V1 primary. Still used by pages that haven't been
        // moved onto the V2 palette yet (checkout, bookings, profile, admin).
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
        // ===== VSB V2 brand palette (see VSB_V2_Revamp_PRD §4.1) =====
        // Deep Ink — page background, plus raised surfaces for cards/panels.
        ink: {
          DEFAULT: '#0A0D12',
          900: '#0A0D12',
          850: '#0E1219',
          800: '#121821',
          700: '#19212D',
          600: '#232D3B',
          500: '#2F3B4C',
        },
        // VSB Blue — primary action / selected state / key brand accent.
        vsb: {
          50: '#E8F3FF',
          100: '#CCE6FF',
          200: '#99CCFF',
          300: '#5CAEFF',
          400: '#3A9CFF',
          500: '#168BFF',
          600: '#0A72D9',
          700: '#0859AA',
          800: '#08457F',
          900: '#07325C',
        },
        // Court White — primary light foreground on ink.
        chalk: '#F4F1EA',
        // Volleyball Orange — restrained special accent only.
        ball: '#FF6B2C',
        // Slate — secondary information. Brand Slate is #687280, but that only
        // reaches ~3.7:1 on ink surfaces; text needs WCAG AA 4.5:1, so the text
        // token is lifted slightly. Use `slate-brand` for non-text accents.
        muted: '#838D9C',
        'slate-brand': '#687280',
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
