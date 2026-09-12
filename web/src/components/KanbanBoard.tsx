import { Job, JobState } from '../types'
import { jobsApi } from '../services/api'
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import CreateJobModal from './CreateJobModal'
import { STATES, STATE_META } from '../utils/stateMeta'
import { useToast } from '../hooks/useToast'

// Each bucket is a collapsed tile, not an inline job list — clicking one opens
// its own dedicated page (JobListPage, mode="state") with the full stylized
// list, including each job's tailored resume link right next to it.
export default function KanbanBoard({ jobs, onJobsChange, firstName }: { jobs: Job[], onJobsChange: (jobs: Job[]) => void, firstName?: string }) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [query, setQuery] = useState('')
  const [activeStates, setActiveStates] = useState<Set<JobState>>(new Set(STATES))
  const toast = useToast()

  const toggleState = (state: JobState) => {
    setActiveStates(prev => {
      const next = new Set(prev)
      if (next.has(state)) next.delete(state)
      else next.add(state)
      return next
    })
  }

  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return jobs
    return jobs.filter(j => j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q))
  }, [jobs, query])

  const filtersActive = query.trim() !== '' || activeStates.size !== STATES.length

  const handleCreateJob = async (input: any) => {
    try {
      const newJob = await jobsApi.createJob(input)
      onJobsChange([...jobs, newJob])
      setShowCreateModal(false)
      toast.success(`Added "${newJob.title}"`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create job')
    }
  }

  const visibleStates = STATES.filter(state => activeStates.has(state))

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink dark:text-white">
            Welcome{firstName ? `, ${firstName}` : ''}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">{jobs.length} job{jobs.length === 1 ? '' : 's'} tracked</p>
        </div>
        <motion.button
          onClick={() => setShowCreateModal(true)}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 px-5 py-2.5 font-semibold text-white shadow-lg shadow-indigo-500/25 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          + Add Job
        </motion.button>
      </div>

      <div className="glass mb-6 flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400 dark:text-slate-500" aria-hidden="true">⌕</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or company…"
            aria-label="Search jobs by title or company"
            className="glass-input w-full rounded-xl py-2 pl-9 pr-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {STATES.map(state => {
            const active = activeStates.has(state)
            const meta = STATE_META[state]
            return (
              <button
                key={state}
                onClick={() => toggleState(state)}
                aria-pressed={active}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                  active
                    ? `${meta.chip} border-transparent`
                    : 'border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-white/10 text-slate-400 dark:text-slate-500 hover:text-slate-600'
                }`}
              >
                {meta.label}
              </button>
            )
          })}
          {filtersActive && (
            <button
              onClick={() => { setQuery(''); setActiveStates(new Set(STATES)) }}
              className="rounded-full px-2.5 py-1 text-xs font-semibold text-indigo-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {showCreateModal && <CreateJobModal onClose={() => setShowCreateModal(false)} onCreate={handleCreateJob} />}

      {query.trim() !== '' && filteredJobs.length === 0 && (
        <div className="glass mb-4 rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No jobs match your search.
        </div>
      )}

      <motion.div
        role="list"
        aria-label="Job buckets, grouped by status"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {visibleStates.map(state => {
          const meta = STATE_META[state]
          const count = filteredJobs.filter(j => j.state === state).length
          return (
            <motion.div
              key={state}
              role="listitem"
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link
                to={`/board/state/${state}`}
                className={`glass group block rounded-2xl p-5 shadow-sm ring-1 ${meta.ring} transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${meta.dot}`} aria-hidden="true" />
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">{meta.label}</h3>
                </div>
                <div className="mt-3 font-display text-3xl font-extrabold text-ink dark:text-white">
                  {count}
                </div>
                <div className="mt-1 text-xs font-medium text-indigo-600 opacity-0 transition group-hover:opacity-100 dark:text-indigo-400">
                  View jobs →
                </div>
              </Link>
            </motion.div>
          )
        })}
      </motion.div>
    </div>
  )
}
