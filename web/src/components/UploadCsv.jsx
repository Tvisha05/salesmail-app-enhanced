import { useRef } from 'react'

function UploadCsv({ onUpload, loading }) {
  const fileRef = useRef(null)

  const handleSubmit = async (event) => {
    event.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) {
      return
    }
    await onUpload(file)
    event.target.reset()
  }

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-lg font-semibold">Upload Customers CSV</h2>
      <p className="mt-1 text-sm text-slate-600">
        Upload the latest customer history to power personalized email generation.
      </p>
      <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          disabled={loading}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Uploading...' : 'Upload'}
        </button>
      </form>
    </section>
  )
}

export default UploadCsv
