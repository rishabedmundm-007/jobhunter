import { Job, JobState } from '../types'
import { jobsApi } from '../services/api'
import JobCard from './JobCard'
import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import CreateJobModal from './CreateJobModal'
import ConfirmDialog from './ConfirmDialog'
import { STATES, STATE_META } from '../utils/stateMeta'
import { useToast } from '../hooks/useToast'

export default function KanbanBoard({ jobs, onJobsChange, firstName }: { jobs: Job[], onJobsChange: (jobs: Job[]) => void, firstName?: string }) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Job | null>(null)
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

  const visibleJobs = useMemo(() => {
    const q = query.trim().toLowerCase()
    return jobs.filter(j => {
      if (!activeStates.has(j.state)) return false
      if (!q) return true
      return j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q)
    })
  }, [jobs, query, activeStates])

  const filtersActive = query.trim() !== '' || activeStates.size !== STATES.length

  const handleMoveJob = async (jobId: string, newState: JobState) => {
    try {
      const updated = await jobsApi.updateJob(jobId, { state: newState })
      onJobsChange(jobs.map(j => j.id === jobId ? updated : j))
      toast.success(`Moved "${updated.title}" to ${STATE_META[newState].label}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to move job')
    }
  }

  const handleDeleteJob = async (job: Job) => {
    try {
      await jobsApi.deleteJob(job.id)
      onJobsChange(jobs.filter(j => j.id !== job.id))
      toast.success(`Deleted "${job.title}"`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete job')
    } finally {
      setPendingDelete(null)
    }
  }

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
      <AnimatePresence>
        {pendingDelete && (
          <ConfirmDialog
            title="Delete this job?"
            description={`"${pendingDelete.title}" at ${pendingDelete.company} will be removed for good.`}
            confirmLabel="Delete"
            danger
            onConfirm={() => handleDeleteJob(pendingDelete)}
            onCancel={() => setPendingDelete(null)}
          />
        )}
      </AnimatePresence>

      {filtersActive && visibleJobs.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No jobs match your search or filters.
        </div>
      )}

      <motion.div
        role="list"
        aria-label="Kanban board, grouped by status"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
        className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {STATES.filter(state => activeStates.has(state)).map(state => {
          const meta = STATE_META[state]
          const stateJobs = visibleJobs.filter(j => j.state === state)
          return (
            <motion.section
              key={state}
              role="listitem"
              aria-label={`${meta.label}, ${stateJobs.length} job${stateJobs.length === 1 ? '' : 's'}`}
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="glass rounded-2xl p-4 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${meta.dot}`} aria-hidden="true" />
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">{meta.label}</h3>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.chip}`}>
                  {stateJobs.length}
                </span>
              </div>

              <div className="flex max-h-[30rem] min-h-[4rem] flex-col gap-2.5 overflow-y-auto pr-0.5">
                <AnimatePresence mode="popLayout">
                  {stateJobs.map((job, index) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      index={index}
                      onMove={(newState) => handleMoveJob(job.id, newState)}
                      onDelete={() => setPendingDelete(job)}
                    />
                  ))}
                </AnimatePresence>
                {stateJobs.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    Nothing here yet
                  </div>
                )}
              </div>
            </motion.section>
          )
        })}
      </motion.div>
    </div>
  )
}
