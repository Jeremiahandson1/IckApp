/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Score colors
        score: {
          excellent: '#10b981', // green-500
          good: '#22c55e',      // green-500
          okay: '#eab308',      // yellow-500
          poor: '#f97316',      // orange-500
          avoid: '#ef4444',     // red-500
        },
        // Brand colors
        brand: {
          primary: '#10b981',   // emerald
          secondary: '#3b82f6', // blue
          accent: '#8b5cf6',    // violet
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'scan-line': 'scan-line 2s ease-in-out infinite',
        'pulse-score': 'pulse-score 1s ease-in-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
      },
      keyframes: {
        'scan-line': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(200px)' },
        },
        'pulse-score': {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '50%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
