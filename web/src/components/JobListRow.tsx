import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Job, JobState } from '../types'
import { STATES, STATE_META } from '../utils/stateMeta'
import { STAGE_LABELS, OUTCOME_META } from '../utils/trackingOptions'

// RESUME_READY is set by the tailor Lambda once a resume actually exists for
// the job — it's deliberately not offered here, since manually picking it
// would just relabel the job "Resume Ready" with no resume behind it.
const MANUALLY_SELECTABLE_STATES = STATES.filter(s => s !== 'RESUME_READY')

interface JobListRowProps {
  job: Job
  index: number
  onMove: (state: JobState) => void
  onDelete: () => void
  onTailor?: () => void
  isTailoring?: boolean
}

// A single stylized list row — used everywhere a bucket's jobs are enumerated
// (JobListPage). Puts the tailored resume link right next to the job itself,
// and shows it whenever tailored_resume_key exists, not just while the job is
// still sitting in RESUME_READY — approving a job into APPLIED shouldn't make
// its tailored resume unreachable.
const JobListRow = forwardRef<HTMLDivElement, JobListRowProps>(({ job, index, onMove, onDelete, onTailor, isTailoring }, ref) => {
  const meta = STATE_META[job.state]

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
      transition={{ duration: 0.35, delay: index * 0.03, ease: [0.16, 1, 0.3, 1] }}
      className={`glass relative flex flex-col gap-3 overflow-hidden rounded-xl p-4 shadow-sm ring-1 ${meta.ring} sm:flex-row sm:items-center sm:justify-between`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${meta.gradient}`} aria-hidden="true" />

      <div className="min-w-0 flex-1 pl-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold text-slate-900 dark:text-slate-100">{job.title}</span>
          <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.chip}`}>
            {meta.label}
          </span>
          {typeof job.score === 'number' && (
            <span title={job.reasons?.join(' · ')} className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
              {Math.round(job.score * 100)}% match
            </span>
          )}
          {job.state === 'IN_PROGRESS' && job.stage && (
            <span className="flex-shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
              {STAGE_LABELS[job.stage]}
            </span>
          )}
          {job.state === 'DECISION' && job.outcome && (
            <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${OUTCOME_META[job.outcome].chip}`}>
              {OUTCOME_META[job.outcome].label}
            </span>
          )}
        </div>
        <div className="truncate text-xs text-slate-600 dark:text-slate-400">
          {job.company}{job.location ? ` · ${job.location}` : ''}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {job.link && (
            <a href={job.link} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-700 hover:text-indigo-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
              View Job ↗
            </a>
          )}
          {job.resume_url && (
            <a href={job.resume_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-700 hover:text-indigo-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
              Tailored Resume ↗
            </a>
          )}
          <Link to={`/board/job/${job.id}`} className="font-medium text-slate-500 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-400 dark:hover:text-indigo-300">
            Details →
          </Link>
          <span className="text-slate-400 dark:text-slate-500">{new Date(job.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      {job.state === 'SHORTLISTED' ? (
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            onClick={onTailor}
            disabled={isTailoring}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isTailoring ? 'Generating…' : '✨ Generate Resume'}
          </button>
          <button
            onClick={() => onMove('SKIPPED')}
            disabled={isTailoring}
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-500/15 dark:text-slate-300 dark:hover:bg-slate-500/25"
          >
            Skip
          </button>
          <button
            onClick={onDelete}
            disabled={isTailoring}
            aria-label={`Delete ${job.title} at ${job.company}`}
            className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
          >
            Delete
          </button>
        </div>
      ) : job.state === 'RESUME_READY' ? (
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            onClick={() => onMove('APPLIED')}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Approve
          </button>
          <button
            onClick={() => onMove('SKIPPED')}
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:bg-slate-500/15 dark:text-slate-300 dark:hover:bg-slate-500/25"
          >
            Skip
          </button>
          <button
            onClick={onDelete}
            aria-label={`Delete ${job.title} at ${job.company}`}
            className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
          >
            Delete
          </button>
        </div>
      ) : (
        <div className="flex flex-shrink-0 items-center gap-2">
          <select
            value={job.state}
            onChange={(e) => onMove(e.target.value as JobState)}
            aria-label={`Change status for ${job.title} at ${job.company}`}
            className="glass-input rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {MANUALLY_SELECTABLE_STATES.map(s => <option key={s} value={s}>{STATE_META[s].label}</option>)}
          </select>
          <button
            onClick={onDelete}
            aria-label={`Delete ${job.title} at ${job.company}`}
            className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
          >
            Delete
          </button>
        </div>
      )}
    </motion.div>
  )
})

export default JobListRow
