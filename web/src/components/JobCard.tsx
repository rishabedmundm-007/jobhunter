import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { Job, JobState } from '../types'
import { STATES, STATE_META } from '../utils/stateMeta'

interface JobCardProps {
  job: Job
  index: number
  onMove: (state: JobState) => void
  onDelete: () => void
}

const JobCard = forwardRef<HTMLDivElement, JobCardProps>(({ job, index, onMove, onDelete }, ref) => {
  const meta = STATE_META[job.state]

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
      className={`glass group relative overflow-hidden rounded-xl p-3 text-sm shadow-sm ring-1 ${meta.ring} transition-shadow hover:shadow-md`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${meta.gradient}`} aria-hidden="true" />
      <div className="pl-2">
        <div className="truncate font-semibold text-slate-900 dark:text-slate-100">{job.title}</div>
        <div className="truncate text-xs text-slate-600 dark:text-slate-400">{job.company}</div>
        {job.link && (
          <a
            href={job.link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block rounded text-xs font-medium text-indigo-700 hover:text-indigo-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            View Job ↗
          </a>
        )}
        <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          {new Date(job.created_at).toLocaleDateString()}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <select
            value={job.state}
            onChange={(e) => onMove(e.target.value as JobState)}
            aria-label={`Change status for ${job.title} at ${job.company}`}
            className="glass-input flex-1 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {STATES.map(s => <option key={s} value={s}>{STATE_META[s].label}</option>)}
          </select>
          <button
            onClick={onDelete}
            aria-label={`Delete ${job.title} at ${job.company}`}
            className="rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
          >
            Delete
          </button>
        </div>
      </div>
    </motion.div>
  )
})

export default JobCard
