import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ws } from '../services/websocket'
import { pipelineApi, RateLimitError } from '../services/api'
import { useToast } from '../hooks/useToast'
import { fluidSpring } from '../utils/motion'
import { JobSource, PipelineProgress, PipelineRun } from '../types'

const COOLDOWN_SECONDS = 3600
const LAST_RUN_KEY = 'pipeline_manual_run_at'

const SOURCES: { id: JobSource; label: string; icon: string }[] = [
  { id: 'adzuna', label: 'Adzuna', icon: '🧭' },
  { id: 'usajobs', label: 'USAJOBS', icon: '🏛️' },
  { id: 'remotive', label: 'Remotive', icon: '🌐' },
  { id: 'remoteok', label: 'RemoteOK', icon: '🛰️' },
  { id: 'jsearch', label: 'JSearch', icon: '🔭' },
]

const STAGE_ICON: Record<string, string> = { started: '🚀', ingest: '🔍', match: '🧠', tailor: '📝', done: '✅' }

type SourceStatus = 'checking' | 'done' | undefined

interface LogLine { id: number; text: string }

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export default function PipelineRadar({ onClose }: { onClose: () => void }) {
  const [running, setRunning] = useState(false)
  const [stage, setStage] = useState<string>('done')
  const [sourceStatus, setSourceStatus] = useState<Partial<Record<JobSource, SourceStatus>>>({})
  const [log, setLog] = useState<LogLine[]>([])
  const [counts, setCounts] = useState({ ingested: 0, shortlisted: 0, tailored: 0 })
  const [result, setResult] = useState<PipelineRun | null>(null)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const [starting, setStarting] = useState(false)
  const logId = useRef(0)
  const toast = useToast()

  const appendLog = (text: string) => {
    logId.current += 1
    setLog(prev => [...prev.slice(-11), { id: logId.current, text }])
  }

  // Restore cooldown state on open so it survives closing/reopening the panel
  // within the hour (the server enforces the real limit regardless).
  useEffect(() => {
    const lastRun = localStorage.getItem(LAST_RUN_KEY)
    if (lastRun) {
      const elapsed = (Date.now() - Number(lastRun)) / 1000
      if (elapsed < COOLDOWN_SECONDS) setCooldownRemaining(Math.ceil(COOLDOWN_SECONDS - elapsed))
    }
  }, [])

  useEffect(() => {
    if (cooldownRemaining <= 0) return
    const id = setInterval(() => setCooldownRemaining(prev => Math.max(0, prev - 1)), 1000)
    return () => clearInterval(id)
  }, [cooldownRemaining])

  useEffect(() => {
    const onProgress = (payload: PipelineProgress) => {
      setRunning(true)
      setStage(payload.stage)
      if (payload.stage === 'started') {
        appendLog('🚀 Search started')
      } else if (payload.stage === 'ingest' && payload.source) {
        const label = SOURCES.find(s => s.id === payload.source)?.label ?? payload.source
        if (payload.status === 'checking') {
          setSourceStatus(prev => ({ ...prev, [payload.source as JobSource]: 'checking' }))
          appendLog(`🔍 Checking ${label}…`)
        } else if (payload.status === 'done') {
          setSourceStatus(prev => ({ ...prev, [payload.source as JobSource]: 'done' }))
          const found = payload.found ?? 0
          appendLog(`✅ ${label}: ${found} new job${found === 1 ? '' : 's'}`)
          setCounts(prev => ({ ...prev, ingested: prev.ingested + found }))
        }
      } else if (payload.stage === 'match') {
        if (payload.status === 'started') {
          appendLog(`🧠 Scoring ${payload.count ?? 0} job${payload.count === 1 ? '' : 's'} against your resume…`)
        } else if (payload.status === 'done') {
          appendLog(`✅ ${payload.shortlisted ?? 0} shortlisted, ${payload.filtered_out ?? 0} filtered out`)
          setCounts(prev => ({ ...prev, shortlisted: payload.shortlisted ?? 0 }))
        }
      } else if (payload.stage === 'tailor') {
        const who = payload.job_title ? `${payload.job_title}${payload.company ? ` at ${payload.company}` : ''}` : 'a job'
        if (payload.status === 'started') {
          appendLog(`📝 Tailoring resume for ${who}…`)
        } else if (payload.status === 'done') {
          appendLog(`✅ Tailored resume ready for ${who}`)
          setCounts(prev => ({ ...prev, tailored: prev.tailored + 1 }))
        } else if (payload.status === 'error') {
          appendLog(`⚠️ Couldn't tailor a resume for ${who}`)
        }
      }
    }

    const onCompleted = (run: PipelineRun) => {
      setRunning(false)
      setStage('done')
      setResult(run)
      appendLog(`🎉 Done — ${run.ingested_count} found, ${run.shortlisted_count} shortlisted, ${run.tailored_count} tailored`)
    }

    ws.on('pipeline:progress', onProgress)
    ws.on('pipeline:completed', onCompleted)
    return () => {
      ws.off('pipeline:progress', onProgress)
      ws.off('pipeline:completed', onCompleted)
    }
  }, [])

  const handleStart = async () => {
    setStarting(true)
    try {
      await pipelineApi.runNow()
      localStorage.setItem(LAST_RUN_KEY, String(Date.now()))
      setCooldownRemaining(COOLDOWN_SECONDS)
      setRunning(true)
      setResult(null)
      setCounts({ ingested: 0, shortlisted: 0, tailored: 0 })
      setSourceStatus({})
      setLog([])
    } catch (err) {
      if (err instanceof RateLimitError) {
        setCooldownRemaining(err.retryAfterSeconds)
        toast.error('You can run a manual search once per hour.')
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to start search')
      }
    } finally {
      setStarting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-md p-4"
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={fluidSpring}
        className="glass-solid w-full max-w-lg rounded-3xl p-8 shadow-2xl"
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-2xl font-extrabold text-ink dark:text-white">Live Job Search</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            ✕
          </button>
        </div>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          Watch a real search run against every connected source, live.
        </p>

        {/* Radar */}
        <div className="relative mx-auto mb-6 h-56 w-56">
          <div
            className={`absolute inset-0 rounded-full ${running ? 'animate-spin-slow' : ''}`}
            style={{
              background: 'conic-gradient(from 0deg, transparent 0%, rgba(99,102,241,0.4) 12%, transparent 26%)',
            }}
          />
          <div className="absolute inset-5 rounded-full border-2 border-indigo-200/70 dark:border-indigo-500/20" />
          <div className="absolute inset-12 rounded-full border border-indigo-100/70 dark:border-indigo-500/10" />

          {SOURCES.map((source, i) => {
            const angle = (i / SOURCES.length) * 2 * Math.PI - Math.PI / 2
            const x = 50 + 44 * Math.cos(angle)
            const y = 50 + 44 * Math.sin(angle)
            const status = sourceStatus[source.id]
            return (
              <motion.div
                key={source.id}
                style={{ left: `${x}%`, top: `${y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                animate={status === 'checking' ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                transition={status === 'checking' ? { repeat: Infinity, duration: 1 } : fluidSpring}
              >
                <div
                  title={source.label}
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-lg shadow-md transition ${
                    status === 'checking'
                      ? 'bg-indigo-500 shadow-indigo-500/40'
                      : status === 'done'
                      ? 'bg-emerald-100 dark:bg-emerald-500/20'
                      : 'glass'
                  }`}
                >
                  {source.icon}
                </div>
              </motion.div>
            )
          })}

          <div className="absolute inset-0 flex items-center justify-center">
            <motion.span
              key={running ? stage : 'idle'}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={fluidSpring}
              className="text-5xl"
              aria-hidden="true"
            >
              {running ? STAGE_ICON[stage] ?? '🔍' : result ? '✅' : '🛰️'}
            </motion.span>
          </div>
        </div>

        {/* Live counters */}
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <div className="glass rounded-xl py-2">
            <div className="font-display text-xl font-bold text-ink dark:text-white">{counts.ingested}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Found</div>
          </div>
          <div className="glass rounded-xl py-2">
            <div className="font-display text-xl font-bold text-ink dark:text-white">{counts.shortlisted}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Shortlisted</div>
          </div>
          <div className="glass rounded-xl py-2">
            <div className="font-display text-xl font-bold text-ink dark:text-white">{counts.tailored}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Tailored</div>
          </div>
        </div>

        {/* Live feed */}
        {log.length > 0 && (
          <div className="mb-4 max-h-36 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-3 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {log.map(line => <div key={line.id}>{line.text}</div>)}
          </div>
        )}

        {result && !running && (
          <Link
            to="/board/scored"
            onClick={onClose}
            className="mb-3 block w-full rounded-xl bg-indigo-50 px-4 py-2.5 text-center text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
          >
            View Results →
          </Link>
        )}

        <motion.button
          onClick={handleStart}
          disabled={running || starting || cooldownRemaining > 0}
          whileHover={!running && !starting && cooldownRemaining === 0 ? { scale: 1.02 } : undefined}
          whileTap={!running && !starting && cooldownRemaining === 0 ? { scale: 0.98 } : undefined}
          className="w-full rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/30 transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running
            ? 'Searching…'
            : starting
            ? 'Starting…'
            : cooldownRemaining > 0
            ? `Next search in ${formatDuration(cooldownRemaining)}`
            : 'Run Search Now'}
        </motion.button>
      </motion.div>
    </motion.div>
  )
}
