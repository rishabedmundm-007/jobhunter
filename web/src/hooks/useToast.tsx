import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

type ToastKind = 'success' | 'error'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const KIND_STYLES: Record<ToastKind, { border: string; dot: string }> = {
  success: { border: 'border-emerald-200 dark:border-emerald-500/30', dot: 'bg-emerald-500' },
  error: { border: 'border-red-200 dark:border-red-500/30', dot: 'bg-red-500' },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++
    setToasts(prev => [...prev, { id, kind, message }])
    window.setTimeout(() => dismiss(id), 4000)
  }, [dismiss])

  const api: ToastApi = {
    success: (message: string) => push('success', message),
    error: (message: string) => push('error', message),
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
        <AnimatePresence>
          {toasts.map(t => {
            const style = KIND_STYLES[t.kind]
            return (
              <motion.div
                key={t.id}
                role="status"
                aria-live={t.kind === 'error' ? 'assertive' : 'polite'}
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className={`glass-solid pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border ${style.border} px-4 py-3 shadow-lg`}
              >
                <span className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${style.dot}`} aria-hidden="true" />
                <p className="flex-1 text-sm text-slate-800 dark:text-slate-200">{t.message}</p>
                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss notification"
                  className="rounded text-slate-400 dark:text-slate-500 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  ✕
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
