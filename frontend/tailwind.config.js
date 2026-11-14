/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        space: '#07080d',
        panel: '#101323',
        panel2: '#171b2e',
        edge: '#242a44',
        accent: '#00e5ff',
        purple: '#7851a9',
        ok: '#34d399',
        warn: '#fbbf24',
        danger: '#f87171',
      },
      fontFamily: {
        sans: ['Inter', 'Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
