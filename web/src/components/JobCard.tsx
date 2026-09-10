import { Job, JobState } from '../types'

const STATES: JobState[] = ['DISCOVERED', 'SHORTLISTED', 'FILTERED_OUT', 'RESUME_READY', 'APPLIED', 'SKIPPED', 'IN_PROGRESS', 'DECISION']

export default function JobCard({ job, onMove, onDelete }: { job: Job; onMove: (state: JobState) => void; onDelete: () => void }) {
  const stateColors: Record<JobState, string> = {
    DISCOVERED: 'bg-blue-100',
    SHORTLISTED: 'bg-purple-100',
    FILTERED_OUT: 'bg-red-100',
    RESUME_READY: 'bg-yellow-100',
    APPLIED: 'bg-green-100',
    SKIPPED: 'bg-gray-100',
    IN_PROGRESS: 'bg-orange-100',
    DECISION: 'bg-indigo-100',
  }

  return (
    <div className={`${stateColors[job.state]} p-3 rounded-lg border border-gray-300 text-sm hover:shadow-md transition`}>
      <div className="font-semibold text-gray-900 truncate">{job.title}</div>
      <div className="text-gray-600 text-xs truncate">{job.company}</div>
      {job.link && <a href={job.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 text-xs">View Job</a>}
      <div className="mt-2 text-xs text-gray-500">{new Date(job.created_at).toLocaleDateString()}</div>
      <div className="mt-3 flex gap-2 flex-wrap">
        <button onClick={onDelete} className="text-red-700 hover:text-red-900 text-xs px-2 py-1 bg-red-50 rounded hover:bg-red-100 transition">Delete</button>
        <select value={job.state} onChange={(e) => onMove(e.target.value as JobState)} className="text-xs px-2 py-1 border border-gray-300 rounded hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500">
          {STATES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </div>
  )
}
