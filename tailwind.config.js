/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        space: {
          900: '#050810',
          800: '#090d1a',
          700: '#0d1528',
          600: '#111c36',
          500: '#1a2a4a',
        },
        ed: {
          orange: '#ff6a00',
          blue: '#00d4ff',
          green: '#00ff88',
          yellow: '#ffcc00',
          red: '#ff2244',
        },
      },
      fontFamily: {
        mono: ['Consolas', 'Monaco', 'monospace'],
      },
    },
  },
  plugins: [],
};
