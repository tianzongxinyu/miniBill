/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--color-canvas-rgb) / <alpha-value>)',
        surface: 'rgb(var(--color-surface-rgb) / <alpha-value>)',
        ink: 'rgb(var(--color-ink-rgb) / <alpha-value>)',
        muted: 'rgb(var(--color-muted-rgb) / <alpha-value>)',
        line: 'rgb(var(--color-line-rgb) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--color-accent-rgb) / <alpha-value>)',
          soft: 'rgb(var(--color-accent-soft-rgb) / <alpha-value>)',
          muted: 'rgb(var(--color-accent-muted-rgb) / <alpha-value>)',
        },
        income: 'rgb(var(--color-income-rgb) / <alpha-value>)',
        expense: 'rgb(var(--color-expense-rgb) / <alpha-value>)',
        sidebar: {
          DEFAULT: 'rgb(var(--color-sidebar-rgb) / <alpha-value>)',
          surface: 'rgb(var(--color-sidebar-surface-rgb) / <alpha-value>)',
          border: 'rgb(var(--color-sidebar-border-rgb) / <alpha-value>)',
          muted: 'rgb(var(--color-sidebar-muted-rgb) / <alpha-value>)',
          active: 'rgb(var(--color-sidebar-active-rgb) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: 'var(--shadow-panel)',
        sidebar: 'var(--shadow-sidebar)',
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
