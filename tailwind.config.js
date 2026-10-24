/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      colors: {
        stone: {
          850: '#1c1917',
        },
      },
    },
  },
  plugins: [
    function ({ addVariant }) {
      addVariant('light', ['.light &', '[data-theme="light"] &']);
    },
  ],
};
