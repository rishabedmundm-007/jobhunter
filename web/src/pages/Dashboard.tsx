import { useState, useEffect } from 'react'
import { jobsApi } from '../services/api'
import { ws } from '../services/websocket'
import { Job } from '../types'
import KanbanBoard from '../components/KanbanBoard'

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadJobs()
    connectWebSocket()
  }, [])

  const loadJobs = async () => {
    try {
      setError(null)
      const data = await jobsApi.getJobs()
      setJobs(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }

  const connectWebSocket = async () => {
    const token = localStorage.getItem('access_token')
    if (token) {
      try {
        await ws.connect(token)
        ws.on('job:updated', (job: Job) => {
          setJobs(prev => {
            const index = prev.findIndex(j => j.id === job.id)
            if (index >= 0) {
              return [...prev.slice(0, index), job, ...prev.slice(index + 1)]
            }
            return [...prev, job]
          })
        })
      } catch (err) {
        console.error('WebSocket connection failed:', err)
      }
    }
  }

  if (loading) return <div className="p-8 text-center text-lg">Loading jobs...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow p-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">JobHunter</h1>
        <button onClick={onLogout} className="text-red-600 hover:text-red-700 font-semibold transition">
          Sign Out
        </button>
      </header>
      <main className="p-8">
        {error && <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">{error}</div>}
        <KanbanBoard jobs={jobs} onJobsChange={setJobs} />
      </main>
    </div>
  )
}
