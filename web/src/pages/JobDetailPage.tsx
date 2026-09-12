import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Job, JobOutcome, JobStage, JobUpdateInput } from '../types'
import { jobsApi } from '../services/api'
import { useToast } from '../hooks/useToast'
import { STATE_META } from '../utils/stateMeta'
import { STAGES, STAGE_LABELS, OUTCOMES, OUTCOME_META } from '../utils/trackingOptions'

export default function JobDetailPage({ jobs, onJobsChange }: { jobs: Job[]; onJobsChange: (jobs: Job[]) => void }) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const job = jobs.find(j => j.id === id)
  const [notes, setNotes] = useState(job?.notes ?? '')
  const [saving, setSaving] = useState(false)

  if (!job) {
    return (
      <div>
        <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
          ← Back to board
        </Link>
        <div className="glass rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          Job not found — it may have been deleted.
        </div>
      </div>
    )
  }

  const patch = async (update: JobUpdateInput, successMessage?: string) => {
    setSaving(true)
    try {
      const updated = await jobsApi.updateJob(job.id, update)
      onJobsChange(jobs.map(j => (j.id === job.id ? updated : j)))
      if (successMessage) toast.success(successMessage)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update job')
    } finally {
      setSaving(false)
    }
  }

  const trackingUnlocked = ['APPLIED', 'IN_PROGRESS', 'DECISION'].includes(job.state)
  const currentStageIndex = job.stage ? STAGES.indexOf(job.stage) : -1

  const setStage = (stage: JobStage) => {
    patch({ state: 'IN_PROGRESS', stage }, `Moved to ${STAGE_LABELS[stage]}`)
  }

  const setOutcome = (outcome: JobOutcome) => {
    patch({ state: 'DECISION', outcome }, `Marked as ${OUTCOME_META[outcome].label}`)
  }

  const saveNotes = () => {
    if (notes !== (job.notes ?? '')) patch({ notes })
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${job.title}" at ${job.company}? This can't be undone.`)) return
    try {
      await jobsApi.deleteJob(job.id)
      onJobsChange(jobs.filter(j => j.id !== job.id))
      toast.success('Deleted')
      navigate('/')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete job')
    }
  }

  const meta = STATE_META[job.state]

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
        ← Back to board
      </Link>

      <div className="glass rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink dark:text-white">{job.title}</h2>
            <p className="text-slate-600 dark:text-slate-400">{job.company}{job.location ? ` · ${job.location}` : ''}</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${meta.chip}`}>{meta.label}</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          {typeof job.score === 'number' && (
            <span title={job.reasons?.join(' · ')} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${meta.chip}`}>
              {Math.round(job.score * 100)}% match
            </span>
          )}
          {job.link && (
            <a href={job.link} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              View Job ↗
            </a>
          )}
          {job.resume_url && (
            <a href={job.resume_url} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              Tailored Resume ↗
            </a>
          )}
        </div>

        {job.description && (
          <div className="mt-4 max-h-48 overflow-y-auto rounded-xl border border-slate-200 p-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {job.description}
          </div>
        )}
      </div>

      {trackingUnlocked && (
        <div className="glass mt-4 rounded-2xl p-6">
          <h3 className="mb-4 text-sm font-bold text-slate-700 dark:text-slate-300">Application Progress</h3>

          <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            {STAGES.map((s, i) => (
              <span key={s} className={i <= currentStageIndex ? 'font-semibold text-indigo-600 dark:text-indigo-400' : ''}>
                {STAGE_LABELS[s]}
              </span>
            ))}
          </div>
          <div className="mb-4 flex gap-1.5">
            {STAGES.map((s, i) => (
              <button
                key={s}
                onClick={() => setStage(s)}
                disabled={saving || job.state === 'DECISION'}
                aria-label={`Set stage to ${STAGE_LABELS[s]}`}
                className={`h-2.5 flex-1 rounded-full transition disabled:cursor-not-allowed ${
                  i <= currentStageIndex ? 'bg-indigo-500' : 'bg-slate-200 hover:bg-indigo-200 dark:bg-white/10 dark:hover:bg-indigo-500/30'
                }`}
              />
            ))}
          </div>

          <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Next step date</label>
          <input
            type="date"
            value={job.next_step_at?.slice(0, 10) ?? ''}
            onChange={(e) => patch({ next_step_at: e.target.value })}
            disabled={saving || job.state === 'DECISION'}
            className="glass-input mb-4 rounded-xl px-3 py-2 text-sm disabled:opacity-50"
          />

          <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
            <h4 className="mb-2 text-sm font-bold text-slate-700 dark:text-slate-300">Decision</h4>
            {job.state === 'DECISION' && job.outcome ? (
              <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${OUTCOME_META[job.outcome].chip}`}>
                {OUTCOME_META[job.outcome].label}
              </span>
            ) : (
              <div className="flex flex-wrap gap-2">
                {OUTCOMES.map(outcome => (
                  <button
                    key={outcome}
                    onClick={() => setOutcome(outcome)}
                    disabled={saving}
                    className={`rounded-full px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${OUTCOME_META[outcome].chip}`}
                  >
                    {OUTCOME_META[outcome].label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="glass mt-4 rounded-2xl p-6">
        <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          rows={4}
          placeholder="Interviewer names, follow-ups, anything worth remembering…"
          className="glass-input w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        />
      </div>

      <button
        onClick={handleDelete}
        className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
      >
        Delete Job
      </button>
    </div>
  )
}
