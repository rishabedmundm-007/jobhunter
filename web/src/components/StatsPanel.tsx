import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Job, PipelineRun } from '../types'
import { STATES, STATE_META } from '../utils/stateMeta'

function StatTile({ label, value, to }: { label: string; value: string; to?: string }) {
  const content = (
    <>
      <div className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-3xl font-bold text-ink dark:text-white">{value}</span>
      </div>
    </>
  )
  if (to) {
    return (
      <Link
        to={to}
        className="glass block rounded-2xl p-4 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        {content}
      </Link>
    )
  }
  return <div className="glass rounded-2xl p-4">{content}</div>
}

// The pipeline-insight rows sit on a solid indigo gradient (not the site's
// translucent .glass), deliberately, so this panel reads as a distinct
// "analytics" block against the neutral glass tiles for day-to-day counts.
function InsightRow({ label, value, to }: { label: string; value: string; to?: string }) {
  const content = (
    <>
      <span className="text-xs font-medium text-indigo-200">{label}</span>
      <span className="font-display text-xl font-bold text-white">{value}</span>
    </>
  )
  if (to) {
    return (
      <Link
        to={to}
        className="flex items-center justify-between rounded-xl px-3 py-2.5 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      >
        {content}
      </Link>
    )
  }
  return <div className="flex items-center justify-between rounded-xl px-3 py-2.5">{content}</div>
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

  const now = Date.now()
  const trackedWithin = (days: number) =>
    jobs.filter(j => now - new Date(j.created_at).getTime() <= days * 24 * 60 * 60 * 1000).length
  const last24h = trackedWithin(1)
  const last7d = trackedWithin(7)
  const last30d = trackedWithin(30)

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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-3 lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Total tracked" value={String(total)} to="/board/all" />
            <StatTile label="Last 24h" value={String(last24h)} to="/board/recent/1" />
            <StatTile label="Last 7 days" value={String(last7d)} to="/board/recent/7" />
            <StatTile label="Last 30 days" value={String(last30d)} to="/board/recent/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Applied" value={String(applied)} to="/board/state/APPLIED" />
            <StatTile label="In progress" value={String(inProgress)} to="/board/state/IN_PROGRESS" />
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 p-3 shadow-lg shadow-indigo-500/25 ring-1 ring-indigo-400/30">
          <h3 className="mb-1 px-3 pt-1 text-xs font-semibold uppercase tracking-wide text-indigo-200">
            Pipeline Insights
          </h3>
          <div className="divide-y divide-white/10">
            <InsightRow label="Discovered → applied" value={`${conversion}%`} />
            <InsightRow label="Avg match score" value={avgScore !== null ? `${avgScore}%` : '—'} to={avgScore !== null ? '/board/scored' : undefined} />
            <InsightRow label="Tailored today" value={String(tailoredToday)} to="/board/tailored-today" />
            <InsightRow label="Last pipeline run" value={latestRun ? formatRelativeTime(latestRun.run_at) : '—'} to="/board/last-run" />
          </div>
        </div>
      </div>

      <div className="glass mt-4 rounded-2xl p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Jobs by status
        </h3>
        <div className="space-y-2">
          {counts.map(({ state, count }) => (
            <Link
              key={state}
              to={`/board/state/${state}`}
              className="flex items-center gap-3 rounded-lg px-1 py-0.5 transition hover:bg-indigo-50 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
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
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
