import { useState } from 'react'
import { motion } from 'framer-motion'
import { profileApi } from '../services/api'
import { fluidSpring } from '../utils/motion'
import { useToast } from '../hooks/useToast'
import Dropdown from './Dropdown'
import { ContactInfo, Preferences } from '../types'
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

type Tab = 'account' | 'preferences'

export default function EditProfileModal({
  initialTab,
  contact,
  preferences,
  onClose,
  onSaved,
}: {
  initialTab: Tab
  contact: ContactInfo
  preferences: Preferences
  onClose: () => void
  onSaved: (contact: ContactInfo, preferences: Preferences) => void
}) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [firstName, setFirstName] = useState(contact.first_name)
  const [lastName, setLastName] = useState(contact.last_name)
  const [email, setEmail] = useState(contact.email)
  const [phone, setPhone] = useState(contact.phone)

  const [jobRoles, setJobRoles] = useState<string[]>(preferences.job_roles)
  const [experienceLevel, setExperienceLevel] = useState(preferences.experience_level)
  const [employmentTypes, setEmploymentTypes] = useState<string[]>(preferences.employment_types)
  const [workModes, setWorkModes] = useState<string[]>(preferences.work_modes)
  const [preferredLocation, setPreferredLocation] = useState(preferences.preferred_location)
  const [sponsorshipStatus, setSponsorshipStatus] = useState(preferences.sponsorship_status)

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
  const fieldError = (key: keyof typeof missing) => !!formError && missing[key]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (hasMissing) {
      setFormError('Please fill in every field correctly.')
      return
    }
    setFormError(null)
    setSubmitting(true)
    try {
      const result = await profileApi.savePreferences({
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
      toast.success('Changes saved')
      onSaved({ ...contact, ...result.contact }, result.preferences)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-md"
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={fluidSpring}
        className="glass-solid max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl p-8 shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold text-ink dark:text-white">Edit Profile</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            ✕
          </button>
        </div>

        <div role="tablist" className="mb-6 flex gap-1 rounded-xl bg-slate-100 dark:bg-white/5 p-1">
          {(['account', 'preferences'] as Tab[]).map(t => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                tab === t
                  ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {t === 'account' ? 'Account Settings' : 'Job Preferences'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {formError && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              {formError}
            </div>
          )}

          {tab === 'account' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">First name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={`${inputClass} ${fieldError('firstName') ? 'ring-2 ring-red-400' : ''}`}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Last name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={`${inputClass} ${fieldError('lastName') ? 'ring-2 ring-red-400' : ''}`}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`${inputClass} ${fieldError('email') ? 'ring-2 ring-red-400' : ''}`}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Phone number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`${inputClass} ${fieldError('phone') ? 'ring-2 ring-red-400' : ''}`}
                />
              </div>
            </div>
          )}

          {tab === 'preferences' && (
            <div className="space-y-5">
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
              <Dropdown
                label="Do you require visa sponsorship?"
                options={SPONSORSHIP_OPTIONS}
                value={sponsorshipStatus}
                onChange={setSponsorshipStatus}
                placeholder="Select your work authorization status"
                error={fieldError('sponsorshipStatus')}
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl bg-slate-100 dark:bg-white/10 px-5 py-2.5 font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-200 dark:hover:bg-white/15 disabled:opacity-50"
            >
              Cancel
            </button>
            <motion.button
              type="submit"
              disabled={submitting}
              whileHover={!submitting ? { scale: 1.02 } : undefined}
              whileTap={!submitting ? { scale: 0.98 } : undefined}
              className="rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 px-6 py-2.5 font-semibold text-white shadow-lg shadow-indigo-500/25 transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Save Changes'}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
