import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ws } from '../services/websocket'
import { pipelineApi, RateLimitError } from '../services/api'
import { useToast } from '../hooks/useToast'
import { fluidSpring } from '../utils/motion'
import { PipelineProgress, PipelineRun } from '../types'

const COOLDOWN_SECONDS = 900

const LAST_RUN_KEY = 'pipeline_manual_run_at'

// Every source (JSearch, Adzuna, USAJOBS, Remotive, RemoteOK) still runs on
// the backend exactly as before — this view just stops narrating which one
// is being checked. The reactor core reacts to the same pipeline:progress
// events (aggregate counts still tick up live); it just no longer spells out
// source names, in favor of a single abstract status readout.
const STAGE_CAPTION: Record<string, string> = {
  started: 'Initializing',
  ingest: 'Scanning Sources',
  match: 'Analyzing Matches',
  tailor: 'Tailoring Résumé',
  done: 'Scan Complete',
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function ReactorCore({ running, stage }: { running: boolean; stage: string }) {
  return (
    <div className="relative mx-auto mb-5 h-60 w-60">
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: 'radial-gradient(closest-side, rgba(34,211,238,0.16), transparent 72%)' }}
      />

      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#67e8f9" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="94" fill="none" stroke="url(#ring-grad)" strokeWidth="1" strokeOpacity="0.25" />
        <motion.circle
          cx="100" cy="100" r="80" fill="none" stroke="url(#ring-grad)" strokeWidth="2"
          strokeDasharray="26 16" strokeLinecap="round" style={{ transformOrigin: '100px 100px' }}
          animate={{ rotate: running ? 360 : 0 }}
          transition={running ? { repeat: Infinity, duration: 7, ease: 'linear' } : { duration: 0.4 }}
        />
        <motion.circle
          cx="100" cy="100" r="64" fill="none" stroke="#a5b4fc" strokeWidth="1.5"
          strokeDasharray="3 9" strokeLinecap="round" style={{ transformOrigin: '100px 100px' }}
          animate={{ rotate: running ? -360 : 0 }}
          transition={running ? { repeat: Infinity, duration: 10, ease: 'linear' } : { duration: 0.4 }}
        />
      </svg>

      {running && [0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ inset: `${18 + i * 6}px` }}
          animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
          transition={{ repeat: Infinity, duration: 4 + i * 1.6, ease: 'linear' }}
        >
          <span
            className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-cyan-300"
            style={{ boxShadow: '0 0 10px 3px rgba(103,232,249,0.75)' }}
          />
        </motion.div>
      ))}

      {/* Static centering wrapper, kept deliberately separate from the
          motion.div below — Framer Motion writes its own `transform` for
          rotate/scale, which would silently overwrite a CSS translate(-50%,-50%)
          set on the same element. */}
      <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2">
        <motion.div
          className="h-full w-full"
          style={{
            background: 'conic-gradient(from 180deg, #22d3ee, #6366f1, #a78bfa, #22d3ee)',
            boxShadow: '0 0 50px 10px rgba(99,102,241,0.5), 0 0 22px 5px rgba(34,211,238,0.45)',
            filter: 'blur(1.5px)',
          }}
          animate={{
            borderRadius: [
              '42% 58% 63% 37% / 41% 44% 56% 59%',
              '58% 42% 39% 61% / 55% 60% 40% 45%',
              '42% 58% 63% 37% / 41% 44% 56% 59%',
            ],
            scale: running ? [1, 1.1, 1] : 1,
            rotate: 360,
          }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span
          key={running ? 'live' : 'idle'}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={fluidSpring}
          className="h-2.5 w-2.5 rounded-full bg-white"
          style={{ boxShadow: '0 0 16px 6px rgba(255,255,255,0.85)' }}
          aria-hidden="true"
        />
      </div>

      <div className="absolute -bottom-1 left-0 right-0 text-center">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          {STAGE_CAPTION[stage] ?? 'Standing By'}
        </span>
      </div>
    </div>
  )
}

export default function PipelineRadar({ onClose }: { onClose: () => void }) {
  const [running, setRunning] = useState(false)
  const [stage, setStage] = useState<string>('done')
  const [counts, setCounts] = useState({ ingested: 0, shortlisted: 0, tailored: 0 })
  const [result, setResult] = useState<PipelineRun | null>(null)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const [starting, setStarting] = useState(false)
  const toast = useToast()

  // Restore cooldown state on open so it survives closing/reopening the panel
  // within the cooldown window (the server enforces the real limit regardless).
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
      if (payload.stage === 'ingest' && payload.status === 'done') {
        setCounts(prev => ({ ...prev, ingested: prev.ingested + (payload.found ?? 0) }))
      } else if (payload.stage === 'match' && payload.status === 'done') {
        setCounts(prev => ({ ...prev, shortlisted: payload.shortlisted ?? 0 }))
      } else if (payload.stage === 'tailor' && payload.status === 'done') {
        setCounts(prev => ({ ...prev, tailored: prev.tailored + 1 }))
      }
    }

    const onCompleted = (run: PipelineRun) => {
      setRunning(false)
      setStage('done')
      setResult(run)
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
    } catch (err) {
      if (err instanceof RateLimitError) {
        setCooldownRemaining(err.retryAfterSeconds)
        toast.error('You can run a manual search once every 15 minutes.')
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
          Every connected source is being checked behind the scenes.
        </p>

        <ReactorCore running={running} stage={stage} />

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

        <AnimatePresence>
          {result && !running && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Link
                to="/board/scored"
                onClick={onClose}
                className="mb-3 block w-full rounded-xl bg-indigo-50 px-4 py-2.5 text-center text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
              >
                View Results →
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

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
