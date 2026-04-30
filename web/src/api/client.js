const API_BASE = '/api'

async function handleResponse(res) {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.detail || body.error || 'Request failed')
  return body
}

export async function fetchCustomers() {
  const res = await fetch(`${API_BASE}/customers/`)
  const data = await handleResponse(res)
  return data.customers || []
}

export async function fetchCustomerSummary(customerId) {
  const res = await fetch(`${API_BASE}/customers/${encodeURIComponent(customerId)}/summary`)
  return handleResponse(res)
}

export async function searchCustomers({ q, category, segment, minAmount, maxAmount, interactionAfter, interactionBefore } = {}) {
  const p = new URLSearchParams()
  if (q)                p.set('q', q)
  if (category)         p.set('category', category)
  if (segment)          p.set('segment', segment)
  if (minAmount != null) p.set('min_amount', minAmount)
  if (maxAmount != null) p.set('max_amount', maxAmount)
  if (interactionAfter)  p.set('interaction_after', interactionAfter)
  if (interactionBefore) p.set('interaction_before', interactionBefore)
  const res  = await fetch(`${API_BASE}/customers/search/?${p}`)
  const data = await handleResponse(res)
  return data.customers || []
}

export async function fetchCategories() {
  const res  = await fetch(`${API_BASE}/customers/categories/`)
  const data = await handleResponse(res)
  return data.categories || []
}

export async function fetchSegments() {
  const res  = await fetch(`${API_BASE}/segments/`)
  const data = await handleResponse(res)
  return data.segments || {}
}

export async function fetchCustomersBySegment(segment) {
  const res  = await fetch(`${API_BASE}/segments/${encodeURIComponent(segment)}/customers/`)
  const data = await handleResponse(res)
  return data.customers || []
}

export async function generateEmail(payload) {
  const res = await fetch(`${API_BASE}/generate-email/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function generateBulkEmails(payload) {
  const res = await fetch(`${API_BASE}/generate-email/bulk/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function saveOpenAIKey(apiKey) {
  const res = await fetch(`${API_BASE}/settings/openai-key/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey }),
  })
  return handleResponse(res)
}

// ── CSV Upload ────────────────────────────────────────────────────────────────
// Uploads a CSV file to the backend; backend overwrites the active dataset.
export async function uploadCsv(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}/customers/upload-csv/`, {
    method: 'POST',
    body: form,
  })
  return handleResponse(res)
}

// ── Email Sending ─────────────────────────────────────────────────────────────
// Sends pre-generated email drafts via the backend /send-email/ endpoint.
// payload: { drafts: [{ customer_email, customer_name, email }] }
export async function sendEmails(drafts) {
  const res = await fetch(`${API_BASE}/send-email/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drafts }),
  })
  return handleResponse(res)
}
