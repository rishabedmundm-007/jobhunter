import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Job, JobState } from '../types'
import { jobsApi } from '../services/api'
import { useToast } from '../hooks/useToast'
import { STATE_META } from '../utils/stateMeta'
import JobListRow from '../components/JobListRow'
import ConfirmDialog from '../components/ConfirmDialog'

export type JobListMode = 'state' | 'all' | 'tailored-today' | 'scored'

function isToday(iso?: string): boolean {
  if (!iso) return false
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

export default function JobListPage({ jobs, onJobsChange, mode }: {
  jobs: Job[]
  onJobsChange: (jobs: Job[]) => void
  mode: JobListMode
}) {
  const { state } = useParams<{ state: JobState }>()
  const [pendingDelete, setPendingDelete] = useState<Job | null>(null)
  const toast = useToast()

  const { title, chipClass, items } = useMemo(() => {
    if (mode === 'state' && state) {
      const meta = STATE_META[state]
      return { title: meta?.label ?? state, chipClass: meta?.chip ?? '', items: jobs.filter(j => j.state === state) }
    }
    if (mode === 'tailored-today') {
      return { title: 'Tailored Today', chipClass: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300', items: jobs.filter(j => isToday(j.tailored_at)) }
    }
    if (mode === 'scored') {
      const scored = jobs.filter(j => typeof j.score === 'number').sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      return { title: 'Scored Jobs', chipClass: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300', items: scored }
    }
    return { title: 'All Jobs', chipClass: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300', items: jobs }
  }, [mode, state, jobs])

  const scored = items.filter(j => typeof j.score === 'number')
  const avgScore = scored.length > 0 ? Math.round((scored.reduce((sum, j) => sum + (j.score || 0), 0) / scored.length) * 100) : null

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

  return (
    <div>
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
      >
        ← Back to board
      </Link>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink dark:text-white">{title}</h2>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${chipClass}`}>
          {items.length} job{items.length === 1 ? '' : 's'}
        </span>
        {avgScore !== null && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
            avg match {avgScore}%
          </span>
        )}
      </div>

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

      {items.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          Nothing here yet.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <AnimatePresence mode="popLayout">
            {items.map((job, index) => (
              <JobListRow
                key={job.id}
                job={job}
                index={index}
                onMove={(newState) => handleMoveJob(job.id, newState)}
                onDelete={() => setPendingDelete(job)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
