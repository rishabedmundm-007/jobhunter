import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getAuthUrl } from '../utils/auth'
import FluidBackground from '../components/FluidBackground'

const REDIRECT_DELAY_MS = 900

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null)
  const [leaving, setLeaving] = useState(false)

  const handleSignIn = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (leaving) return
    const rect = e.currentTarget.getBoundingClientRect()
    setOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    setLeaving(true)
    window.setTimeout(() => {
      window.location.href = getAuthUrl()
    }, REDIRECT_DELAY_MS)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <FluidBackground />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={leaving ? { opacity: 0, y: -12, scale: 0.94 } : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: leaving ? 0.5 : 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="glass-solid w-full max-w-sm rounded-3xl p-10 text-center shadow-[0_20px_70px_-15px_rgba(99,102,241,0.35)]"
      >
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.5, ease: 'backOut' }}
          className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700 shadow-lg shadow-indigo-500/30"
        >
          <span className="font-display text-2xl font-extrabold text-white">J</span>
        </motion.div>

        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink dark:text-white">
          JobHunter
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Automated job search &amp; tracking</p>

        <motion.button
          onClick={handleSignIn}
          disabled={leaving}
          whileHover={!leaving ? { scale: 1.02 } : undefined}
          whileTap={!leaving ? { scale: 0.98 } : undefined}
          className="mt-8 w-full rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 bg-[length:200%_100%] px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/30 transition-[background-position] duration-500 hover:bg-[100%_0] disabled:opacity-90"
        >
          {leaving ? 'Redirecting…' : 'Sign In with AWS Cognito'}
        </motion.button>

        <p className="mt-6 text-xs text-slate-400 dark:text-slate-500">
          Your data stays private to your account
        </p>
      </motion.div>

      <AnimatePresence>
        {leaving && origin && (
          <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden="true">
            {[0, 1, 2, 3].map(i => (
              <motion.div
                key={i}
                initial={{ width: 16, height: 16, opacity: 0.7 }}
                animate={{ width: 1800, height: 1800, opacity: 0 }}
                transition={{ duration: 0.85, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                style={{ left: origin.x, top: origin.y }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white/5 ${
                  ['border-indigo-400/70', 'border-indigo-500/55', 'border-indigo-300/50', 'border-white/80'][i]
                }`}
              />
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
