import { useEffect, useState } from 'react'
import { searchCustomers, fetchCategories, fetchSegments } from '../api/client'

const PAGE_SIZE = 50

const SEGMENT_LABELS = {
  'high-value': { label: 'High Value', color: 'bg-purple-100 text-purple-700' },
  'active': { label: 'Active', color: 'bg-green-100 text-green-700' },
  'inactive': { label: 'Inactive', color: 'bg-red-100 text-red-700' },
  'recent-buyer': { label: 'Recent Buyer', color: 'bg-blue-100 text-blue-700' },
}

function Badge({ segment }) {
  const s = SEGMENT_LABELS[segment] || { label: segment, color: 'bg-slate-100 text-slate-600' }
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}>{s.label}</span>
}

function CustomerList({ customers: allCustomers, selectedCustomerId, onSelect, loading, onBulkSelect }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [segment, setSegment] = useState('')
  const [categories, setCategories] = useState([])
  const [segments, setSegments] = useState({})
  const [filtered, setFiltered] = useState(allCustomers)
  const [searching, setSearching] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {})
    fetchSegments().then(setSegments).catch(() => {})
  }, [allCustomers])

  useEffect(() => {
    setFiltered(allCustomers)
  }, [allCustomers])

  useEffect(() => {
    setPage(1)
  }, [allCustomers])

  const handleSearch = async () => {
    setSearching(true)
    setSelectedIds(new Set())
    try {
      // Always call the single unified search endpoint with ALL active filters simultaneously
      const rows = await searchCustomers({
        q: query.trim() || undefined,
        category: category || undefined,
        segment: segment || undefined,
        minAmount: minAmount ? Number(minAmount) : undefined,
        maxAmount: maxAmount ? Number(maxAmount) : undefined,
      })
      setFiltered(rows)
      setPage(1)
    } catch {
      setFiltered([])
      setPage(1)
    } finally {
      setSearching(false)
    }
  }

  const handleReset = () => {
    setQuery(''); setCategory(''); setMinAmount(''); setMaxAmount(''); setSegment('')
    setFiltered(allCustomers); setSelectedIds(new Set())
    setPage(1)
  }

  const toggleSelect = (id, e) => {
    e.stopPropagation()
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE)

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const toggleSelectAll = () => {
    const pageIds = pageRows.map(c => c.customer_id)
    const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allPageSelected) {
        pageIds.forEach(id => next.delete(id))
      } else {
        pageIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  useEffect(() => {
    if (onBulkSelect) onBulkSelect(Array.from(selectedIds))
  }, [selectedIds])

  return (
    <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
      <div className="px-5 pt-5 pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-800">Customers</h2>
          <div className="flex items-center gap-2">
            {loading || searching ? <span className="text-xs text-slate-400">Loading...</span> : null}
            <button
              onClick={() => setShowFilters(f => !f)}
              className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            >
              {showFilters ? 'Hide Filters' : 'Filters'}
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search by ID, name, or email…"
            className="flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 transition"
          >
            Search
          </button>
          <button
            onClick={handleReset}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition"
          >
            Reset
          </button>
        </div>

        {/* Expandable filters */}
        {showFilters && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Segment</label>
              <select
                value={segment}
                onChange={e => setSegment(e.target.value)}
                className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All segments</option>
                {Object.entries(segments).map(([k, count]) => (
                  <option key={k} value={k}>{SEGMENT_LABELS[k]?.label || k} ({count})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Min Amount (₹)</label>
              <input
                type="number"
                value={minAmount}
                onChange={e => setMinAmount(e.target.value)}
                placeholder="0"
                className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Max Amount (₹)</label>
              <input
                type="number"
                value={maxAmount}
                onChange={e => setMaxAmount(e.target.value)}
                placeholder="∞"
                className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <button
                onClick={handleSearch}
                className="w-full rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 transition"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk select bar */}
      {selectedIds.size > 0 && (
        <div className="px-5 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between text-sm">
          <span className="text-blue-700 font-medium">{selectedIds.size} selected</span>
          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-blue-500 hover:underline">Clear</button>
        </div>
      )}

      <div className="max-h-72 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  checked={pageRows.length > 0 && pageRows.every(c => selectedIds.has(c.customer_id))}
                  onChange={toggleSelectAll}
                  className="rounded"
                />
              </th>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2 hidden md:table-cell">Category</th>
              <th className="px-3 py-2 hidden md:table-cell">Amount</th>
              <th className="px-3 py-2 hidden lg:table-cell">Segment</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-slate-400 text-center" colSpan={6}>
                  {loading ? 'Loading customers…' : 'No customers found.'}
                </td>
              </tr>
            ) : (
              pageRows.map(customer => (
                <tr
                  key={customer.customer_id}
                  onClick={() => onSelect(customer)}
                  className={`cursor-pointer border-t border-slate-100 transition-colors ${
                    selectedCustomerId === customer.customer_id
                      ? 'bg-blue-50'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(customer.customer_id)}
                      onChange={e => toggleSelect(customer.customer_id, e)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-500 font-mono text-xs">{customer.customer_id}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{customer.name}</td>
                  <td className="px-3 py-2 text-slate-500 hidden md:table-cell">{customer.category}</td>
                  <td className="px-3 py-2 text-slate-600 hidden md:table-cell">
                    {customer.amount ? `₹${Number(customer.amount).toLocaleString()}` : '—'}
                  </td>
                  <td className="px-3 py-2 hidden lg:table-cell">
                    {customer.segment && <Badge segment={customer.segment} />}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-2 border-t border-slate-100 text-xs text-slate-400">
        <div className="flex items-center justify-between gap-2">
          <span>
            Showing {filtered.length === 0 ? 0 : pageStart + 1}-{Math.min(pageStart + pageRows.length, filtered.length)} of {filtered.length} customer{filtered.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev
            </button>
            <span>Page {currentPage} / {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default CustomerList
