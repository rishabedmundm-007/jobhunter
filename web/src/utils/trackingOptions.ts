import { JobOutcome, JobStage } from '../types'

export const STAGES: JobStage[] = ['hr_screen', 'round_1', 'technical', 'final', 'offer_discussion']

export const STAGE_LABELS: Record<JobStage, string> = {
  hr_screen: 'HR Screen',
  round_1: 'Round 1',
  technical: 'Technical',
  final: 'Final',
  offer_discussion: 'Offer Discussion',
}

export const OUTCOMES: JobOutcome[] = ['offer', 'rejected', 'withdrawn', 'ghosted']

export const OUTCOME_META: Record<JobOutcome, { label: string; chip: string }> = {
  offer: { label: 'Offer', chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  rejected: { label: 'Rejected', chip: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
  withdrawn: { label: 'Withdrawn', chip: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400' },
  ghosted: { label: 'Ghosted', chip: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
}
