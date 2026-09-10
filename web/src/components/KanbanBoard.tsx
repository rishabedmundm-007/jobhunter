import { Job, JobState } from '../types'
import { jobsApi } from '../services/api'
import JobCard from './JobCard'
import { useState } from 'react'
import CreateJobModal from './CreateJobModal'

const STATES: JobState[] = ['DISCOVERED', 'SHORTLISTED', 'FILTERED_OUT', 'RESUME_READY', 'APPLIED', 'SKIPPED', 'IN_PROGRESS', 'DECISION']

export default function KanbanBoard({ jobs, onJobsChange }: { jobs: Job[], onJobsChange: (jobs: Job[]) => void }) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleMoveJob = async (jobId: string, newState: JobState) => {
    try {
      setError(null)
      const updated = await jobsApi.updateJob(jobId, { state: newState })
      onJobsChange(jobs.map(j => j.id === jobId ? updated : j))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move job')
    }
  }

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Delete this job?')) return
    try {
      setError(null)
      await jobsApi.deleteJob(jobId)
      onJobsChange(jobs.filter(j => j.id !== jobId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete job')
    }
  }

  const handleCreateJob = async (input: any) => {
    try {
      setError(null)
      const newJob = await jobsApi.createJob(input)
      onJobsChange([...jobs, newJob])
      setShowCreateModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job')
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Jobs ({jobs.length})</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-semibold transition"
        >
          + Add Job
        </button>
      </div>

      {error && <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">{error}</div>}
      {showCreateModal && <CreateJobModal onClose={() => setShowCreateModal(false)} onCreate={handleCreateJob} />}

      <div className="grid grid-cols-4 gap-4 auto-cols-max overflow-x-auto pb-4">
        {STATES.map(state => (
          <div key={state} className="bg-white rounded-lg shadow p-4 min-w-72">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-sm text-gray-700">{state}</h2>
              <span className="bg-gray-200 text-gray-700 text-xs font-semibold px-2 py-1 rounded">
                {jobs.filter(j => j.state === state).length}
              </span>
            </div>
            <div className="space-y-2">
              {jobs.filter(j => j.state === state).map(job => (
                <JobCard key={job.id} job={job} onMove={(newState) => handleMoveJob(job.id, newState)} onDelete={() => handleDeleteJob(job.id)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
