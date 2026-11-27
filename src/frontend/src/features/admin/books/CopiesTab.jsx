import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../lib/api'
import { IconChevron, IconRefresh, IconSliders, IconSort } from './booksIcons'
import { supabase } from '../../../lib/supabase'
import {
  CONDITIONS,
  COPY_STATUSES,
  copyShelf,
  formatDateTime,
  printBarcodeLabels,
  statusLabel,
  statusTone,
  transactionLabel,
} from './booksUtils'

const PAGE_SIZE = 25

// Statuses that are set by circulation / write-off flows, never by hand here.
// The manual surface is limited to available / damaged / under_repair (+ found
// to resolve a lost copy), per FR-INV-07 and UC-19 §2.2.4.
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
  const searchRef = useRef(null)
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

  // After an update the copy list is reloaded, so only show the feedback banner
  // long enough to read and then clear it (the copy row already shows the status).
  // Error banners stay until dismissed.
  useEffect(() => {
    if (!feedback || feedback.type === 'error') return undefined
    const handle = setTimeout(() => setFeedback(null), 4000)
    return () => clearTimeout(handle)
  }, [feedback])

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
      .select('id, at, type, delta, reason, actor_label, to_status')
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

  const toast = (message, type = 'success') => setFeedback({ message, type, key: crypto.randomUUID() })

  const handleStatusSave = async () => {
    if (!selected) return
    if (!reason.trim()) {
      toast('A mandatory reason is required for a status change.', 'error')
      return
    }
    if (isNoOpTarget(selected, targetStatus)) {
      setFeedback({ type: 'error', message: `Copy ${selected.barcode} is ${currentStatusLabel(selected.status)} — pick a different status to change it.` })
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
      const finalStatus = result.status || targetStatus
      if (result.status === 'held') {
        toast(`Copy ${selected.barcode} was promoted to a waiting reservation (held) instead of being re-shelved.`)
      } else {
        toast(`Copy ${selected.barcode} is now ${statusLabel(finalStatus)}.`)
      }
      setTargetStatus(finalStatus)
      setReason('')
      refresh()
    } catch (error) {
      toast(error.message, 'error')
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
  const noOpTarget = isNoOpTarget(selected, targetStatus)
  let submitBlockedReason = ''
  if (selected) {
    if (saving) submitBlockedReason = 'Saving…'
    else if (selected.status === 'retired') submitBlockedReason = 'A retired copy is terminal.'
    else if (!statusOptions.includes(targetStatus)) submitBlockedReason = 'Choose a new status first.'
    else if (noOpTarget) submitBlockedReason = `Copy is ${currentStatusLabel(selected.status)} — choose a different status.`
  }

  return (
    <div className="books-tab">
      <div className="admin-search-bar-wrap">
        <div className="admin-barcode-input">
          <span className="books-search-icon" aria-hidden="true">⌕</span>
          <input
            ref={searchRef}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') { setSearch(searchInput.trim()); setPage(1) } }}
            placeholder="Scan barcode or search title / ISBN…"
            aria-label="Look up copies by barcode, title or ISBN"
          />
          <span className="books-kbd">Enter</span>
        </div>
        <button type="button" className="admin-btn-primary" onClick={() => { setSearch(searchInput.trim()); setPage(1) }}>Lookup</button>
      </div>

      {feedback && (
        <div className={`books-alert ${feedback.type === 'error' ? 'danger' : 'success'}`}>
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)}>✕</button>
        </div>
      )}

      <div className="books-filter-row">
        <div className="books-select-wrap">
          <span className="books-select-icon" aria-hidden="true"><IconSliders size={13} /></span>
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} aria-label="Copy status filter">
            <option value="all">Status: All statuses</option>
            {COPY_STATUSES.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
          </select>
        </div>
        <div className="books-select-wrap">
          <span className="books-select-icon" aria-hidden="true"><IconSliders size={13} /></span>
          <select value={condition} onChange={(event) => { setCondition(event.target.value); setPage(1) }} aria-label="Condition filter">
            <option value="all">Condition: All conditions</option>
            {CONDITIONS.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
          </select>
        </div>
        <div className="books-select-wrap">
          <span className="books-select-icon" aria-hidden="true"><IconSliders size={13} /></span>
          <select value={shelf} onChange={(event) => { setShelf(event.target.value); setPage(1) }} aria-label="Shelf filter">
            <option value="all">Shelf: All shelves</option>
            {shelves.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div className="books-select-wrap">
          <span className="books-select-icon" aria-hidden="true"><IconSort size={13} /></span>
          <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort copies">
            {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        {focusBookId && (
          <div className="books-focus-chip">
            Showing copies for one title
            <button type="button" className="books-link" onClick={onClearFocus}>Clear</button>
          </div>
        )}
        {checked.size > 0 && (
          <button type="button" className="admin-btn-outline books-btn-sm books-push-right" onClick={handlePrint}>
            Print Barcode Labels ({checked.size})
          </button>
        )}
      </div>

      <div className="admin-work-layout">
        <div className="admin-table-container">
          <div className="admin-table-toolbar books-table-toolbar">
            <span className="books-muted">Showing <strong>{rows.length}</strong> of <strong>{total.toLocaleString('vi-VN')}</strong> copies · 25 per page</span>
            <button type="button" className="admin-btn-outline books-btn-sm" onClick={refresh}><IconRefresh size={12} /> Refresh</button>
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
                  <th>Source</th>
                  <th aria-label="Copy history" />
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
                    <td className="books-cell-wrap">
                      <div className="books-title-line">{copy.books?.title || 'Unknown title'}</div>
                      <div className="books-subline">{copy.books?.authors?.join(', ') || 'Unknown author'}</div>
                    </td>
                    <td><span className={`books-badge tone-${statusTone(copy.status)}`}>{statusLabel(copy.status)}</span></td>
                    <td className="books-cell-wrap">{copyShelf(copy, copy.books)}</td>
                    <td>{statusLabel(copy.condition)}</td>
                    <td>{statusLabel(copy.source_type || 'manual')}</td>
                    <td>
                      <button type="button" className="books-icon-btn" aria-label={`Open ${copy.barcode} history`} onClick={(event) => { event.stopPropagation(); setSelectedId(copy.id) }}><IconChevron size={13} /></button>
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
                <div className="books-empty-note">This copy is on loan. Only a return (or the Circulation loan Lost workflow) can change it — pick an action here to release it manually if the loan record is gone.</div>
              )}
              {selected.status === 'held' && (
                <div className="books-empty-note">This copy is held for a waiting reservation. Damaged / Under repair releases the hold (EC-12); it cannot be set lost directly.</div>
              )}

              <div className="books-status-options">
                {statusOptions.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`books-status-option ${targetStatus === value ? 'active' : ''}`}
                    onClick={() => setTargetStatus(value)}
                  >
                    <span className="radio-dot" />
                    <span>
                      <strong>{value === 'found' ? 'Found' : statusLabel(value)}</strong>
                      <small>
                        {statusDescription(value)}
                      </small>
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

              <div className="books-detail-actions">
                <button type="button" className="admin-btn-outline books-btn-ghost" onClick={() => { setReason(''); setTargetStatus(selected.status === 'lost' ? 'found' : selected.status) }}>Reset</button>
                <button type="button" className="admin-btn-outline" onClick={handlePrint}>Print barcode</button>
                <button
                  type="button"
                  className="admin-btn-primary"
                  disabled={saving || !statusOptions.includes(targetStatus) || currentStatusLocked || noOpTarget}
                  title={submitBlockedReason || 'Update the status and write a status_change transaction'}
                  onClick={handleStatusSave}
                >
                  {saving ? 'Updating…' : 'Update status'}
                </button>
              </div>

              <div className="books-detail-box">
                <div className="books-box-head"><span>Recent copy history</span><span className="books-muted">Immutable</span></div>
                <div className="books-timeline">
                  {history.map((entry) => (
                    <div key={entry.id} className="books-timeline-row">
                      <span className={`books-dot tone-${statusTone(entry.type === 'write_off' ? 'retired' : entry.type)}`} />
                      <div>
                        <div className="books-title-line">
                          {entry.type === 'status_change' ? 'Status change' : transactionLabel(entry.type)}
                          {entry.to_status && (
                            <span className="books-muted">
                              {' '}→ <span className={`books-badge tone-${statusTone(entry.to_status === 'retired' && entry.type === 'write_off' ? 'retired' : entry.to_status)}`}>{statusLabel(entry.to_status)}</span>
                            </span>
                          )}
                        </div>
                        <div className="books-subline">{entry.reason || '—'} · {formatDateTime(entry.at)}</div>
                      </div>
                      {entry.delta ? <span className="mono">{entry.delta > 0 ? `+${entry.delta}` : entry.delta}</span> : null}
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
      return 'Back on the public shelves and borrowable'
    case 'damaged':
      return 'Awaiting archival assessment & quarantine'
    case 'under_repair':
      return 'Out for bench restoration, spine fixing, or rebinding'
    case 'found':
      return 'Reinstate a copy documented as lost'
    default:
      return ''
  }
}

/** Human label for the currently stored status of the selected copy. */
function currentStatusLabel(status) {
  switch (status) {
    case 'available':
      return 'already available'
    case 'damaged':
      return 'already damaged'
    case 'under_repair':
      return 'already under repair'
    default:
      return status ? `currently ${statusLabel(status)}` : ''
  }
}

/** True when targetStatus only re-applies the copy's current state (no transaction is written). */
function isNoOpTarget(selected, targetStatus) {
  if (!selected || !targetStatus) return false
  if (targetStatus === 'found') return false
  return targetStatus === selected.status
}
