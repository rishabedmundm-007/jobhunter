import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'theme'

// Always starts in light mode. If the user switches to dark, that choice
// is kept only for the current tab session (sessionStorage) — a fresh
// visit always begins in light mode again.
function getInitialTheme(): boolean {
  return sessionStorage.getItem(STORAGE_KEY) === 'dark'
}

export function useDarkMode(): [boolean, () => void] {
  const [isDark, setIsDark] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  const toggle = useCallback(() => {
    setIsDark(prev => {
      const next = !prev
      sessionStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light')
      return next
    })
  }, [])

  return [isDark, toggle]
}
