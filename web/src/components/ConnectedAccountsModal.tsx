import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { integrationsApi } from '../services/api'
import { fluidSpring } from '../utils/motion'
import { IntegrationProvider, IntegrationStatus } from '../types'

const PROVIDERS: { id: IntegrationProvider; label: string }[] = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'indeed', label: 'Indeed' },
]

function ProviderForm({ provider, label, status, onSaved }: {
  provider: IntegrationProvider
  label: string
  status?: IntegrationStatus
  onSaved: () => void
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!username.trim() || !password) {
      setError('Enter both your username/email and password.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await integrationsApi.saveCredentials(provider, username.trim(), password)
      setUsername('')
      setPassword('')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credentials')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold text-slate-800 dark:text-slate-100">{label}</span>
        {status?.connected && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              status.status === 'challenge_required'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
            }`}
          >
            {status.status === 'challenge_required' ? 'Needs re-login' : 'Connected'}
          </span>
        )}
      </div>
      {error && <p className="mb-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="space-y-2">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={`${label} email`}
          disabled={saving}
          className="glass-input w-full rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={`${label} password`}
          disabled={saving}
          className="glass-input w-full rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? 'Saving…' : status?.connected ? 'Update credentials' : 'Connect'}
        </button>
      </div>
    </div>
  )
}

export default function ConnectedAccountsModal({ onClose }: { onClose: () => void }) {
  const [statuses, setStatuses] = useState<Record<string, IntegrationStatus>>({})

  const loadStatuses = () => {
    integrationsApi.getIntegrations().then(setStatuses).catch(() => {})
  }

  useEffect(() => { loadStatuses() }, [])

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
        <h2 className="font-display mb-2 text-2xl font-extrabold text-ink dark:text-white">Connected Accounts</h2>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          Used to search LinkedIn and Indeed for new postings during scheduled runs.
          Your password is stored encrypted and is never shown again.
        </p>
        <div className="space-y-4">
          {PROVIDERS.map(p => (
            <ProviderForm
              key={p.id}
              provider={p.id}
              label={p.label}
              status={statuses[p.id]}
              onSaved={loadStatuses}
            />
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-6 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
          >
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
