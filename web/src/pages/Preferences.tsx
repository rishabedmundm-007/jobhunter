import { useState } from 'react'
import { motion } from 'framer-motion'
import { profileApi } from '../services/api'
import { useToast } from '../hooks/useToast'
import Dropdown from '../components/Dropdown'
import FluidBackground from '../components/FluidBackground'
import {
  JOB_ROLE_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  WORK_MODE_OPTIONS,
  SPONSORSHIP_OPTIONS,
  METRO_OPTIONS,
} from '../utils/preferenceOptions'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))
}

const inputClass =
  'glass-input w-full rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400'

export default function Preferences({ onDone }: { onDone: () => void }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState(() => localStorage.getItem('user_email') || '')
  const [phone, setPhone] = useState('')

  const [jobRoles, setJobRoles] = useState<string[]>([])
  const [experienceLevel, setExperienceLevel] = useState('')
  const [employmentTypes, setEmploymentTypes] = useState<string[]>([])
  const [workModes, setWorkModes] = useState<string[]>([])
  const [preferredLocation, setPreferredLocation] = useState('')
  const [sponsorshipStatus, setSponsorshipStatus] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const toast = useToast()

  const missing = {
    firstName: !firstName.trim(),
    lastName: !lastName.trim(),
    email: !EMAIL_PATTERN.test(email.trim()),
    phone: !isValidPhone(phone),
    jobRoles: jobRoles.length === 0,
    experienceLevel: !experienceLevel,
    employmentTypes: employmentTypes.length === 0,
    workModes: workModes.length === 0,
    preferredLocation: !preferredLocation,
    sponsorshipStatus: !sponsorshipStatus,
  }
  const hasMissing = Object.values(missing).some(Boolean)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (hasMissing) {
      setFormError('Please fill in every field correctly so we can match you to the right roles.')
      return
    }
    setFormError(null)
    setSubmitting(true)
    try {
      await profileApi.savePreferences({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        job_roles: jobRoles,
        experience_level: experienceLevel,
        employment_types: employmentTypes,
        work_modes: workModes,
        preferred_location: preferredLocation,
        sponsorship_status: sponsorshipStatus,
      })
      toast.success('Preferences saved')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save preferences')
    } finally {
      setSubmitting(false)
    }
  }

  const fieldError = (key: keyof typeof missing) => !!formError && missing[key]

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <FluidBackground />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="glass-solid w-full max-w-xl rounded-3xl p-10 shadow-[0_20px_70px_-15px_rgba(99,102,241,0.35)]"
      >
        <div className="text-center">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink dark:text-white">
            Tell us about you
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
            This decides which jobs we'll surface and shortlist for you once automated
            matching goes live.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
          {formError && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">First name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jordan"
                className={`${inputClass} ${fieldError('firstName') ? 'ring-2 ring-red-400' : ''}`}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Last name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Rivera"
                className={`${inputClass} ${fieldError('lastName') ? 'ring-2 ring-red-400' : ''}`}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jordan@example.com"
                className={`${inputClass} ${fieldError('email') ? 'ring-2 ring-red-400' : ''}`}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Phone number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className={`${inputClass} ${fieldError('phone') ? 'ring-2 ring-red-400' : ''}`}
              />
            </div>
          </div>

          <Dropdown
            label="Which job roles are you interested in?"
            options={JOB_ROLE_OPTIONS}
            multi
            value={jobRoles}
            onChange={setJobRoles}
            placeholder="Select one or more roles"
            error={fieldError('jobRoles')}
          />

          <Dropdown
            label="What's your experience level?"
            options={EXPERIENCE_LEVEL_OPTIONS}
            value={experienceLevel}
            onChange={setExperienceLevel}
            placeholder="Select your experience level"
            error={fieldError('experienceLevel')}
          />

          <Dropdown
            label="What kind of employment are you open to?"
            options={EMPLOYMENT_TYPE_OPTIONS}
            multi
            value={employmentTypes}
            onChange={setEmploymentTypes}
            placeholder="Select one or more"
            error={fieldError('employmentTypes')}
          />

          <Dropdown
            label="What work arrangement do you prefer?"
            options={WORK_MODE_OPTIONS}
            multi
            value={workModes}
            onChange={setWorkModes}
            placeholder="Select one or more"
            error={fieldError('workModes')}
          />

          <Dropdown
            label="Preferred location"
            options={METRO_OPTIONS}
            value={preferredLocation}
            onChange={setPreferredLocation}
            placeholder="Search or select a metro area"
            searchable
            error={fieldError('preferredLocation')}
          />
          <p className="-mt-3 text-xs text-slate-500 dark:text-slate-400">
            We'll start your job search here and gradually widen the radius outward.
          </p>

          <Dropdown
            label="Do you require visa sponsorship?"
            options={SPONSORSHIP_OPTIONS}
            value={sponsorshipStatus}
            onChange={setSponsorshipStatus}
            placeholder="Select your work authorization status"
            error={fieldError('sponsorshipStatus')}
          />

          <motion.button
            type="submit"
            disabled={submitting}
            whileHover={!submitting ? { scale: 1.01 } : undefined}
            whileTap={!submitting ? { scale: 0.99 } : undefined}
            className="mt-2 w-full rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/30 transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Continue to Your Board'}
          </motion.button>
        </form>
      </motion.div>
    </div>
  )
}
