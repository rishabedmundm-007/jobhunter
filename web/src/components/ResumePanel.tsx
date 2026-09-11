import { useEffect, useRef, useState } from 'react'
import { profileApi } from '../services/api'
import { useToast } from '../hooks/useToast'
import { Resume } from '../types'

// .doc (legacy binary Word format) isn't accepted — the backend can't extract
// text from it for matching/tailoring, only from PDF/.docx.
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])
const MAX_BYTES = 10 * 1024 * 1024

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Inline content only — no modal chrome. Meant to be dropped into an animated
// expand/collapse wrapper (see NavDrawer) so it opens fluidly in place rather
// than jumping to a separate overlay.
export default function ResumePanel() {
  const [resume, setResume] = useState<Resume | null>(null)
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  useEffect(() => {
    profileApi.getProfile()
      .then(p => setResume(p.resume))
      .catch(() => toast.error('Failed to load your resume'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pickFile = (candidate: File) => {
    if (!ALLOWED_TYPES.has(candidate.type)) {
      setFileError('Please upload a PDF or Word document (.pdf or .docx).')
      return
    }
    if (candidate.size > MAX_BYTES) {
      setFileError('That file is too large — max 10MB.')
      return
    }
    setFileError(null)
    handleUpload(candidate)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) pickFile(dropped)
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const { resume: updated } = await profileApi.uploadResume(file)
      setResume(updated)
      toast.success('Resume replaced')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload resume')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="px-3 pb-3 pt-1">
      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : resume ? (
        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{resume.filename}</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {formatSize(resume.size)} · uploaded {new Date(resume.uploaded_at).toLocaleDateString()}
          </div>
          {resume.download_url && (
            <a
              href={resume.download_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Download ↗
            </a>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">No resume on file yet.</p>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !uploading) inputRef.current?.click() }}
        aria-label="Replace resume, drag and drop or click to browse"
        className={`mt-3 cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition ${
          dragging ? 'border-indigo-500 bg-indigo-50/60' : 'border-slate-300 dark:border-slate-600 bg-white/40 dark:bg-white/5 hover:border-indigo-300'
        } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f) }}
        />
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          {uploading ? 'Uploading…' : resume ? 'Replace Resume' : 'Upload Resume'}
        </div>
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Drag &amp; drop or click to browse
        </div>
      </div>

      {fileError && (
        <div role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {fileError}
        </div>
      )}
    </div>
  )
}
