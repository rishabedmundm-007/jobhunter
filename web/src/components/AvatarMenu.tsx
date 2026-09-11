import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ContactInfo } from '../types'
import { profileApi } from '../services/api'
import { useToast } from '../hooks/useToast'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 5 * 1024 * 1024

function initialsOf(contact: ContactInfo | null): string {
  if (!contact) return '?'
  return `${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`.toUpperCase() || '?'
}

export default function AvatarMenu({
  contact,
  onAvatarUploaded,
  onLogout,
}: {
  contact: ContactInfo | null
  onAvatarUploaded: (contact: ContactInfo) => void
  onLogout: () => void
}) {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const handleFile = async (file: File) => {
    if (!ALLOWED_TYPES.has(file.type)) {
      toast.error('Please upload a JPEG, PNG, or WebP image.')
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error('That image is too large — max 5MB.')
      return
    }
    setUploading(true)
    try {
      const { contact: updated } = await profileApi.uploadAvatar(file)
      onAvatarUploaded(updated)
      toast.success('Photo updated')
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload photo')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="h-9 w-9 overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700 shadow shadow-indigo-500/30 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
      >
        {contact?.avatar_url ? (
          <img src={contact.avatar_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs font-bold text-white">
            {initialsOf(contact)}
          </span>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="glass-solid absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-xl p-1.5 shadow-xl"
          >
            {contact && (
              <div className="border-b border-slate-100 dark:border-slate-700 px-3 py-2">
                <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {contact.first_name} {contact.last_name}
                </div>
                <div className="truncate text-xs text-slate-500 dark:text-slate-400">{contact.email}</div>
              </div>
            )}
            <button
              role="menuitem"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200 transition hover:bg-indigo-50 dark:hover:bg-white/10 disabled:opacity-50"
            >
              <span aria-hidden="true">📷</span>
              {uploading ? 'Uploading…' : 'Upload Photo'}
            </button>
            <button
              role="menuitem"
              onClick={onLogout}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              <span aria-hidden="true">↪</span>
              Logout
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
