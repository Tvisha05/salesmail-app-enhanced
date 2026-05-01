import { useEffect, useState } from 'react'
import { generateEmail, generateBulkEmails, sendEmails } from '../api/client'

const EMAIL_TYPES = ['upsell', 'follow-up', 'cold outreach', 'promotion', 're-engagement', 'thank-you']
const TONES = ['professional', 'friendly', 'persuasive']

const TYPE_ICONS = {
  'upsell': '⬆️',
  'follow-up': '🔁',
  'cold outreach': '📬',
  'promotion': '🎁',
  're-engagement': '💡',
  'thank-you': '🙏',
}

function EmailComposer({ customer, bulkSelectedIds = [], onGenerate, email, loading, suggestedType, suggestedTone }) {
  const [emailType, setEmailType] = useState('follow-up')
  const [tone, setTone] = useState('professional')

  // Apply AI suggestions when they arrive
  useEffect(() => {
    if (suggestedType && EMAIL_TYPES.includes(suggestedType)) setEmailType(suggestedType)
  }, [suggestedType])
  useEffect(() => {
    if (suggestedTone && TONES.includes(suggestedTone)) setTone(suggestedTone)
  }, [suggestedTone])
  const [copied, setCopied] = useState(false)

  // Bulk state
  const [bulkDrafts, setBulkDrafts] = useState([])
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [expandedDraft, setExpandedDraft] = useState(null)
  const [exportDone, setExportDone] = useState(false)

  // Send emails state — isolated, additive only
  const [sendStatus,  setSendStatus]  = useState('') // '', 'sending', 'success', 'error'
  const [sendMsg,     setSendMsg]     = useState('')
  const [singleSendStatus, setSingleSendStatus] = useState('') // '', 'sending', 'success', 'error'
  const [singleSendMsg, setSingleSendMsg] = useState('')

  const isBulkMode = bulkSelectedIds.length > 1

  // Single mode: need a customer selected
  const canGenerateSingle = Boolean(customer?.customer_id) && !loading && !bulkLoading
  // Bulk mode: need at least two IDs selected
  const canGenerateBulk = bulkSelectedIds.length > 1 && !loading && !bulkLoading

  const handleSingleGenerate = () => {
    if (!customer) return
    setBulkDrafts([])
    onGenerate({ customer_id: customer.customer_id, email_type: emailType, tone })
  }

  const handleBulkGenerate = async () => {
    setBulkLoading(true)
    setBulkError('')
    setBulkDrafts([])
    setExpandedDraft(null)
    try {
      const result = await generateBulkEmails({
        customer_ids: bulkSelectedIds,
        email_type: emailType,
        tone,
      })
      setBulkDrafts(result.drafts || [])
    } catch (err) {
      setBulkError(err.message)
    } finally {
      setBulkLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(email).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(bulkDrafts, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'email_drafts.json'
    a.click()
    setExportDone(true)
    setTimeout(() => setExportDone(false), 2000)
  }

  // Send emails — additive feature, uses same bulkDrafts data already generated
  const handleSendEmails = async () => {
    const successDrafts = bulkDrafts.filter(d => d.status === 'success')
    if (!successDrafts.length) return
    setSendStatus('sending')
    setSendMsg('')
    try {
      const result = await sendEmails(successDrafts)
      setSendStatus('success')
      setSendMsg(result.message || `✓ Sent ${successDrafts.length} email${successDrafts.length !== 1 ? 's' : ''}`)
    } catch (err) {
      setSendStatus('error')
      setSendMsg(`Send failed: ${err.message}`)
    }
  }

  const handleSendSingleEmail = async () => {
    if (!customer?.email || !email?.trim()) return
    setSingleSendStatus('sending')
    setSingleSendMsg('')
    try {
      const result = await sendEmails([{
        customer_email: customer.email,
        customer_name: customer.name || '',
        email: email.trim(),
      }])
      setSingleSendStatus('success')
      setSingleSendMsg(result.message || `✓ Sent 1 email to ${customer.email}`)
    } catch (err) {
      setSingleSendStatus('error')
      setSingleSendMsg(`Send failed: ${err.message}`)
    }
  }

  const isLoading = loading || bulkLoading

  return (
    <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Email Generator</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {isBulkMode
              ? `${bulkSelectedIds.length} customer${bulkSelectedIds.length !== 1 ? 's' : ''} selected — bulk mode active`
              : 'Select a customer, choose type and tone, then generate.'}
          </p>
        </div>
        {isBulkMode && bulkDrafts.length > 0 && (
          <div className="flex items-center gap-2 mt-0.5">
            <button
              onClick={handleExport}
              className="text-xs px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            >
              {exportDone ? '✓ Exported' : '↓ Export JSON'}
            </button>
            <button
              onClick={handleSendEmails}
              disabled={sendStatus === 'sending'}
              className="text-xs px-3 py-1.5 rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendStatus === 'sending' ? 'Sending…' : '✉ Send Live Emails'}
            </button>
          </div>
        )}
      </div>

      <div className="px-5 pt-4 space-y-4">

        {/* Customer display */}
        {!isBulkMode ? (
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
              Selected Customer
            </label>
            <div className={`rounded-lg border px-3 py-2.5 text-sm ${customer
              ? 'border-blue-200 bg-blue-50 text-blue-800'
              : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
              {customer ? (
                <span>
                  <span className="font-semibold">{customer.name}</span>
                  <span className="mx-1.5 text-blue-300">·</span>
                  <span className="text-blue-600">{customer.email}</span>
                  <span className="mx-1.5 text-blue-300">·</span>
                  <span className="font-mono text-xs">#{customer.customer_id}</span>
                </span>
              ) : 'Click a customer in the list to select'}
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
              Selected Customers ({bulkSelectedIds.length})
            </label>
            <div className="flex flex-wrap gap-1.5">
              {bulkSelectedIds.map(id => (
                <span key={id} className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700">
                  #{id}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Type + Tone */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Email Type</label>
            <div className="grid grid-cols-2 gap-1.5">
              {EMAIL_TYPES.map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setEmailType(type)}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium text-left transition capitalize ${
                    emailType === type
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {TYPE_ICONS[type]} {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Tone</label>
            <div className="flex flex-col gap-1.5">
              {TONES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(t)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium text-left transition capitalize ${
                    tone === t
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Generate button */}
        <button
          type="button"
          onClick={isBulkMode ? handleBulkGenerate : handleSingleGenerate}
          disabled={isBulkMode ? !canGenerateBulk : !canGenerateSingle}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              {isBulkMode
                ? `Generating ${bulkSelectedIds.length} email${bulkSelectedIds.length !== 1 ? 's' : ''}…`
                : 'Generating…'}
            </span>
          ) : isBulkMode
            ? `Generate ${bulkSelectedIds.length} Draft${bulkSelectedIds.length !== 1 ? 's' : ''}`
            : 'Generate Email'}
        </button>

        {bulkError && (
          <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{bulkError}</p>
        )}

        {/* Single email output */}
        {!isBulkMode && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Generated Email</label>
              <div className="flex items-center gap-3">
                {email && (
                  <button onClick={handleCopy} className="text-xs text-blue-600 hover:underline">
                    {copied ? '✓ Copied!' : 'Copy'}
                  </button>
                )}
                {customer && (
                  <button
                    type="button"
                    onClick={handleSendSingleEmail}
                    disabled={!customer?.email || !email?.trim() || singleSendStatus === 'sending'}
                    className="text-xs px-2.5 py-1 rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!email?.trim() ? 'Generate email first' : ''}
                  >
                    {singleSendStatus === 'sending' ? 'Sending…' : '✉ Send Live Email'}
                  </button>
                )}
              </div>
            </div>
            <textarea
              className="h-56 w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-700 bg-slate-50 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={email}
              readOnly
              placeholder="Your personalized email will appear here…"
            />
            {singleSendMsg && (
              <p className={`mt-2 text-xs px-3 py-2 rounded-md ${singleSendStatus === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {singleSendMsg}
              </p>
            )}
          </div>
        )}

        {isBulkMode && bulkDrafts.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              {bulkDrafts.length} Draft{bulkDrafts.length !== 1 ? 's' : ''} Preview
            </label>
            <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-96 overflow-auto">
              {bulkDrafts.map((draft, i) => (
                <div key={draft.customer_id} className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setExpandedDraft(expandedDraft === i ? null : i)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${draft.status === 'success' ? 'bg-green-400' : 'bg-red-400'}`} />
                      <span className="text-sm font-medium text-slate-700">
                        {draft.customer_name || `#${draft.customer_id}`}
                      </span>
                      {draft.customer_email && (
                        <span className="text-xs text-slate-400">{draft.customer_email}</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 ml-2">{expandedDraft === i ? '▲' : '▼'}</span>
                  </button>
                  {expandedDraft === i && (
                    <pre className="mt-3 whitespace-pre-wrap text-xs bg-slate-50 rounded-md p-3 text-slate-600 border border-slate-100 font-sans leading-relaxed">
                      {draft.email}
                    </pre>
                  )}
                </div>
              ))}
            </div>
            {/* NEW: send feedback — lightweight, no UI redesign */}
            {sendMsg && (
              <p className={`mt-2 text-xs px-3 py-2 rounded-md ${sendStatus === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {sendMsg}
              </p>
            )}
          </div>
        )}
      </div>
      <div className="h-4" />
    </section>
  )
}

export default EmailComposer
