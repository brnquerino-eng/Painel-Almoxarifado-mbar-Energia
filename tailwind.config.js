/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#0a0e14',
          900: '#0f141c',
          850: '#12181f',
          800: '#161c24',
          700: '#1a222d',
          600: '#1f2836',
          500: '#232b36',
          400: '#2f3b4c',
          300: '#333d4d',
        },
        accent: {
          DEFAULT: '#d85c27',
          hover: '#e06b38',
          muted: 'rgba(216, 92, 39, 0.15)',
        },
        muted: '#8c9ba5',
        success: '#2ecc71',
        danger: '#e74c3c',
        warning: '#f39c12',
        purple: '#9b59b6',
        teal: '#1abc9c',
        blue: '#3498db',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        card: '0 10px 20px rgba(0,0,0,0.5), 0 4px 8px rgba(0,0,0,0.3)',
        'card-hover': '0 15px 30px rgba(0,0,0,0.8), 0 5px 15px rgba(216,92,39,0.15)',
      }
    },
  },
  plugins: [],
}
