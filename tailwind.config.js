/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        xs: '420px',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Lora"', 'Georgia', 'Cambria', 'serif'],
      },
      colors: {
        stone: {
          750: '#231f1c',
          850: '#171412',
          925: '#0f0d0b',
        },
        amber: {
          450: '#f7a21b',
        },
        // Verde "foglia": sostituisce l'emerald di Tailwind (menta troppo saturo) per i libri letti / completati.
        // Vivace ma caldo, si accorda con ambra, legno e pietra. Contrasto testi: ≥ 6:1 sia in scuro (400) sia in chiaro (700).
        emerald: {
          50: '#effaf2',
          100: '#dbf3e2',
          200: '#b8e6c6',
          300: '#8fd4a4',
          400: '#66bf84',
          500: '#4aa56b',
          600: '#3a8756',
          700: '#316c47',
          800: '#2b563b',
          900: '#254733',
          950: '#11281b',
        },
        // Blu "fiordaliso": sostituisce lo sky di Tailwind (ciano molto acceso) per i libri da leggere.
        sky: {
          50: '#eff6fc',
          100: '#dcebf8',
          200: '#b9d7f1',
          300: '#8fbfe8',
          400: '#65a6de',
          500: '#478bc9',
          600: '#3871a8',
          700: '#305d88',
          800: '#2b4e70',
          900: '#27425d',
          950: '#182a3d',
        },
      },
      keyframes: {
        'toast-in': {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.97)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'toast-progress': {
          '0%': { transform: 'scaleX(1)' },
          '100%': { transform: 'scaleX(0)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'toast-in': 'toast-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-up': 'fade-up 320ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in': 'scale-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [
    function ({ addVariant }) {
      addVariant('light', ['.light &', '[data-theme="light"] &']);
    },
  ],
};
