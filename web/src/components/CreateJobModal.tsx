import { useState } from 'react'
import { motion } from 'framer-motion'
import { fluidSpring } from '../utils/motion'

export default function CreateJobModal({ onClose, onCreate }: { onClose: () => void; onCreate: (input: any) => void }) {
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [link, setLink] = useState('')
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !company.trim()) {
      setFormError('Title and company are required')
      return
    }
    setFormError(null)
    setLoading(true)
    try {
      await onCreate({ title: title.trim(), company: company.trim(), link: link.trim() || undefined })
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-md p-4"
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={fluidSpring}
        className="glass-solid w-full max-w-md rounded-2xl p-8 shadow-2xl"
      >
        <h2 className="font-display mb-6 text-2xl font-extrabold text-ink dark:text-white">Add New Job</h2>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {formError && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              {formError}
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-600 dark:text-slate-400">Job Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={loading}
              className="glass-input w-full rounded-xl px-4 py-2.5 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="e.g., Senior Engineer"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-600 dark:text-slate-400">Company *</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              required
              disabled={loading}
              className="glass-input w-full rounded-xl px-4 py-2.5 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="e.g., Google"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-600 dark:text-slate-400">Job Link</label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              disabled={loading}
              className="glass-input w-full rounded-xl px-4 py-2.5 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="https://..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl bg-slate-100 dark:bg-slate-800 px-6 py-2.5 font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 px-6 py-2.5 font-semibold text-white shadow-lg shadow-indigo-500/25 transition disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create'}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
