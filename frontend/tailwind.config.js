/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        space: '#0a0a0a',
        panel: '#1a1a2e',
        accent: '#00f0ff'
      }
    },
  },
  plugins: [],
}