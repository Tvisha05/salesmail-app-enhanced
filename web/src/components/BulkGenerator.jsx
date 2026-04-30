import { useState } from 'react'
import { generateBulkEmails } from '../api/client'

const EMAIL_TYPES = ['upsell', 'follow-up', 'cold outreach', 'promotion', 're-engagement', 'thank-you']
const TONES = ['professional', 'friendly', 'persuasive']

function BulkGenerator({ selectedIds }) {
  const [emailType, setEmailType] = useState(EMAIL_TYPES[0])
  const [tone, setTone] = useState(TONES[0])
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [exportDone, setExportDone] = useState(false)

  const canGenerate = selectedIds.length > 0 && !loading

  const handleBulkGenerate = async () => {
    setLoading(true)
    setError('')
    setDrafts([])
    setExpanded(null)
    try {
      const result = await generateBulkEmails({
        customer_ids: selectedIds,
        email_type: emailType,
        tone,
      })
      setDrafts(result.drafts || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    const data = JSON.stringify(drafts, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'email_drafts.json'; a.click()
    URL.revokeObjectURL(url)
    setExportDone(true)
    setTimeout(() => setExportDone(false), 2000)
  }

  if (selectedIds.length === 0 && drafts.length === 0) return null

  return (
    <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Bulk Email Generator</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {selectedIds.length > 0
              ? `${selectedIds.length} customer${selectedIds.length !== 1 ? 's' : ''} selected`
              : 'Select customers in the list above'}
          </p>
        </div>
        {drafts.length > 0 && (
          <button
            onClick={handleExport}
            className="text-xs px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
          >
            {exportDone ? '✓ Exported' : '↓ Export JSON'}
          </button>
        )}
      </div>

      <div className="px-5 py-4 space-y-3">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">Email Type</label>
            <select
              value={emailType}
              onChange={e => setEmailType(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {EMAIL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">Tone</label>
            <select
              value={tone}
              onChange={e => setTone(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TONES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleBulkGenerate}
          disabled={!canGenerate}
          className="w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? `Generating ${selectedIds.length} emails…`
            : `Generate ${selectedIds.length} Draft${selectedIds.length !== 1 ? 's' : ''}`}
        </button>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
        )}
      </div>

      {/* Draft previews */}
      {drafts.length > 0 && (
        <div className="border-t border-slate-100">
          <div className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
            {drafts.length} Draft{drafts.length !== 1 ? 's' : ''} Preview
          </div>
          <div className="max-h-96 overflow-auto divide-y divide-slate-100">
            {drafts.map((draft, i) => (
              <div key={draft.customer_id} className="px-5 py-3">
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === i ? null : i)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${draft.status === 'success' ? 'bg-green-400' : 'bg-red-400'}`} />
                    <span className="text-sm font-medium text-slate-700">{draft.customer_name || `#${draft.customer_id}`}</span>
                    {draft.customer_email && (
                      <span className="text-xs text-slate-400">{draft.customer_email}</span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 ml-2">{expanded === i ? '▲' : '▼'}</span>
                </button>
                {expanded === i && (
                  <pre className="mt-3 whitespace-pre-wrap text-xs bg-slate-50 rounded-md p-3 text-slate-600 border border-slate-100 font-sans leading-relaxed">
                    {draft.email}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export default BulkGenerator
