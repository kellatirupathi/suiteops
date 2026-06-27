/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // neutral surfaces
        ink: {
          DEFAULT: '#0f172a', // slate-900
          soft: '#475569', // slate-600
          faint: '#94a3b8', // slate-400
        },
        paper: {
          DEFAULT: '#f8fafc', // slate-50
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
        },
        // primary brand — clean professional indigo/blue
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          400: '#6366f1',
          500: '#4f46e5',
          600: '#4338ca',
          700: '#3730a3',
          800: '#312e81',
        },
        // sidebar surface (deep slate)
        sidebar: {
          DEFAULT: '#0f172a',
          hover: '#1e293b',
          active: '#334155',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)',
        card: '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.05)',
        lift: '0 4px 12px -2px rgba(15,23,42,0.10), 0 2px 6px -2px rgba(15,23,42,0.06)',
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
};
