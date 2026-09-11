import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { jobsApi, profileApi } from '../services/api'
import { ws } from '../services/websocket'
import { ContactInfo, Job, PipelineRun, Preferences } from '../types'
import { useDarkMode } from '../hooks/useDarkMode'
import KanbanBoard from '../components/KanbanBoard'
import StatsPanel from '../components/StatsPanel'
import FluidBackground from '../components/FluidBackground'
import NavDrawer from '../components/NavDrawer'
import AvatarMenu from '../components/AvatarMenu'
import EditProfileModal from '../components/EditProfileModal'
import ConnectedAccountsModal from '../components/ConnectedAccountsModal'

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [contact, setContact] = useState<ContactInfo | null>(null)
  const [preferences, setPreferences] = useState<Preferences | null>(null)
  const [latestRun, setLatestRun] = useState<PipelineRun | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editTab, setEditTab] = useState<'account' | 'preferences' | null>(null)
  const [connectedAccountsOpen, setConnectedAccountsOpen] = useState(false)
  const [isDark, toggleDark] = useDarkMode()

  useEffect(() => {
    loadJobs()
    loadProfile()
    connectWebSocket()
    return () => ws.disconnect()
  }, [])

  const loadJobs = async () => {
    try {
      setError(null)
      const data = await jobsApi.getJobs()
      setJobs(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }

  const loadProfile = async () => {
    try {
      const profile = await profileApi.getProfile()
      setContact(profile.contact)
      setPreferences(profile.preferences)
      setLatestRun(profile.latest_run ?? null)
    } catch (err) {
      console.error('Failed to load profile:', err)
    }
  }

  const connectWebSocket = async () => {
    const token = localStorage.getItem('access_token')
    if (token) {
      try {
        await ws.connect(token)
        ws.on('job:updated', (job: Job) => {
          setJobs(prev => {
            const index = prev.findIndex(j => j.id === job.id)
            if (index >= 0) {
              return [...prev.slice(0, index), job, ...prev.slice(index + 1)]
            }
            return [...prev, job]
          })
        })
        ws.on('job:deleted', ({ id }: { id: string }) => {
          setJobs(prev => prev.filter(j => j.id !== id))
        })
        // The pipeline can touch a dozen jobs in one run — one batched event plus
        // a single refetch beats a burst of individual job:updated messages.
        ws.on('pipeline:completed', (run: PipelineRun) => {
          setLatestRun(run)
          loadJobs()
        })
      } catch (err) {
        console.error('WebSocket connection failed:', err)
      }
    }
  }

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center" role="status" aria-live="polite">
        <FluidBackground />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="h-10 w-10 rounded-full border-2 border-indigo-300 border-t-indigo-600"
        />
        <span className="sr-only">Loading jobs…</span>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen">
      <FluidBackground />

      <header className="sticky top-0 z-20 glass px-6 py-4 shadow-sm md:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="flex h-9 w-9 flex-col items-center justify-center gap-1.5 rounded-lg transition hover:bg-slate-100 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <span className="h-0.5 w-5 rounded-full bg-slate-700 dark:bg-slate-200" />
              <span className="h-0.5 w-5 rounded-full bg-slate-700 dark:bg-slate-200" />
              <span className="h-0.5 w-5 rounded-full bg-slate-700 dark:bg-slate-200" />
            </button>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700 shadow shadow-indigo-500/30">
                <span className="font-display text-sm font-extrabold text-white">J</span>
              </div>
              <h1 className="font-display text-xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 bg-clip-text text-transparent">
                Jobsperch
              </h1>
            </div>
          </div>
          <AvatarMenu
            contact={contact}
            onAvatarUploaded={(updated) => setContact(updated)}
            onLogout={onLogout}
          />
        </div>
      </header>

      <NavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onOpenAccountSettings={() => { setDrawerOpen(false); setEditTab('account') }}
        onOpenJobPreferences={() => { setDrawerOpen(false); setEditTab('preferences') }}
        onOpenConnectedAccounts={() => { setDrawerOpen(false); setConnectedAccountsOpen(true) }}
        isDark={isDark}
        onToggleDark={toggleDark}
      />

      <AnimatePresence>
        {connectedAccountsOpen && (
          <ConnectedAccountsModal onClose={() => setConnectedAccountsOpen(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editTab && contact && preferences && (
          <EditProfileModal
            initialTab={editTab}
            contact={contact}
            preferences={preferences}
            onClose={() => setEditTab(null)}
            onSaved={(updatedContact, updatedPreferences) => {
              setContact(updatedContact)
              setPreferences(updatedPreferences)
            }}
          />
        )}
      </AnimatePresence>

      <main className="mx-auto max-w-7xl px-6 py-8 md:px-10">
        <AnimatePresence>
          {error && (
            <motion.div
              role="alert"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 flex items-center justify-between gap-4 overflow-hidden rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
            >
              <span>{error}</span>
              <button
                onClick={loadJobs}
                className="flex-shrink-0 rounded-lg bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 transition hover:bg-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:bg-red-500/20 dark:text-red-200 dark:hover:bg-red-500/30"
              >
                Retry
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <StatsPanel jobs={jobs} latestRun={latestRun} />
        <KanbanBoard jobs={jobs} onJobsChange={setJobs} firstName={contact?.first_name} />
      </main>
    </div>
  )
}
