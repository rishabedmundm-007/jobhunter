import { JobState } from '../types'

export const STATES: JobState[] = [
  'DISCOVERED',
  'SHORTLISTED',
  'FILTERED_OUT',
  'RESUME_READY',
  'APPLIED',
  'SKIPPED',
  'IN_PROGRESS',
  'DECISION',
]

interface StateMeta {
  label: string
  dot: string
  gradient: string
  chip: string
  ring: string
}

// A single indigo hue, deepening as a job moves through the pipeline; the two
// "exited without progressing" states use neutral slate instead of a new hue.
export const STATE_META: Record<JobState, StateMeta> = {
  DISCOVERED: {
    label: 'Discovered',
    dot: 'bg-indigo-300',
    gradient: 'from-indigo-300 to-indigo-400',
    chip: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
    ring: 'ring-indigo-100 dark:ring-indigo-500/20',
  },
  SHORTLISTED: {
    label: 'Shortlisted',
    dot: 'bg-indigo-400',
    gradient: 'from-indigo-400 to-indigo-500',
    chip: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
    ring: 'ring-indigo-100 dark:ring-indigo-500/20',
  },
  FILTERED_OUT: {
    label: 'Filtered Out',
    dot: 'bg-slate-400',
    gradient: 'from-slate-400 to-slate-500',
    chip: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400',
    ring: 'ring-slate-200 dark:ring-slate-500/20',
  },
  RESUME_READY: {
    label: 'Resume Ready',
    dot: 'bg-indigo-500',
    gradient: 'from-indigo-500 to-indigo-600',
    chip: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
    ring: 'ring-indigo-200 dark:ring-indigo-500/25',
  },
  APPLIED: {
    label: 'Applied',
    dot: 'bg-indigo-600',
    gradient: 'from-indigo-600 to-indigo-700',
    chip: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/25 dark:text-indigo-200',
    ring: 'ring-indigo-200 dark:ring-indigo-500/25',
  },
  SKIPPED: {
    label: 'Skipped',
    dot: 'bg-slate-300',
    gradient: 'from-slate-300 to-slate-400',
    chip: 'bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400',
    ring: 'ring-slate-200 dark:ring-slate-500/20',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    dot: 'bg-indigo-700',
    gradient: 'from-indigo-700 to-indigo-800',
    chip: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/25 dark:text-indigo-200',
    ring: 'ring-indigo-300 dark:ring-indigo-500/30',
  },
  DECISION: {
    label: 'Decision',
    dot: 'bg-indigo-900',
    gradient: 'from-indigo-900 to-ink',
    chip: 'bg-indigo-200 text-indigo-900 dark:bg-indigo-400/30 dark:text-indigo-100',
    ring: 'ring-indigo-300 dark:ring-indigo-500/30',
  },
}
