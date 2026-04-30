import { useEffect, useState } from 'react'
import { fetchCustomers, generateEmail, saveOpenAIKey, uploadCsv } from './api/client'
import CustomerList    from './components/CustomerList'
import EmailComposer   from './components/EmailComposer'
import CustomerSummary from './components/CustomerSummary'
import OpenAIKeySetup  from './components/OpenAIKeySetup'

function App() {
  const [customers,       setCustomers]       = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [generatedEmail,  setGeneratedEmail]  = useState('')
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [generatingEmail, setGeneratingEmail] = useState(false)
  const [savingKey,       setSavingKey]       = useState(false)
  const [error,           setError]           = useState('')
  const [apiKeyError,     setApiKeyError]     = useState(false)
  const [bulkSelectedIds, setBulkSelectedIds] = useState([])
  // AI suggestions propagated from CustomerSummary → EmailComposer
  const [suggestedType,   setSuggestedType]   = useState(null)
  const [suggestedTone,   setSuggestedTone]   = useState(null)

  // CSV upload state — isolated, does not affect existing defaults
  const [uploadedFile,    setUploadedFile]    = useState(null)
  const [csvUploadMsg,    setCsvUploadMsg]    = useState('')
  const [csvUploading,    setCsvUploading]    = useState(false)

  const loadCustomers = async () => {
    setError('')
    try {
      const rows = await fetchCustomers()
      setCustomers(rows)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingCustomers(false)
    }
  }

  useEffect(() => { loadCustomers() }, [])

  const handleSelectCustomer = (c) => {
    setSelectedCustomer(c)
    setGeneratedEmail('')
    setSuggestedType(null)
    setSuggestedTone(null)
  }

  const handleGenerate = async (payload) => {
    setGeneratingEmail(true)
    setError('')
    setApiKeyError(false)
    try {
      const response = await generateEmail(payload)
      setGeneratedEmail(response.email || '')
    } catch (err) {
      setGeneratedEmail('')
      const msg = err.message || ''
      const isKeyErr = msg.toLowerCase().includes('api key') ||
        msg.includes('GOOGLE_API_KEY') || msg.includes('OPENAI_API_KEY')
      if (isKeyErr) setApiKeyError(true)
      else setError(msg)
    } finally {
      setGeneratingEmail(false)
    }
  }

  const handleSaveKey = async (apiKey) => {
    setSavingKey(true); setError('')
    try {
      await saveOpenAIKey(apiKey)
      setApiKeyError(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingKey(false)
    }
  }

  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setCsvUploadMsg('Invalid file type. Please upload a .csv file.')
      e.target.value = ''
      return
    }
    setCsvUploading(true)
    setCsvUploadMsg('')
    try {
      const result = await uploadCsv(file)
      setUploadedFile(file.name)
      setCsvUploadMsg(`✓ Loaded ${result.rows_imported ?? ''} customers from ${file.name}`)
      // Reload customer list from the newly uploaded data
      await loadCustomers()
    } catch (err) {
      setCsvUploadMsg(`Upload failed: ${err.message}`)
      setUploadedFile(null)
    } finally {
      setCsvUploading(false)
      e.target.value = ''
    }
  }

  const handleSuggest = (type, tone) => {
    setSuggestedType(type)
    setSuggestedTone(tone)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">

        {/* Header */}
        <header className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">SalesMail AI</h1>
            <p className="mt-0.5 text-sm text-slate-500">AI-powered personalized email generation for sales teams.</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 mt-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 ring-1 ring-green-200">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />Live
            </span>
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
            <span>⚠️</span><span>{error}</span>
          </div>
        )}
        {apiKeyError && (
          <div className="mb-4">
            <OpenAIKeySetup onSave={handleSaveKey} loading={savingKey} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">

          {/* Left panel — customer list only (no upload) */}
          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-700">Customers CSV</span>
                <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 transition">
                  {csvUploading ? 'Uploading…' : (uploadedFile ? `📄 ${uploadedFile}` : '↑ Upload CSV')}
                  <input
                    type="file"
                    accept=".csv"
                    className="sr-only"
                    disabled={csvUploading}
                    onChange={handleCsvUpload}
                  />
                </label>
              </div>
              {csvUploadMsg && (
                <p className={`mt-2 text-xs ${csvUploadMsg.startsWith('✓') ? 'text-green-700' : 'text-red-600'}`}>
                  {csvUploadMsg}
                </p>
              )}
            </div>
            <CustomerList
              customers={customers}
              selectedCustomerId={selectedCustomer?.customer_id}
              onSelect={handleSelectCustomer}
              loading={loadingCustomers}
              onBulkSelect={setBulkSelectedIds}
            />
            {/* Customer intelligence panel — only when a customer is selected */}
            <CustomerSummary
              customer={selectedCustomer}
              onSuggest={handleSuggest}
            />
          </div>

          {/* Right panel */}
          <div className="lg:col-span-3">
            <EmailComposer
              customer={selectedCustomer}
              bulkSelectedIds={bulkSelectedIds}
              onGenerate={handleGenerate}
              email={generatedEmail}
              loading={generatingEmail}
              suggestedType={suggestedType}
              suggestedTone={suggestedTone}
            />
          </div>
        </div>

      </div>
    </div>
  )
}

export default App
