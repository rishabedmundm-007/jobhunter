import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { profileApi } from '../services/api'
import { useToast } from '../hooks/useToast'
import FluidBackground from '../components/FluidBackground'

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])
const MAX_BYTES = 10 * 1024 * 1024

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function Welcome({ onUploaded, onSkip }: { onUploaded: () => void; onSkip: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const pickFile = (candidate: File) => {
    if (!ALLOWED_TYPES.has(candidate.type)) {
      setFileError('Please upload a PDF or Word document (.pdf, .doc, .docx).')
      return
    }
    if (candidate.size > MAX_BYTES) {
      setFileError('That file is too large — max 10MB.')
      return
    }
    setFileError(null)
    setFile(candidate)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) pickFile(dropped)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    try {
      await profileApi.uploadResume(file)
      toast.success('Resume uploaded — you\'re all set')
      onUploaded()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload resume')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <FluidBackground />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="glass-solid w-full max-w-lg rounded-3xl p-10 text-center shadow-[0_20px_70px_-15px_rgba(99,102,241,0.35)]"
      >
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.5, ease: 'backOut' }}
          className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700 shadow-lg shadow-indigo-500/30"
        >
          <span className="font-display text-2xl font-extrabold text-white">J</span>
        </motion.div>

        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink dark:text-white">
          Welcome to JobHunter
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600 dark:text-slate-400">
          Upload your resume so we can tailor applications and keep everything in one place.
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
          aria-label="Upload resume, drag and drop or click to browse"
          className={`mt-8 cursor-pointer rounded-2xl border-2 border-dashed p-8 transition ${
            dragging ? 'border-indigo-500 bg-indigo-50/60' : 'border-slate-300 dark:border-slate-600 bg-white/40 dark:bg-white/5 hover:border-indigo-300'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f) }}
          />
          {file ? (
            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-200">{file.name}</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatSize(file.size)} · click to change</div>
            </div>
          ) : (
            <div>
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600" aria-hidden="true">
                ↑
              </div>
              <div className="font-semibold text-slate-700 dark:text-slate-300">Drag &amp; drop your resume here</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">or click to browse · PDF or Word, up to 10MB</div>
            </div>
          )}
        </div>

        {fileError && (
          <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {fileError}
          </div>
        )}

        <motion.button
          onClick={handleUpload}
          disabled={!file || uploading}
          whileHover={file && !uploading ? { scale: 1.02 } : undefined}
          whileTap={file && !uploading ? { scale: 0.98 } : undefined}
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/30 transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          {uploading ? 'Uploading…' : 'Upload Resume'}
        </motion.button>

        <button
          onClick={onSkip}
          disabled={uploading}
          className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400 underline-offset-2 hover:text-slate-700 hover:underline disabled:opacity-50"
        >
          Skip for now
        </button>
      </motion.div>
    </div>
  )
}
