import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { signIn, signUp, confirmSignUp, resendConfirmationCode, forgotPassword, confirmForgotPassword, saveTokens, decodeToken } from '../utils/auth'
import FluidBackground from '../components/FluidBackground'

const REDIRECT_DELAY_MS = 700
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Mode = 'signin' | 'signup' | 'confirm' | 'forgot' | 'reset'

const inputClass =
  'glass-input w-full rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400'

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.6 18.6 0 0 1 4.22-5.53M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  )
}

// Every password field gets its own independent show/hide toggle rather than
// one shared "reveal all" state — matches how confirm-password fields work
// elsewhere (you often want to check one without exposing the other).
function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  autoComplete: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`${inputClass} pr-11`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 flex items-center rounded-r-xl px-3 text-slate-400 transition hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:text-slate-500 dark:hover:text-slate-300"
      >
        <EyeIcon open={visible} />
      </button>
    </div>
  )
}

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const triggerSuccessCascade = () => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect) setOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    setLeaving(true)
    window.setTimeout(onSuccess, REDIRECT_DELAY_MS)
  }

  const finishSignIn = async (targetEmail: string, targetPassword: string) => {
    const tokens = await signIn(targetEmail, targetPassword)
    saveTokens(tokens)
    const decoded = decodeToken(tokens.IdToken)
    localStorage.setItem('user_sub', decoded.sub)
    if (decoded.email) localStorage.setItem('user_email', decoded.email)
    triggerSuccessCascade()
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!EMAIL_PATTERN.test(email.trim())) return setError('Enter a valid email address.')
    if (!password) return setError('Enter your password.')
    setSubmitting(true)
    try {
      await finishSignIn(email.trim(), password)
    } catch (err) {
      if (err instanceof Error && err.name === 'UserNotConfirmedException') {
        setInfo('Your email isn\'t verified yet. Enter the code we sent you.')
        setMode('confirm')
      } else {
        setError(err instanceof Error ? err.message : 'Sign in failed')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!EMAIL_PATTERN.test(email.trim())) return setError('Enter a valid email address.')
    if (password !== confirmPassword) return setError('Passwords do not match.')
    setSubmitting(true)
    try {
      await signUp(email.trim(), password)
      setInfo(`We sent a verification code to ${email.trim()}.`)
      setMode('confirm')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!code.trim()) return setError('Enter the verification code.')
    setSubmitting(true)
    try {
      await confirmSignUp(email.trim(), code.trim())
      await finishSignIn(email.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    setError(null)
    try {
      await resendConfirmationCode(email.trim())
      setInfo('Code resent — check your email (and spam folder).')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code')
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!EMAIL_PATTERN.test(email.trim())) return setError('Enter a valid email address.')
    setSubmitting(true)
    try {
      await forgotPassword(email.trim())
      setInfo(`We sent a password reset code to ${email.trim()}.`)
      setMode('reset')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset code')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!code.trim()) return setError('Enter the reset code.')
    if (password !== confirmPassword) return setError('Passwords do not match.')
    setSubmitting(true)
    try {
      await confirmForgotPassword(email.trim(), code.trim(), password)
      await finishSignIn(email.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed')
    } finally {
      setSubmitting(false)
    }
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setInfo(null)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <FluidBackground />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={leaving ? { opacity: 0, y: -12, scale: 0.94 } : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: leaving ? 0.5 : 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="glass-solid w-full max-w-sm rounded-3xl p-10 shadow-[0_20px_70px_-15px_rgba(99,102,241,0.35)]"
      >
        <div className="text-center">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.5, ease: 'backOut' }}
            className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700 shadow-lg shadow-indigo-500/30"
          >
            <span className="font-display text-2xl font-extrabold text-white">J</span>
          </motion.div>

          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink dark:text-white">
            Jobsperch
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {mode === 'confirm' ? 'Verify your email'
              : mode === 'forgot' ? 'Reset your password'
              : mode === 'reset' ? 'Choose a new password'
              : 'Automated job search & tracking'}
          </p>
        </div>

        {error && (
          <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}
        {!error && info && (
          <div role="status" className="mt-6 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
            {info}
          </div>
        )}

        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="mt-6 space-y-4" noValidate>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              autoComplete="email"
              className={inputClass}
            />
            <PasswordInput
              value={password}
              onChange={setPassword}
              placeholder="Password"
              autoComplete="current-password"
            />
            <p className="text-right text-xs">
              <button type="button" onClick={() => switchMode('forgot')} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                Forgot password?
              </button>
            </p>
            <motion.button
              ref={buttonRef}
              type="submit"
              disabled={submitting || leaving}
              whileHover={!submitting && !leaving ? { scale: 1.02 } : undefined}
              whileTap={!submitting && !leaving ? { scale: 0.98 } : undefined}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 bg-[length:200%_100%] px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/30 transition-[background-position] duration-500 hover:bg-[100%_0] disabled:opacity-70"
            >
              {leaving ? 'Signing in…' : submitting ? 'Checking…' : 'Sign In'}
            </motion.button>
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              New here?{' '}
              <button type="button" onClick={() => switchMode('signup')} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                Create an account
              </button>
            </p>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="mt-6 space-y-4" noValidate>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              autoComplete="email"
              className={inputClass}
            />
            <PasswordInput
              value={password}
              onChange={setPassword}
              placeholder="Password"
              autoComplete="new-password"
            />
            <PasswordInput
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Confirm password"
              autoComplete="new-password"
            />
            <p className="text-xs text-slate-400 dark:text-slate-500">
              At least 12 characters, with uppercase, lowercase, a number, and a symbol.
            </p>
            <motion.button
              type="submit"
              disabled={submitting}
              whileHover={!submitting ? { scale: 1.02 } : undefined}
              whileTap={!submitting ? { scale: 0.98 } : undefined}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/30 transition disabled:opacity-70"
            >
              {submitting ? 'Creating account…' : 'Create Account'}
            </motion.button>
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              Already have an account?{' '}
              <button type="button" onClick={() => switchMode('signin')} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                Sign in
              </button>
            </p>
          </form>
        )}

        {mode === 'confirm' && (
          <form onSubmit={handleConfirm} className="mt-6 space-y-4" noValidate>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Verification code"
              autoComplete="one-time-code"
              className={inputClass}
            />
            <motion.button
              ref={buttonRef}
              type="submit"
              disabled={submitting || leaving}
              whileHover={!submitting && !leaving ? { scale: 1.02 } : undefined}
              whileTap={!submitting && !leaving ? { scale: 0.98 } : undefined}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/30 transition disabled:opacity-70"
            >
              {leaving ? 'Signing in…' : submitting ? 'Verifying…' : 'Confirm Email'}
            </motion.button>
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              <button type="button" onClick={handleResend} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                Resend code
              </button>
              {' · '}
              <button type="button" onClick={() => switchMode('signin')} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                Back to sign in
              </button>
            </p>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="mt-6 space-y-4" noValidate>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              autoComplete="email"
              className={inputClass}
            />
            <motion.button
              type="submit"
              disabled={submitting}
              whileHover={!submitting ? { scale: 1.02 } : undefined}
              whileTap={!submitting ? { scale: 0.98 } : undefined}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/30 transition disabled:opacity-70"
            >
              {submitting ? 'Sending…' : 'Send Reset Code'}
            </motion.button>
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              <button type="button" onClick={() => switchMode('signin')} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                Back to sign in
              </button>
            </p>
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={handleResetPassword} className="mt-6 space-y-4" noValidate>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Reset code"
              autoComplete="one-time-code"
              className={inputClass}
            />
            <PasswordInput
              value={password}
              onChange={setPassword}
              placeholder="New password"
              autoComplete="new-password"
            />
            <PasswordInput
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Confirm new password"
              autoComplete="new-password"
            />
            <p className="text-xs text-slate-400 dark:text-slate-500">
              At least 12 characters, with uppercase, lowercase, a number, and a symbol.
            </p>
            <motion.button
              ref={buttonRef}
              type="submit"
              disabled={submitting || leaving}
              whileHover={!submitting && !leaving ? { scale: 1.02 } : undefined}
              whileTap={!submitting && !leaving ? { scale: 0.98 } : undefined}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/30 transition disabled:opacity-70"
            >
              {leaving ? 'Signing in…' : submitting ? 'Resetting…' : 'Reset Password'}
            </motion.button>
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              <button type="button" onClick={() => switchMode('forgot')} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                Resend code
              </button>
              {' · '}
              <button type="button" onClick={() => switchMode('signin')} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                Back to sign in
              </button>
            </p>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
          Your data stays private to your account
        </p>
      </motion.div>

      <AnimatePresence>
        {leaving && origin && (
          <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden="true">
            {[0, 1, 2, 3].map(i => (
              <motion.div
                key={i}
                initial={{ width: 16, height: 16, opacity: 0.7 }}
                animate={{ width: 1800, height: 1800, opacity: 0 }}
                transition={{ duration: 0.85, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                style={{ left: origin.x, top: origin.y }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white/5 ${
                  ['border-indigo-400/70', 'border-indigo-500/55', 'border-indigo-300/50', 'border-white/80'][i]
                }`}
              />
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
