import { useState } from 'react'

function OpenAIKeySetup({ onSave, loading }) {
  const [apiKey, setApiKey] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    await onSave(apiKey)
    setApiKey('')
  }

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <h2 className="text-base font-semibold text-amber-900">Connect API Key</h2>
      <p className="mt-1 text-sm text-amber-800">
        Enter your <strong>Google AI</strong> key (<code className="bg-amber-100 px-1 rounded">AIza...</code>) or <strong>OpenAI</strong> key (<code className="bg-amber-100 px-1 rounded">sk-...</code>).
        It will be saved to your local <code className="bg-amber-100 px-1 rounded">.env</code> automatically.
      </p>
      <form className="mt-3 flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder="AIza... or sk-..."
          className="w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          required
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-500 disabled:opacity-60 whitespace-nowrap"
        >
          {loading ? 'Saving…' : 'Save Key'}
        </button>
      </form>
    </section>
  )
}

export default OpenAIKeySetup
