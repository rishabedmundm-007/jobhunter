import { useEffect, useRef, useState } from 'react'
import { isAuthenticated, exchangeCodeForTokens, saveTokens, decodeToken, clearTokens } from './utils/auth'
import { profileApi } from './services/api'
import Login from './pages/Login'
import Welcome from './pages/Welcome'
import Preferences from './pages/Preferences'
import Dashboard from './pages/Dashboard'

type Step = 'loading' | 'welcome' | 'preferences' | 'dashboard'

export default function App() {
  const [authenticated, setAuthenticated] = useState(isAuthenticated())
  const [authLoading, setAuthLoading] = useState(true)
  const [step, setStep] = useState<Step>('loading')
  // Skipping the resume step is a session-only choice — it isn't persisted,
  // so it shouldn't send the user back to Welcome once they've moved past it.
  const resumeSkipped = useRef(false)

  useEffect(() => {
    const handleAuthRedirect = async () => {
      const params = new URLSearchParams(window.location.search)
      if (params.has('code')) {
        try {
          const code = params.get('code')!
          const tokens = await exchangeCodeForTokens(code)
          saveTokens(tokens)
          const decoded = decodeToken(tokens.id_token)
          localStorage.setItem('user_sub', decoded.sub)
          if (decoded.email) localStorage.setItem('user_email', decoded.email)
          window.history.replaceState({}, document.title, window.location.pathname)
          setAuthenticated(true)
        } catch (err) {
          console.error('Auth redirect failed:', err)
          setAuthenticated(false)
        }
      }
      setAuthLoading(false)
    }

    handleAuthRedirect()
  }, [])

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
    if (!authLoading && authenticated) loadOnboardingStep()
  }, [authLoading, authenticated])

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

  if (authLoading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  if (!authenticated) return <Login onSuccess={() => setAuthenticated(true)} />
  if (step === 'loading') return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  if (step === 'welcome') return <Welcome onUploaded={loadOnboardingStep} onSkip={handleSkipResume} />
  if (step === 'preferences') return <Preferences onDone={loadOnboardingStep} />
  return <Dashboard onLogout={handleLogout} />
}
