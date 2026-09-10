import { useEffect, useState } from 'react'
import { isAuthenticated, exchangeCodeForTokens, saveTokens, decodeToken, clearTokens } from './utils/auth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

export default function App() {
  const [authenticated, setAuthenticated] = useState(isAuthenticated())
  const [loading, setLoading] = useState(true)

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
          localStorage.setItem('COGNITO_CLIENT_ID', decoded.aud)
          window.history.replaceState({}, document.title, window.location.pathname)
          setAuthenticated(true)
        } catch (err) {
          console.error('Auth redirect failed:', err)
          setAuthenticated(false)
        }
      }
      setLoading(false)
    }

    handleAuthRedirect()
  }, [])

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  if (!authenticated) return <Login onSuccess={() => setAuthenticated(true)} />
  return <Dashboard onLogout={() => { clearTokens(); setAuthenticated(false); }} />
}
