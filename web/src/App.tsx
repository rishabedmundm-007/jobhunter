import { useEffect, useRef, useState } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { isAuthenticated, clearTokens } from './utils/auth'
import { profileApi } from './services/api'
import Login from './pages/Login'
import Welcome from './pages/Welcome'
import Preferences from './pages/Preferences'
import Dashboard from './pages/Dashboard'

type Step = 'loading' | 'welcome' | 'preferences' | 'dashboard'

export default function App() {
  const [authenticated, setAuthenticated] = useState(isAuthenticated())
  const [step, setStep] = useState<Step>('loading')
  const [sessionExpired, setSessionExpired] = useState(false)
  // Skipping the resume step is a session-only choice — it isn't persisted,
  // so it shouldn't send the user back to Welcome once they've moved past it.
  const resumeSkipped = useRef(false)

  const loadOnboardingStep = async () => {
    try {
      const profile = await profileApi.getProfile()
      if (!profile.resume && !resumeSkipped.current) setStep('welcome')
      else if (!profile.preferences) setStep('preferences')
      else setStep('dashboard')
    } catch (err) {
      console.error('Failed to load profile:', err)
      setStep('dashboard')
    }
  }

  useEffect(() => {
    if (authenticated) loadOnboardingStep()
  }, [authenticated])

  // Fired from services/api.ts the moment any authenticated request comes
  // back 401 — an expired Cognito access token, most often after the app's
  // been idle a while. Previously this just left whatever page was open
  // showing a raw fetch error with an empty, broken-looking dashboard behind
  // it; now it forces an immediate, explained logout instead.
  useEffect(() => {
    const onSessionExpired = () => {
      setAuthenticated(false)
      setSessionExpired(true)
      resumeSkipped.current = false
      setStep('loading')
    }
    window.addEventListener('auth:session-expired', onSessionExpired)
    return () => window.removeEventListener('auth:session-expired', onSessionExpired)
  }, [])

  const handleSkipResume = () => {
    resumeSkipped.current = true
    setStep('preferences')
  }

  const handleLogout = () => {
    clearTokens()
    setAuthenticated(false)
    resumeSkipped.current = false
    setStep('loading')
  }

  if (!authenticated) {
    return (
      <Login
        sessionExpired={sessionExpired}
        onSuccess={() => {
          setSessionExpired(false)
          setAuthenticated(true)
        }}
      />
    )
  }
  if (step === 'loading') return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  if (step === 'welcome') return <Welcome onUploaded={loadOnboardingStep} onSkip={handleSkipResume} />
  if (step === 'preferences') return <Preferences onDone={loadOnboardingStep} />
  return (
    <BrowserRouter>
      <Dashboard onLogout={handleLogout} />
    </BrowserRouter>
  )
}
