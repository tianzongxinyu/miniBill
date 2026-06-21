/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#f8faf9',
        surface: '#ffffff',
        ink: '#1a1a1a',
        muted: '#8a9390',
        line: '#e8eeec',
        accent: {
          DEFAULT: '#3E8E7E',
          soft: '#E8F4F1',
          muted: '#6BA99C',
        },
        income: '#2F9E8A',
        expense: '#E05252',
        sidebar: {
          DEFAULT: '#ffffff',
          surface: '#f8faf9',
          border: '#e8eeec',
          muted: '#8a9390',
          active: '#3E8E7E',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 1px 3px rgba(26, 26, 26, 0.04)',
        sidebar: '1px 0 0 rgba(232, 238, 236, 1)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.4s ease-out both',
        'fade-in': 'fade-in 0.3s ease-out both',
        'scale-in': 'scale-in 0.35s ease-out both',
        shimmer: 'shimmer 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
  safelist: [
    'text-income',
    'text-expense',
    'ring-expense/50',
    'bg-expense/15',
    'ring-income/50',
    'bg-income/15',
  ],
};
