import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../../lib/api'
import { supabase } from '../../../lib/supabase'
import {
  CONDITIONS,
  COPY_STATUSES,
  copyShelf,
  downloadCsv,
  formatDateTime,
  printBarcodeLabels,
  statusLabel,
  statusTone,
} from './booksUtils'

const PAGE_SIZE = 25
const SORT_OPTIONS = [
  { value: 'created_desc', label: 'Sort: Newest' },
  { value: 'barcode_asc', label: 'Sort: Barcode A→Z' },
  { value: 'status_asc', label: 'Sort: Status' },
]

export function CopiesTab({ focusBookId, onClearFocus }) {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [condition, setCondition] = useState('all')
  const [shelf, setShelf] = useState('all')
  const [shelves, setShelves] = useState([])
  const [sort, setSort] = useState('created_desc')
  const [selectedId, setSelectedId] = useState(null)
  const [checked, setChecked] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState(null)
  const [targetStatus, setTargetStatus] = useState('available')
  const [reason, setReason] = useState('')
  const [destinationShelf, setDestinationShelf] = useState('')
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState([])
  const [refreshToken, setRefreshToken] = useState(0)

  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId])

  useEffect(() => {
    if (focusBookId) {
      setSearchInput('')
      setSearch('')
      setPage(1)
    }
  }, [focusBookId])

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 250)
    return () => clearTimeout(handle)
  }, [searchInput])

  const resolveBookIds = useCallback(async (needle) => {
    if (!needle) return []
    const { data } = await supabase
      .from('books')
      .select('id')
      .or(`title.ilike.%${needle}%,isbn13.ilike.%${needle}%,isbn10.ilike.%${needle}%`)
      .limit(200)
    return (data ?? []).map((book) => book.id)
  }, [])

  const loadCopies = useCallback(async () => {
    setLoading(true)
    try {
      const bookIds = await resolveBookIds(search)
      const orParts = []
      if (search) {
        orParts.push(`barcode.ilike.%${search}%`)
        if (bookIds.length > 0) orParts.push(`book_id.in.(${bookIds.join(',')})`)
      }
      if (focusBookId) orParts.push(`book_id.eq.${focusBookId}`)

      let query = supabase
        .from('copies')
        .select('*, books(id, title, authors, isbn13, shelf_location, replacement_price)', { count: 'exact' })

      if (orParts.length > 0) query = query.or(orParts.join(','))
      if (status !== 'all') query = query.eq('status', status)
      if (condition !== 'all') query = query.eq('condition', condition)
      if (shelf !== 'all') query = query.eq('shelf_location', shelf)

      if (sort === 'barcode_asc') query = query.order('barcode', { ascending: true })
      else if (sort === 'status_asc') query = query.order('status', { ascending: true }).order('created_at', { ascending: false })
      else query = query.order('created_at', { ascending: false })

      const from = (page - 1) * PAGE_SIZE
      const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1)
      if (error) throw error
      setRows(data ?? [])
      setTotal(count ?? 0)
      setSelectedId((current) => ((data ?? []).some((row) => row.id === current) ? current : (data ?? [])[0]?.id ?? null))
    } catch (error) {
      setFeedback({ type: 'error', message: error.message })
    } finally {
      setLoading(false)
    }
  }, [condition, focusBookId, page, resolveBookIds, search, shelf, sort, status])

  useEffect(() => {
    loadCopies()
  }, [loadCopies, refreshToken])

  useEffect(() => {
    let active = true
    supabase.from('copies').select('shelf_location').not('shelf_location', 'is', null).limit(1000).then(({ data }) => {
      if (!active) return
      setShelves([...new Set((data ?? []).map((row) => row.shelf_location).filter(Boolean))].sort())
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!selected) {
      setHistory([])
      setReason('')
      return
    }
    setReason('')
    setDestinationShelf(selected.shelf_location ?? '')
    if (selected.status === 'lost') setTargetStatus('found')
    else if (['available', 'damaged', 'under_repair'].includes(selected.status)) setTargetStatus(selected.status)
    else setTargetStatus('available')

    let active = true
    supabase
      .from('inventory_transactions')
      .select('id, at, type, delta, reason, actor_label')
      .eq('copy_id', selected.id)
      .order('at', { ascending: false })
      .limit(6)
      .then(({ data }) => {
        if (active) setHistory(data ?? [])
      })
    return () => { active = false }
  }, [selected])

  const refresh = () => setRefreshToken((value) => value + 1)

  const statusOptions = useMemo(() => {
    if (!selected) return []
    if (selected.status === 'lost') return ['found', 'damaged']
    if (selected.status === 'retired') return []
    if (selected.status === 'borrowed' || selected.status === 'held') return ['available', 'damaged', 'under_repair']
    return ['available', 'damaged', 'under_repair']
  }, [selected])

  const toggleChecked = (id) => {
    setChecked((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setChecked((current) => {
      if (rows.every((row) => current.has(row.id))) return new Set()
      return new Set(rows.map((row) => row.id))
    })
  }

  const selectedCopiesForPrint = () => {
    if (checked.size > 0) return rows.filter((row) => checked.has(row.id))
    return selected ? [selected] : []
  }

  const handlePrint = () => {
    const copies = selectedCopiesForPrint()
    if (copies.length === 0) {
      setFeedback({ type: 'error', message: 'Select at least one copy to print labels.' })
      return
    }
    printBarcodeLabels(copies.map((copy) => ({
      ...copy,
      book_title: copy.books?.title,
      shelf_location: copyShelf(copy, copy.books),
    })))
  }

  const handleBatchExport = () => {
    const copies = selectedCopiesForPrint()
    if (copies.length === 0) {
      setFeedback({ type: 'error', message: 'Select at least one copy to export.' })
      return
    }
    downloadCsv('copy-labels.csv', [
      { label: 'Barcode', value: (copy) => copy.barcode },
      { label: 'Title', value: (copy) => copy.books?.title },
      { label: 'Authors', value: (copy) => (copy.books?.authors ?? []).join('; ') },
      { label: 'ISBN-13', value: (copy) => copy.books?.isbn13 },
      { label: 'Shelf', value: (copy) => copyShelf(copy, copy.books) },
      { label: 'Status', value: (copy) => copy.status },
      { label: 'Condition', value: (copy) => copy.condition },
      { label: 'Source', value: (copy) => copy.source_type },
    ], copies)
  }

  const handleStatusSave = async () => {
    if (!selected) return
    if (!reason.trim()) {
      setFeedback({ type: 'error', message: 'A mandatory reason is required for a status change.' })
      return
    }
    setSaving(true)
    setFeedback(null)
    try {
      const response = await api.invoke('change-copy-status', {
        copy_id: selected.id,
        target_status: targetStatus,
        reason: reason.trim(),
        shelf_location: destinationShelf.trim() || null,
      })
      const result = response.data ?? {}
      setFeedback({
        type: 'success',
        message: `Copy ${selected.barcode} is now ${statusLabel(result.status || targetStatus)}. A ${result.transaction_type || 'status_change'} transaction was written.`,
      })
      if (result.status === 'held') {
        setFeedback({ type: 'success', message: `Copy ${selected.barcode} became available and was promoted to the first waiting reservation (held).` })
      }
      refresh()
    } catch (error) {
      setFeedback({ type: 'error', message: error.message })
    } finally {
      setSaving(false)
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageWindow = Array.from({ length: Math.min(5, pages) }, (_, index) => {
    const start = Math.min(Math.max(1, page - 2), Math.max(1, pages - 4))
    return start + index
  })

  const currentStatusLocked = selected && ['borrowed', 'retired'].includes(selected.status)

  return (
    <div className="books-tab">
      <div className="admin-search-bar-wrap">
        <div className="admin-barcode-input">
          <span className="books-search-icon">▥</span>
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') { setSearch(searchInput.trim()); setPage(1) } }}
            placeholder="Scan barcode or search title / ISBN…"
          />
          <span className="books-kbd">Enter</span>
        </div>
        <button type="button" className="admin-btn-primary" onClick={() => { setSearch(searchInput.trim()); setPage(1) }}>Lookup</button>
        <button type="button" className="admin-btn-outline" onClick={handleBatchExport}>Batch Export</button>
      </div>

      {feedback && (
        <div className={`books-alert ${feedback.type === 'error' ? 'danger' : 'success'}`}>
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)}>✕</button>
        </div>
      )}

      <div className="books-filter-row">
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} aria-label="Copy status filter">
          <option value="all">Status: All statuses</option>
          {COPY_STATUSES.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
        </select>
        <select value={condition} onChange={(event) => { setCondition(event.target.value); setPage(1) }} aria-label="Condition filter">
          <option value="all">Condition: All conditions</option>
          {CONDITIONS.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
        </select>
        <select value={shelf} onChange={(event) => { setShelf(event.target.value); setPage(1) }} aria-label="Shelf filter">
          <option value="all">Shelf: All shelves</option>
          {shelves.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort copies">
          {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {checked.size > 0 && (
          <button type="button" className="admin-btn-outline books-btn-sm books-push-right" onClick={handlePrint}>Print {checked.size} label(s)</button>
        )}
        {focusBookId && (
          <div className="books-focus-chip">
            Showing copies for one title
            <button type="button" className="books-link" onClick={onClearFocus}>Clear</button>
          </div>
        )}
      </div>

      <div className="admin-work-layout">
        <div className="admin-table-container">
          <div className="admin-table-toolbar books-table-toolbar">
            <span className="books-muted">Showing <strong>{total.toLocaleString('vi-VN')}</strong> copies · 25 per page · FR-INV-01.07</span>
            <button type="button" className="admin-btn-outline books-btn-sm" onClick={refresh}>Refresh</button>
          </div>

          <div className="books-table-scroll">
            <table className="admin-table books-table copies-table">
              <thead>
                <tr>
                  <th className="check">
                    <input type="checkbox" checked={rows.length > 0 && rows.every((row) => checked.has(row.id))} onChange={toggleAll} aria-label="Select all copies" />
                  </th>
                  <th>Barcode</th>
                  <th>Title & author</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Condition</th>
                  <th>Acquisition source</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan="8" className="books-table-empty">Loading copies…</td></tr>}
                {!loading && rows.map((copy) => (
                  <tr key={copy.id} className={copy.id === selectedId ? 'selected' : ''} onClick={() => setSelectedId(copy.id)}>
                    <td className="check" onClick={(event) => event.stopPropagation()}>
                      <input type="checkbox" checked={checked.has(copy.id)} onChange={() => toggleChecked(copy.id)} aria-label={`Select ${copy.barcode}`} />
                    </td>
                    <td><span className="books-barcode-pill">{copy.barcode}</span></td>
                    <td>
                      <div className="books-title-line">{copy.books?.title || 'Unknown title'}</div>
                      <div className="books-subline">
                        {copy.books?.authors?.join(', ') || 'Unknown author'}
                        {copy.barcode.includes('-') && <span> · Copy #{copy.barcode.split('-').pop()}</span>}
                      </div>
                    </td>
                    <td><span className={`books-badge tone-${statusTone(copy.status)}`}>{statusLabel(copy.status)}</span></td>
                    <td>{copyShelf(copy, copy.books)}</td>
                    <td>{statusLabel(copy.condition)}</td>
                    <td>{statusLabel(copy.source_type || 'manual')}</td>
                    <td>
                      <button type="button" className="books-link" onClick={(event) => { event.stopPropagation(); setSelectedId(copy.id) }}>Copy History →</button>
                    </td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan="8" className="books-table-empty">No copies match the selected filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="books-pagination">
            <span className="books-muted">{total.toLocaleString('vi-VN')} copies</span>
            <div className="books-page-buttons">
              <button type="button" className="admin-btn-outline books-btn-sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
              {pageWindow.map((value) => (
                <button key={value} type="button" className={`books-page-btn ${value === page ? 'active' : ''}`} onClick={() => setPage(value)}>{value}</button>
              ))}
              {pages > 5 && <span className="books-muted">… {pages}</span>}
              <button type="button" className="admin-btn-outline books-btn-sm" disabled={page >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))}>Next</button>
            </div>
          </div>
        </div>

        <aside className="admin-drawer books-detail">
          {selected ? (
            <>
              <div className="books-box-head">
                <span>Change copy status</span>
                <span className="books-barcode-pill">{selected.barcode}</span>
              </div>

              <div className="books-detail-box status-summary">
                <div>
                  <strong>{selected.books?.title}</strong>
                  <div className="books-subline">{selected.books?.authors?.join(', ') || 'Unknown author'}</div>
                  <div className="books-subline">◉ Current location: {copyShelf(selected, selected.books)}</div>
                </div>
                <span className={`books-badge tone-${statusTone(selected.status)}`}>{statusLabel(selected.status)}</span>
              </div>

              {selected.status === 'retired' && (
                <div className="books-empty-note">A retired copy is terminal. It cannot be changed; add a new copy to the title instead.</div>
              )}
              {selected.status === 'borrowed' && (
                <div className="books-empty-note">This copy is on loan. On-loan losses use the Circulation loan Lost workflow, not this pane.</div>
              )}
              {selected.status === 'held' && (
                <div className="books-empty-note">Setting this held copy to damaged or under repair releases the hold (EC-12). It cannot be set lost directly.</div>
              )}

              <div className="books-status-options">
                {statusOptions.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`books-status-option ${targetStatus === value ? 'active' : ''} ${value === 'lost' ? 'danger' : ''}`}
                    onClick={() => setTargetStatus(value)}
                  >
                    <span className="radio-dot" />
                    <span>
                      <strong>{value === 'found' ? 'Found' : statusLabel(value)}</strong>
                      <small>{statusDescription(value)}</small>
                    </span>
                  </button>
                ))}
                {selected.status === 'lost' && (
                  <div className="books-hint">Resolving a lost copy writes a <code>found</code> transaction and applies the Path A lost-resolution effects.</div>
                )}
                {statusOptions.length === 0 && selected.status !== 'retired' && (
                  <div className="books-empty-note">No manual transition is available from the current state.</div>
                )}
              </div>

              <div className="books-field">
                <label htmlFor="destination-shelf">Destination shelf</label>
                <input id="destination-shelf" value={destinationShelf} onChange={(event) => setDestinationShelf(event.target.value)} placeholder="Shelf A" />
              </div>

              <div className="books-field">
                <label htmlFor="status-reason">Mandatory reason for status change *</label>
                <textarea
                  id="status-reason"
                  rows="3"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Describe the inspection finding and the action taken…"
                />
                <div className="books-hint">{reason.length}/280 characters</div>
              </div>

              <div className="books-detail-actions three">
                <button type="button" className="admin-btn-outline books-btn-ghost" onClick={() => { setReason(''); setTargetStatus(selected.status === 'lost' ? 'found' : selected.status) }}>Cancel</button>
                <button type="button" className="admin-btn-outline" onClick={handlePrint}>Print barcode</button>
                <button
                  type="button"
                  className="admin-btn-primary"
                  disabled={saving || !statusOptions.includes(targetStatus) || currentStatusLocked}
                  onClick={handleStatusSave}
                >
                  {saving ? 'Updating…' : 'Update & log transaction'}
                </button>
              </div>

              <div className="books-detail-box">
                <div className="books-box-head"><span>Recent copy history</span><span className="books-muted">Immutable</span></div>
                <div className="books-timeline">
                  {history.map((entry) => (
                    <div key={entry.id} className="books-timeline-row">
                      <span className={`books-dot tone-${statusTone(entry.type === 'write_off' ? 'retired' : entry.type)}`} />
                      <div>
                        <div className="books-title-line">{statusLabel(entry.type)}</div>
                        <div className="books-subline">{entry.reason || '—'} · {formatDateTime(entry.at)}</div>
                      </div>
                      <span className="mono">{entry.delta > 0 ? `+${entry.delta}` : entry.delta}</span>
                    </div>
                  ))}
                  {history.length === 0 && <div className="books-empty-note">No transactions recorded for this copy yet.</div>}
                </div>
              </div>
            </>
          ) : (
            <div className="books-empty-note">Select a copy row to inspect its state and change its status.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

function statusDescription(status) {
  switch (status) {
    case 'available':
      return 'Return copy to public circulating stacks'
    case 'damaged':
      return 'Flagged for archival assessment & quarantine'
    case 'under_repair':
      return 'Bench restoration, spine fixing, or rebinding'
    case 'found':
      return 'Reinstated copy previously documented as lost'
    default:
      return ''
  }
}
