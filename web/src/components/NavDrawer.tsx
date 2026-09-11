import { AnimatePresence, motion } from 'framer-motion'
import Toggle from './Toggle'

export default function NavDrawer({
  open,
  onClose,
  onOpenAccountSettings,
  onOpenJobPreferences,
  isDark,
  onToggleDark,
}: {
  open: boolean
  onClose: () => void
  onOpenAccountSettings: () => void
  onOpenJobPreferences: () => void
  isDark: boolean
  onToggleDark: () => void
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm"
            aria-hidden="true"
          />
          <motion.nav
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="glass-solid fixed inset-y-0 left-0 z-50 flex w-72 flex-col p-5 shadow-2xl"
            aria-label="Main menu"
          >
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700 shadow shadow-indigo-500/30">
                  <span className="font-display text-xs font-extrabold text-white">J</span>
                </div>
                <span className="font-display text-lg font-extrabold text-ink dark:text-white">Jobsperch</span>
              </div>
              <button
                onClick={onClose}
                aria-label="Close menu"
                className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                ✕
              </button>
            </div>

            <button
              onClick={onOpenAccountSettings}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-indigo-50 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <span aria-hidden="true">⚙️</span>
              Account Settings
            </button>

            <button
              onClick={onOpenJobPreferences}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-indigo-50 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <span aria-hidden="true">🎯</span>
              Job Preferences
            </button>

            <div className="my-3 border-t border-slate-200 dark:border-slate-700" />

            <div className="flex items-center justify-between rounded-xl px-3 py-2.5">
              <span className="flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <span aria-hidden="true">{isDark ? '🌙' : '☀️'}</span>
                Dark Mode
              </span>
              <Toggle checked={isDark} onChange={onToggleDark} label="Toggle dark mode" />
            </div>

            <div className="mt-auto pt-4 text-center text-xs text-slate-400 dark:text-slate-500">
              Jobsperch · Phase 1
            </div>
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  )
}
