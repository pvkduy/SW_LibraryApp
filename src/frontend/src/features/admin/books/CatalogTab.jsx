import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../../lib/api'
import { supabase } from '../../../lib/supabase'
import {
  BOOK_COLUMNS,
  COLLECTIONS,
  CONDITIONS,
  copyProgress,
  downloadCsv,
  formatDateTime,
  formatVnd,
  getCoverUrl,
  statusLabel,
  statusTone,
} from './booksUtils'
import { AddCopiesModal } from './AddCopiesModal'
import { BookEditorModal } from './BookEditorModal'

const PAGE_SIZE = 25

function Cover({ book, size = 'sm' }) {
  const url = getCoverUrl(book.cover_path)
  const initials = String(book.title || '?').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return (
    <div className={`books-cover books-cover-${size}`}>
      {url ? <img src={url} alt="" /> : <span>{initials}</span>}
    </div>
  )
}

export function CatalogTab({ onOpenCopies }) {
  const [books, setBooks] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [condition, setCondition] = useState('all')
  const [shelf, setShelf] = useState('all')
  const [shelves, setShelves] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [checked, setChecked] = useState(() => new Set())
  const [copies, setCopies] = useState([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState(null)
  const [editorBook, setEditorBook] = useState(undefined)
  const [addCopiesBook, setAddCopiesBook] = useState(null)
  const [collectionSaving, setCollectionSaving] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)

  const selectedBook = useMemo(
    () => books.find((book) => book.id === selectedId) ?? null,
    [books, selectedId],
  )

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 250)
    return () => clearTimeout(handle)
  }, [searchInput])

  const buildQuery = useCallback((select, all = false) => {
    let query = supabase.from('books').select(select, { count: 'exact' })
    if (status !== 'all') query = query.eq('status', status)
    if (condition !== 'all') query = query.eq('copies.condition', condition)
    if (search) {
      const needle = search.replaceAll(',', ' ')
      query = query.or(`title.ilike.%${needle}%,isbn13.ilike.%${needle}%,isbn10.ilike.%${needle}%,publisher.ilike.%${needle}%`)
    }
    if (all) return query.range(0, 19999)
    const from = (page - 1) * PAGE_SIZE
    return query.range(from, from + PAGE_SIZE - 1)
  }, [condition, page, search, status])

  const loadBooks = useCallback(async () => {
    setLoading(true)
    try {
      const select = condition === 'all'
        ? `${BOOK_COLUMNS}, copies(id, status, condition, shelf_location, barcode)`
        : `${BOOK_COLUMNS}, copies!inner(id, status, condition, shelf_location, barcode)`
      let query = buildQuery(select)
      if (condition === 'all') query = query.order('added_at', { ascending: false })
      const { data, error, count } = await query
      if (error) throw error

      let rows = data ?? []
      if (shelf !== 'all') {
        rows = rows.filter((book) => book.shelf_location === shelf || (book.copies ?? []).some((copy) => copy.shelf_location === shelf))
      }
      setBooks(rows)
      setTotal(shelf === 'all' ? (count ?? rows.length) : rows.length)
      setSelectedId((current) => (rows.some((book) => book.id === current) ? current : rows[0]?.id ?? null))
    } catch (error) {
      setFeedback({ type: 'error', message: error.message })
    } finally {
      setLoading(false)
    }
  }, [buildQuery, condition, shelf])

  useEffect(() => {
    loadBooks()
  }, [loadBooks, refreshToken])

  useEffect(() => {
    let active = true
    supabase.from('copies').select('shelf_location').not('shelf_location', 'is', null).limit(1000).then(({ data }) => {
      if (!active) return
      const values = [...new Set((data ?? []).map((row) => row.shelf_location).filter(Boolean))].sort()
      setShelves(values)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!selectedBook?.id) {
      setCopies([])
      return
    }
    let active = true
    supabase
      .from('copies')
      .select('id, barcode, status, shelf_location, condition, source_type, created_at')
      .eq('book_id', selectedBook.id)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return
        if (error) setFeedback({ type: 'error', message: error.message })
        else setCopies(data ?? [])
      })
    return () => { active = false }
  }, [selectedBook?.id, refreshToken])

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
      if (books.every((book) => current.has(book.id))) return new Set()
      return new Set(books.map((book) => book.id))
    })
  }

  const refresh = () => setRefreshToken((value) => value + 1)

  const handleSavedBook = (data, wasEditing) => {
    setEditorBook(undefined)
    setFeedback({
      type: 'success',
      message: wasEditing ? 'Book metadata updated.' : `Book registered${data?.copies?.length ? ` with ${data.copies.length} copies` : ''}.`,
    })
    refresh()
  }

  const handleAddCopiesSaved = (data) => {
    setAddCopiesBook(null)
    setFeedback({ type: 'success', message: `${data?.copies?.length ?? 0} copy record(s) created. Barcodes are ready to print from the Copies tab.` })
    refresh()
  }

  const handleCollection = async (value) => {
    if (!selectedBook) return
    setCollectionSaving(true)
    setFeedback(null)
    try {
      await api.invoke('set-books-collection', { book_ids: [selectedBook.id], collection: value })
      setBooks((current) => current.map((book) => book.id === selectedBook.id ? { ...book, collection: value } : book))
    } catch (error) {
      setFeedback({ type: 'error', message: error.message })
    } finally {
      setCollectionSaving(false)
    }
  }

  const handleBulkCollection = async (value) => {
    if (checked.size === 0) {
      setFeedback({ type: 'error', message: 'Select at least one title first.' })
      return
    }
    setCollectionSaving(true)
    try {
      await api.invoke('set-books-collection', { book_ids: [...checked], collection: value })
      setFeedback({ type: 'success', message: `Collection set to ${value} for ${checked.size} title(s). Existing loans keep their stored fee.` })
      setChecked(new Set())
      refresh()
    } catch (error) {
      setFeedback({ type: 'error', message: error.message })
    } finally {
      setCollectionSaving(false)
    }
  }

  const handleExport = async () => {
    try {
      const select = condition === 'all'
        ? 'id,title,authors,isbn13,isbn10,publisher,year,collection,total_copies,available_copies,shelf_location,status,added_at'
        : 'id,title,authors,isbn13,isbn10,publisher,year,collection,total_copies,available_copies,shelf_location,status,added_at,copies!inner(condition)'
      const { data, error } = await buildQuery(select, true)
      if (error) throw error
      downloadCsv('catalog-export.csv', [
        { label: 'Title', value: (row) => row.title },
        { label: 'Authors', value: (row) => (row.authors ?? []).join('; ') },
        { label: 'ISBN-13', value: (row) => row.isbn13 },
        { label: 'ISBN-10', value: (row) => row.isbn10 },
        { label: 'Publisher', value: (row) => row.publisher },
        { label: 'Year', value: (row) => row.year },
        { label: 'Collection', value: (row) => row.collection },
        { label: 'Total copies', value: (row) => row.total_copies },
        { label: 'Available', value: (row) => row.available_copies },
        { label: 'Shelf', value: (row) => row.shelf_location },
        { label: 'Status', value: (row) => row.status },
        { label: 'Added', value: (row) => row.added_at },
      ], data ?? [])
    } catch (error) {
      setFeedback({ type: 'error', message: error.message })
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageWindow = Array.from({ length: Math.min(5, pages) }, (_, index) => {
    const start = Math.min(Math.max(1, page - 2), Math.max(1, pages - 4))
    return start + index
  })

  return (
    <div className="books-tab">
      <div className="admin-search-bar-wrap">
        <div className="admin-barcode-input">
          <span className="books-search-icon">⌕</span>
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') { setSearch(searchInput.trim()); setPage(1) } }}
            placeholder="Scan or type barcode / ISBN / title…"
          />
          <span className="books-kbd">Enter</span>
        </div>
        <button type="button" className="admin-btn-primary" onClick={() => { setSearch(searchInput.trim()); setPage(1) }}>Lookup</button>
        <button type="button" className="admin-btn-outline" onClick={() => setEditorBook(null)}>Add Title</button>
      </div>

      {feedback && (
        <div className={`books-alert ${feedback.type === 'error' ? 'danger' : 'success'}`}>
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)}>✕</button>
        </div>
      )}

      <div className="books-filter-row">
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} aria-label="Status filter">
          <option value="all">Status: All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
        </select>
        <select value={condition} onChange={(event) => { setCondition(event.target.value); setPage(1) }} aria-label="Condition filter">
          <option value="all">Condition: All conditions</option>
          {CONDITIONS.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
        </select>
        <select value={shelf} onChange={(event) => setShelf(event.target.value)} aria-label="Shelf filter">
          <option value="all">Shelf: All shelves</option>
          {shelves.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        {checked.size > 0 && (
          <div className="books-bulk-actions">
            <span>{checked.size} selected</span>
            <button type="button" className="admin-btn-outline books-btn-sm" disabled={collectionSaving} onClick={() => handleBulkCollection('standard')}>Set Standard</button>
            <button type="button" className="admin-btn-outline books-btn-sm" disabled={collectionSaving} onClick={() => handleBulkCollection('premium')}>Set Premium</button>
          </div>
        )}
        <button type="button" className="admin-btn-outline books-btn-sm books-btn-ghost books-push-right" onClick={handleExport}>Export</button>
      </div>

      <div className="admin-work-layout">
        <div className="admin-table-container">
          <div className="admin-table-toolbar books-table-toolbar">
            <span className="books-muted">Showing <strong>{books.length}</strong> of <strong>{total.toLocaleString('vi-VN')}</strong> titles · 25 per page</span>
            <button type="button" className="admin-btn-outline books-btn-sm" onClick={refresh}>Refresh</button>
          </div>

          <div className="books-table-scroll">
            <table className="admin-table books-table">
              <thead>
                <tr>
                  <th className="check">
                    <input
                      type="checkbox"
                      checked={books.length > 0 && books.every((book) => checked.has(book.id))}
                      onChange={toggleAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th>Title & author</th>
                  <th>ISBN</th>
                  <th>Call number</th>
                  <th>Collection</th>
                  <th>Copies</th>
                  <th>Shelf</th>
                  <th aria-label="Open detail" />
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan="8" className="books-table-empty">Loading catalog…</td></tr>
                )}
                {!loading && books.map((book) => (
                  <tr key={book.id} className={book.id === selectedId ? 'selected' : ''} onClick={() => setSelectedId(book.id)}>
                    <td className="check" onClick={(event) => event.stopPropagation()}>
                      <input type="checkbox" checked={checked.has(book.id)} onChange={() => toggleChecked(book.id)} aria-label={`Select ${book.title}`} />
                    </td>
                    <td>
                      <div className="books-title-cell">
                        <Cover book={book} />
                        <div>
                          <div className="books-title-line">
                            {book.title}
                            {book.id === selectedId && <span className="books-chip selected">Selected</span>}
                          </div>
                          <div className="books-subline">{book.authors?.join(', ') || 'Unknown author'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="mono">{book.isbn13 || book.isbn10 || '—'}</td>
                    <td className="mono">{book.shelf_location || '—'}</td>
                    <td>
                      <span className={`books-badge ${book.collection}`}>{statusLabel(book.collection)}</span>
                    </td>
                    <td className="mono">{copyProgress(book)}</td>
                    <td>{book.shelf_location || '—'}</td>
                    <td>
                      <button type="button" className="books-icon-btn" aria-label="Open details" onClick={(event) => { event.stopPropagation(); setSelectedId(book.id) }}>›</button>
                    </td>
                  </tr>
                ))}
                {!loading && books.length === 0 && (
                  <tr><td colSpan="8" className="books-table-empty">No titles match the selected filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="books-pagination">
            <span className="books-muted">{total.toLocaleString('vi-VN')} titles</span>
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
          {selectedBook ? (
            <>
              <div className="books-detail-hero">
                <Cover book={selectedBook} size="lg" />
                <div>
                  <div className="books-detail-badges">
                    <span className={`books-badge ${selectedBook.collection}`}>{statusLabel(selectedBook.collection)}</span>
                    <span className={`books-badge tone-${softTone(selectedBook.available_copies)}`}>{selectedBook.available_copies ?? 0} available</span>
                  </div>
                  <h2>{selectedBook.title}</h2>
                  <div className="books-muted">{selectedBook.authors?.join(', ') || 'Unknown author'}</div>
                  <p className="books-detail-desc">{selectedBook.description || 'No description recorded yet.'}</p>
                </div>
              </div>

              <div className="books-detail-box">
                <div className="books-box-head">
                  <span>Title metadata</span>
                  <span className="books-muted mono">#{String(selectedBook.id).slice(0, 8)}</span>
                </div>
                <dl className="books-meta-grid">
                  <div><dt>Publisher & year</dt><dd>{selectedBook.publisher || '—'}{selectedBook.year ? ` · ${selectedBook.year}` : ''}</dd></div>
                  <div><dt>Language</dt><dd>{selectedBook.language || '—'}</dd></div>
                  <div><dt>ISBN</dt><dd className="mono">{selectedBook.isbn13 || selectedBook.isbn10 || '—'}</dd></div>
                  <div><dt>Call number</dt><dd className="mono">{selectedBook.shelf_location || '—'}</dd></div>
                  <div><dt>Category / field</dt><dd>{[selectedBook.category, selectedBook.field].filter(Boolean).join(' · ') || '—'}</dd></div>
                  <div><dt>Default shelf</dt><dd>{selectedBook.shelf_location || '—'}</dd></div>
                  <div><dt>Status</dt><dd><span className={`books-badge tone-${statusTone(selectedBook.status)}`}>{statusLabel(selectedBook.status)}</span></dd></div>
                  <div><dt>Added</dt><dd>{formatDateTime(selectedBook.added_at)}</dd></div>
                </dl>
              </div>

              <div className="books-detail-box">
                <div className="books-box-head"><span>Collection tier selection</span></div>
                <div className="books-collection-options vertical">
                  {COLLECTIONS.map((collection) => (
                    <button
                      key={collection.value}
                      type="button"
                      className={`books-collection-card ${selectedBook.collection === collection.value ? 'active' : ''}`}
                      disabled={collectionSaving}
                      onClick={() => handleCollection(collection.value)}
                    >
                      <span className="radio-dot" />
                      <span>
                        <strong>{collection.label}</strong>
                        <small>{collection.hint}</small>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="books-value-row">
                  <span>Insured replacement price</span>
                  <strong>{formatVnd(selectedBook.replacement_price)}</strong>
                </div>
              </div>

              <div className="books-detail-box">
                <div className="books-box-head">
                  <span>Physical copies summary ({selectedBook.total_copies ?? 0})</span>
                  <button type="button" className="books-link" onClick={() => setAddCopiesBook(selectedBook)}>+ Add Copies</button>
                </div>
                <div className="books-copy-summary-list">
                  {copies.slice(0, 6).map((copy) => (
                    <div key={copy.id} className="books-copy-summary">
                      <div>
                        <span className="mono strong">{copy.barcode}</span>
                        <div className="books-subline">{copy.shelf_location || selectedBook.shelf_location || 'Unassigned'} · {statusLabel(copy.condition)}</div>
                      </div>
                      <span className={`books-badge tone-${statusTone(copy.status)}`}>{statusLabel(copy.status)}</span>
                    </div>
                  ))}
                  {copies.length === 0 && <div className="books-empty-note">No physical copies yet. Add the first copy to make this title discoverable.</div>}
                  {copies.length > 6 && (
                    <button type="button" className="books-link" onClick={() => onOpenCopies?.(selectedBook.id)}>
                      View all {copies.length} copies in the Copies tab →
                    </button>
                  )}
                </div>
              </div>

              <div className="books-detail-actions">
                <button type="button" className="admin-btn-outline" onClick={() => setEditorBook(selectedBook)}>Edit metadata</button>
                <button type="button" className="admin-btn-primary" onClick={() => setAddCopiesBook(selectedBook)}>Add copies to title</button>
              </div>
            </>
          ) : (
            <div className="books-empty-note">Select a title to inspect its metadata and physical copies.</div>
          )}
        </aside>
      </div>

      {editorBook !== undefined && (
        <BookEditorModal
          book={editorBook}
          onClose={() => setEditorBook(undefined)}
          onSaved={handleSavedBook}
        />
      )}
      {addCopiesBook && (
        <AddCopiesModal
          book={addCopiesBook}
          onClose={() => setAddCopiesBook(null)}
          onSaved={handleAddCopiesSaved}
        />
      )}
    </div>
  )
}

function softTone(available) {
  return Number(available) > 0 ? 'success' : 'muted'
}
