import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        ink: '#0f0b1f',
      },
      backgroundImage: {
        'mesh-light':
          'radial-gradient(at 15% 10%, rgba(99,102,241,0.28) 0px, transparent 55%), radial-gradient(at 85% 15%, rgba(129,140,248,0.22) 0px, transparent 55%), radial-gradient(at 50% 85%, rgba(165,180,252,0.30) 0px, transparent 55%)',
        'mesh-dark':
          'radial-gradient(at 15% 10%, rgba(79,70,229,0.5) 0px, transparent 55%), radial-gradient(at 85% 15%, rgba(99,102,241,0.4) 0px, transparent 55%), radial-gradient(at 50% 85%, rgba(129,140,248,0.4) 0px, transparent 55%)',
      },
      animation: {
        blob: 'blob 18s infinite cubic-bezier(0.45, 0, 0.55, 1)',
        'blob-slow': 'blob 26s infinite cubic-bezier(0.45, 0, 0.55, 1)',
        'fade-up': 'fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 2.5s linear infinite',
      },
      keyframes: {
        blob: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(4%, -6%) scale(1.08)' },
          '66%': { transform: 'translate(-3%, 3%) scale(0.95)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          from: { backgroundPosition: '0 0' },
          to: { backgroundPosition: '-200% 0' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
