import { useEffect } from 'react'
import { motion } from 'framer-motion'

export default function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string
  description?: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
    >
      <motion.div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="glass-solid w-full max-w-sm rounded-2xl p-6 shadow-2xl"
      >
        <h2 id="confirm-dialog-title" className="font-display text-lg font-bold text-ink dark:text-white">
          {title}
        </h2>
        {description && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{description}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button
            autoFocus
            onClick={onCancel}
            className="rounded-xl bg-slate-100 dark:bg-slate-800 px-5 py-2 font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Cancel
          </button>
          <motion.button
            onClick={onConfirm}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className={`rounded-xl px-5 py-2 font-semibold text-white shadow-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              danger
                ? 'bg-gradient-to-r from-red-600 to-rose-600 shadow-red-500/25 focus-visible:ring-red-500'
                : 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 shadow-indigo-500/25 focus-visible:ring-indigo-500'
            }`}
          >
            {confirmLabel}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}
