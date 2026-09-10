import { useState } from 'react'

export default function CreateJobModal({ onClose, onCreate }: { onClose: () => void; onCreate: (input: any) => void }) {
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [link, setLink] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !company.trim()) {
      alert('Title and company are required')
      return
    }
    setLoading(true)
    try {
      await onCreate({ title: title.trim(), company: company.trim(), link: link.trim() || undefined })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-2xl w-96">
        <h2 className="text-2xl font-bold mb-6 text-gray-900">Add New Job</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Job Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={loading} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., Senior Engineer" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Company *</label>
            <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} required disabled={loading} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., Google" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Job Link</label>
            <input type="url" value={link} onChange={(e) => setLink(e.target.value)} disabled={loading} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://..." />
          </div>
          <div className="flex gap-3 justify-end pt-4">
            <button type="button" onClick={onClose} disabled={loading} className="px-6 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 font-semibold transition disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition disabled:opacity-50">{loading ? 'Creating...' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
