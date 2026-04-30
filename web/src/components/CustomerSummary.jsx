import { useEffect, useState } from 'react'
import { fetchCustomerSummary } from '../api/client'

const TYPE_ICONS = {
  'upsell': '⬆️', 'follow-up': '🔁', 'cold outreach': '📬',
  'promotion': '🎁', 're-engagement': '💡', 'thank-you': '🙏',
}
const TONE_ICONS = { 'professional': '💼', 'friendly': '😊', 'persuasive': '🎯' }
const TIER_COLORS = {
  'high-value':  'bg-purple-50 border-purple-200 text-purple-800',
  'mid-value':   'bg-blue-50 border-blue-200 text-blue-800',
  'entry-level': 'bg-slate-50 border-slate-200 text-slate-700',
  'unknown':     'bg-slate-50 border-slate-200 text-slate-500',
}

function CustomerSummary({ customer, onSuggest }) {
  const [summary, setSummary]   = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    if (!customer?.customer_id) { setSummary(null); return }
    let cancelled = false
    setLoading(true); setError(''); setSummary(null)

    fetchCustomerSummary(customer.customer_id)
      .then(data => { if (!cancelled) setSummary(data) })
      .catch(err  => { if (!cancelled) setError(err.message) })
      .finally(()  => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [customer?.customer_id])

  if (!customer) return null

  return (
    <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800">Customer Intelligence</h2>
        {summary?.source && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
            {summary.source === 'llm' ? '✨ AI' : '⚙️ Rule-based'}
          </span>
        )}
      </div>

      <div className="px-5 py-4">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Analysing customer…
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500 bg-red-50 rounded px-3 py-2">{error}</p>
        )}

        {summary && !loading && (
          <div className="space-y-3">
            {/* Value tier badge */}
            <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${TIER_COLORS[summary.value_tier] || TIER_COLORS.unknown}`}>
              {summary.value_tier?.replace('-', ' ').toUpperCase() || 'CUSTOMER'} TIER
            </div>

            {/* Summary */}
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Summary</p>
              <p className="text-sm text-slate-700 leading-relaxed">{summary.summary}</p>
            </div>

            {/* Sales opportunity */}
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Sales Opportunity</p>
              <p className="text-sm text-slate-700 leading-relaxed">{summary.sales_opportunity}</p>
            </div>

            {/* Recommendations */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
                <p className="text-xs text-blue-500 font-medium mb-0.5">Recommended Type</p>
                <p className="text-sm font-semibold text-blue-800 capitalize">
                  {TYPE_ICONS[summary.recommended_email_type] || '📧'} {summary.recommended_email_type}
                </p>
              </div>
              <div className="rounded-lg bg-green-50 border border-green-100 px-3 py-2">
                <p className="text-xs text-green-500 font-medium mb-0.5">Suggested Tone</p>
                <p className="text-sm font-semibold text-green-800 capitalize">
                  {TONE_ICONS[summary.suggested_tone] || '🗣️'} {summary.suggested_tone}
                </p>
              </div>
            </div>

            {/* Apply suggestions button */}
            {onSuggest && (
              <button
                type="button"
                onClick={() => onSuggest(summary.recommended_email_type, summary.suggested_tone)}
                className="w-full rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100 transition"
              >
                ✦ Apply AI Suggestions to Email Generator
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

export default CustomerSummary
