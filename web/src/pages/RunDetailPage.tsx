import { Link } from 'react-router-dom'
import { PipelineRun } from '../types'

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</div>
      <div className="mt-1 font-display text-3xl font-bold text-ink dark:text-white">{value}</div>
    </div>
  )
}

export default function RunDetailPage({ latestRun }: { latestRun: PipelineRun | null }) {
  return (
    <div>
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
      >
        ← Back to board
      </Link>

      <h2 className="mb-4 font-display text-2xl font-extrabold tracking-tight text-ink dark:text-white">
        Last Pipeline Run
      </h2>

      {!latestRun ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No pipeline runs yet.
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Ran {new Date(latestRun.run_at).toLocaleString()}
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Ingested" value={String(latestRun.ingested_count)} />
            <StatTile label="Shortlisted" value={String(latestRun.shortlisted_count)} />
            <StatTile label="Filtered out" value={String(latestRun.filtered_out_count)} />
            <StatTile label="Tailored" value={String(latestRun.tailored_count)} />
          </div>

          <div className="glass mt-3 rounded-2xl p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Sources run
            </h3>
            {latestRun.sources_run.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">None ran successfully this cycle.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {latestRun.sources_run.map(source => (
                  <span
                    key={source}
                    className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
                  >
                    {source}
                  </span>
                ))}
              </div>
            )}
          </div>

          {latestRun.errors.length > 0 && (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Errors this run
              </h3>
              <ul className="space-y-1 text-sm text-amber-800 dark:text-amber-200">
                {latestRun.errors.map((err, i) => (
                  <li key={i} className="break-words">{err}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
