import { useState } from 'react'
import { generateEmail, generateBulkEmails } from '../api/client'

const EMAIL_TYPES = ['upsell', 'follow-up', 'cold outreach', 'promotion', 're-engagement', 'thank-you']
const TONES = ['professional', 'friendly', 'persuasive']

const TYPE_ICONS = {
  'upsell': '⬆️', 'follow-up': '🔁', 'cold outreach': '📬',
  'promotion': '🎁', 're-engagement': '💡', 'thank-you': '🙏',
}

function EmailWorkspace({ selectedCustomer, bulkSelectedIds, onApiKeyError }) {
  const [emailType, setEmailType] = useState('follow-up')
  const [tone, setTone] = useState('professional')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Single mode state
  const [singleEmail, setSingleEmail] = useState('')
  const [copied, setCopied] = useState(false)

  // Bulk mode state
  const [drafts, setDrafts] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [exportDone, setExportDone] = useState(false)

  // Determine mode: bulk if any checkboxes selected, otherwise single
  const isBulkMode = bulkSelectedIds.length > 0

  const handleError = (msg) => {
    const isKeyErr = msg.includes('ANTHROPIC_API_KEY') || msg.includes('API key') || msg.includes('401') || msg.includes('403')
    if (isKeyErr) { onApiKeyError?.(); return }
    setError(msg)
  }

  const handleSingleGenerate = async () => {
    if (!selectedCustomer) return
    setLoading(true); setError(''); setSingleEmail('')
    try {
      const res = await generateEmail({ customer_id: selectedCustomer.customer_id, email_type: emailType, tone })
      setSingleEmail(res.email || '')
    } catch (err) { handleError(err.message) }
    finally { setLoading(false) }
  }

  const handleBulkGenerate = async () => {
    setLoading(true); setError(''); setDrafts([]); setExpanded(null)
    try {
      const res = await generateBulkEmails({ customer_ids: bulkSelectedIds, email_type: emailType, tone })
      setDrafts(res.drafts || [])
    } catch (err) { handleError(err.message) }
    finally { setLoading(false) }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(singleEmail).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(drafts, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = 'email_drafts.json'; a.click()
    setExportDone(true); setTimeout(() => setExportDone(false), 2000)
  }

  return (
    <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Email Generator</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isBulkMode
                ? `${bulkSelectedIds.length} customers selected — bulk mode`
                : 'Select a customer from the list, choose type and tone, then generate.'}
            </p>
          </div>
          {isBulkMode && drafts.length > 0 && (
            <button onClick={handleExport} className="text-xs px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
              {exportDone ? '✓ Exported' : '↓ Export JSON'}
            </button>
          )}
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Selected customer pill — only in single mode */}
        {!isBulkMode && (
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Selected Customer</label>
            <div className={`rounded-lg border px-3 py-2.5 text-sm ${selectedCustomer ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
              {selectedCustomer ? (
                <span>
                  <span className="font-semibold">{selectedCustomer.name}</span>
                  <span className="mx-1.5 text-blue-300">·</span>
                  <span className="text-blue-600">{selectedCustomer.email}</span>
                  <span className="mx-1.5 text-blue-300">·</span>
                  <span className="font-mono text-xs">#{selectedCustomer.customer_id}</span>
                </span>
              ) : 'Click a customer in the list to select'}
            </div>
          </div>
        )}

        {/* Bulk selected pills */}
        {isBulkMode && (
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Selected Customers</label>
            <div className="flex flex-wrap gap-1.5">
              {bulkSelectedIds.map(id => (
                <span key={id} className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">#{id}</span>
              ))}
            </div>
          </div>
        )}

        {/* Type + Tone selectors */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Email Type</label>
            <div className="grid grid-cols-2 gap-1.5">
              {EMAIL_TYPES.map(type => (
                <button key={type} type="button" onClick={() => setEmailType(type)}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium text-left transition capitalize ${
                    emailType === type ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}>
                  {TYPE_ICONS[type]} {type}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Tone</label>
            <div className="flex flex-col gap-1.5">
              {TONES.map(t => (
                <button key={t} type="button" onClick={() => setTone(t)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium text-left transition capitalize ${
                    tone === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Generate button */}
        <button type="button"
          onClick={isBulkMode ? handleBulkGenerate : handleSingleGenerate}
          disabled={loading || (!isBulkMode && !selectedCustomer)}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              {isBulkMode ? `Generating ${bulkSelectedIds.length} emails…` : 'Generating…'}
            </span>
          ) : isBulkMode
            ? `Generate ${bulkSelectedIds.length} Draft${bulkSelectedIds.length !== 1 ? 's' : ''}`
            : 'Generate Email'}
        </button>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}

        {/* Single email output */}
        {!isBulkMode && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Generated Email</label>
              {singleEmail && (
                <button onClick={handleCopy} className="text-xs text-blue-600 hover:underline">
                  {copied ? '✓ Copied!' : 'Copy'}
                </button>
              )}
            </div>
            <textarea
              className="h-56 w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-700 bg-slate-50 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={singleEmail} readOnly
              placeholder="Your personalized email will appear here…"
            />
          </div>
        )}

        {/* Bulk draft previews */}
        {isBulkMode && drafts.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              {drafts.length} Draft{drafts.length !== 1 ? 's' : ''} Preview
            </label>
            <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-96 overflow-auto">
              {drafts.map((draft, i) => (
                <div key={draft.customer_id} className="px-4 py-3">
                  <button type="button" onClick={() => setExpanded(expanded === i ? null : i)}
                    className="w-full flex items-center justify-between text-left">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${draft.status === 'success' ? 'bg-green-400' : 'bg-red-400'}`}/>
                      <span className="text-sm font-medium text-slate-700">{draft.customer_name || `#${draft.customer_id}`}</span>
                      {draft.customer_email && <span className="text-xs text-slate-400">{draft.customer_email}</span>}
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
      </div>
      <div className="h-2"/>
    </section>
  )
}

export default EmailWorkspace
