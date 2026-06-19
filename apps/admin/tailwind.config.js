/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0fdf6',
          100: '#d4f0e5',
          200: '#a3dcc6',
          300: '#60be9a',
          400: '#2d9668',
          500: '#1A6B4A',
          600: '#166043',
          700: '#124a33',
          800: '#0d3626',
          900: '#092417',
        },
        accent: '#F5A623',
      },
    },
  },
  plugins: [],
};
