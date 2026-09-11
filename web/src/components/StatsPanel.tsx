import { motion } from 'framer-motion'
import { Job, PipelineRun } from '../types'
import { STATES, STATE_META } from '../utils/stateMeta'

function StatTile({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-3xl font-bold text-ink dark:text-white">{value}</span>
        {delta && <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{delta}</span>}
      </div>
    </div>
  )
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export default function StatsPanel({ jobs, latestRun }: { jobs: Job[]; latestRun?: PipelineRun | null }) {
  const total = jobs.length
  const applied = jobs.filter(j => j.state === 'APPLIED').length
  const inProgress = jobs.filter(j => j.state === 'IN_PROGRESS').length
  const conversion = total > 0 ? Math.round((applied / total) * 100) : 0

  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const thisWeek = jobs.filter(j => new Date(j.created_at).getTime() >= oneWeekAgo).length

  const scored = jobs.filter(j => typeof j.score === 'number')
  const avgScore = scored.length > 0
    ? Math.round((scored.reduce((sum, j) => sum + (j.score || 0), 0) / scored.length) * 100)
    : null

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const tailoredToday = jobs.filter(j => j.tailored_at && new Date(j.tailored_at).getTime() >= todayStart.getTime()).length

  const counts = STATES.map(state => ({
    state,
    count: jobs.filter(j => j.state === state).length,
  }))
  const maxCount = Math.max(1, ...counts.map(c => c.count))

  if (total === 0) return null

  return (
    <section aria-label="Board statistics" className="mb-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total tracked" value={String(total)} delta={thisWeek > 0 ? `+${thisWeek} this wk` : undefined} />
        <StatTile label="Applied" value={String(applied)} />
        <StatTile label="In progress" value={String(inProgress)} />
        <StatTile label="Discovered → applied" value={`${conversion}%`} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Avg match score" value={avgScore !== null ? `${avgScore}%` : '—'} />
        <StatTile label="Tailored today" value={String(tailoredToday)} />
        <StatTile label="Last pipeline run" value={latestRun ? formatRelativeTime(latestRun.run_at) : '—'} />
      </div>

      <div className="glass mt-3 rounded-2xl p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Jobs by status
        </h3>
        <div className="space-y-2">
          {counts.map(({ state, count }) => (
            <div key={state} className="flex items-center gap-3">
              <span className="w-28 flex-shrink-0 truncate text-xs text-slate-600 dark:text-slate-400">
                {STATE_META[state].label}
              </span>
              <div className="h-3 flex-1 rounded-full bg-indigo-100 dark:bg-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(count / maxCount) * 100}%` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="h-3 rounded-full bg-indigo-500"
                />
              </div>
              <span className="w-5 flex-shrink-0 text-right text-xs font-semibold text-slate-700 dark:text-slate-300">
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
