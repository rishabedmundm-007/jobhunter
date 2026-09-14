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
        // A photographic-feeling backdrop (warm golden-hour wash by day, a
        // night skyline glow after dark) to sit behind the glass panels,
        // replacing the flat mesh — validated first as a side-by-side mockup.
        'photo-light':
          'radial-gradient(120% 90% at 12% 0%, rgba(251,211,141,0.55) 0%, transparent 46%), radial-gradient(90% 70% at 90% 12%, rgba(167,139,250,0.45) 0%, transparent 55%), radial-gradient(110% 90% at 50% 115%, rgba(49,46,129,0.85) 0%, transparent 60%), linear-gradient(165deg, #efe3f6 0%, #d9c9ee 32%, #9f8fd6 62%, #4f4293 100%)',
        'photo-dark':
          'radial-gradient(38% 30% at 14% 18%, rgba(245,182,76,0.55) 0%, transparent 70%), radial-gradient(30% 24% at 78% 10%, rgba(251,211,141,0.35) 0%, transparent 70%), radial-gradient(60% 45% at 50% 100%, rgba(79,70,229,0.55) 0%, transparent 70%), linear-gradient(180deg, #0d0b1f 0%, #171335 45%, #241d4d 78%, #2f2560 100%)',
        grain:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      },
      animation: {
        blob: 'blob 18s infinite cubic-bezier(0.45, 0, 0.55, 1)',
        'blob-slow': 'blob 26s infinite cubic-bezier(0.45, 0, 0.55, 1)',
        'fade-up': 'fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 2.5s linear infinite',
        'spin-slow': 'spin 3s linear infinite',
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
