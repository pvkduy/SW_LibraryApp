import React, { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../lib/api'
import { supabase } from '../../../lib/supabase'
import {
  BOOK_COLUMNS,
  COLLECTIONS,
  CONDITIONS,
  getCoverUrl,
  uploadToBucket,
} from './booksUtils'

const EMPTY_BOOK = {
  title: '',
  authors: '',
  isbn10: '',
  isbn13: '',
  publisher: '',
  year: '',
  language: '',
  category: '',
  field: '',
  description: '',
  toc: '',
  keywords: '',
  collection: 'standard',
  replacement_price: '',
  shelf_location: '',
  status: 'active',
  cover_path: '',
}

function bookToForm(book) {
  if (!book) return { ...EMPTY_BOOK }
  return {
    title: book.title ?? '',
    authors: (book.authors ?? []).join(', '),
    isbn10: book.isbn10 ?? '',
    isbn13: book.isbn13 ?? '',
    publisher: book.publisher ?? '',
    year: book.year ?? '',
    language: book.language ?? '',
    category: book.category ?? '',
    field: book.field ?? '',
    description: book.description ?? '',
    toc: book.toc ?? '',
    keywords: (book.keywords ?? []).join(', '),
    collection: book.collection ?? 'standard',
    replacement_price: book.replacement_price ?? '',
    shelf_location: book.shelf_location ?? '',
    status: book.status ?? 'active',
    cover_path: book.cover_path ?? '',
  }
}

export function BookEditorModal({ book, onClose, onSaved }) {
  const [resolvedBookId, setResolvedBookId] = useState(book?.id ?? null)
  const editing = Boolean(resolvedBookId)
  const [form, setForm] = useState(() => bookToForm(book))
  const [lookupIsbn, setLookupIsbn] = useState(book?.isbn13 || book?.isbn10 || '')
  const [lookupState, setLookupState] = useState(null)
  const [lookupWarning, setLookupWarning] = useState('')
  const [conflict, setConflict] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [saving, setSaving] = useState(false)
  const [coverFile, setCoverFile] = useState(null)
  const [copies, setCopies] = useState({ count: 1, condition: 'good', shelf_location: '', source_type: 'purchase_outside_batch' })
  const fileRef = useRef(null)
  const [activeTab, setActiveTab] = useState('metadata')

  useEffect(() => {
    setResolvedBookId(book?.id ?? null)
    setForm(bookToForm(book))
    setLookupIsbn(book?.isbn13 || book?.isbn10 || '')
    setLookupState(null)
    setLookupWarning('')
    setConflict(null)
    setFeedback(null)
    setCoverFile(null)
    setActiveTab('metadata')
  }, [book])

  const coverBlobUrl = useMemo(
    () => (coverFile ? URL.createObjectURL(coverFile) : null),
    [coverFile],
  )

  useEffect(() => {
    if (!coverBlobUrl) return undefined
    return () => URL.revokeObjectURL(coverBlobUrl)
  }, [coverBlobUrl])

  const coverPreview = coverBlobUrl || getCoverUrl(form.cover_path)

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    if (field === 'isbn13' || field === 'isbn10') setLookupIsbn(value)
  }

  const handleLookup = async () => {
    const isbn = lookupIsbn.trim()
    if (!isbn) {
      setFeedback({ type: 'error', message: 'Enter an ISBN to look up.' })
      return
    }
    setLookupState('loading')
    setLookupWarning('')
    setFeedback(null)
    try {
      const response = await api.invoke('lookup-isbn', { isbn })
      const data = response.data ?? {}
      setForm((current) => ({
        ...current,
        title: data.title || current.title,
        authors: Array.isArray(data.authors) && data.authors.length ? data.authors.join(', ') : current.authors,
        isbn10: data.isbn10 || current.isbn10,
        isbn13: data.isbn13 || current.isbn13,
        publisher: data.publisher || current.publisher,
        year: data.year || current.year,
        language: data.language || current.language,
        category: data.category || current.category,
        description: data.description || current.description,
        cover_path: data.cover_url || current.cover_path,
      }))
      setLookupState('done')
      setFeedback({ type: 'success', message: `Metadata found via ${data.source === 'open_library' ? 'Open Library' : 'Google Books'}. Review the fields before saving.` })
    } catch (error) {
      // UC-19 §2.2.1: keep the typed ISBN and let the manual form carry on.
      setLookupState('failed')
      setLookupWarning(error.message || 'No metadata found for ISBN. Please enter book details manually.')
    }
  }

  const handleCover = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setCoverFile(file)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFeedback(null)
    setConflict(null)

    if (!form.title.trim()) {
      setFeedback({ type: 'error', message: 'Title is required.' })
      setActiveTab('metadata')
      return
    }
    if (form.isbn13.trim() && !/^\d{13}$/.test(form.isbn13.replace(/[^0-9]/g, ''))) {
      setFeedback({ type: 'error', message: 'ISBN-13 must contain 13 digits.' })
      setActiveTab('metadata')
      return
    }

    setSaving(true)
    try {
      let coverPath = form.cover_path
      if (coverFile) {
        coverPath = await uploadToBucket('covers', editing ? `books/${resolvedBookId}` : 'books', coverFile)
      }

      const payload = {
        title: form.title.trim(),
        authors: form.authors.split(',').map((part) => part.trim()).filter(Boolean),
        isbn10: form.isbn10.trim() || null,
        isbn13: form.isbn13.replace(/[^0-9]/g, '') || null,
        publisher: form.publisher.trim() || null,
        year: form.year === '' ? null : Number(form.year),
        language: form.language.trim() || null,
        category: form.category.trim() || null,
        field: form.field.trim() || null,
        description: form.description.trim() || null,
        toc: form.toc.trim() || null,
        keywords: form.keywords.split(',').map((part) => part.trim()).filter(Boolean),
        collection: form.collection,
        replacement_price: form.replacement_price === '' ? null : Number(form.replacement_price),
        shelf_location: form.shelf_location.trim() || null,
        status: form.status,
        cover_path: coverPath || null,
      }

      const copyRows = !editing
        ? Array.from({ length: Math.max(0, Number(copies.count) || 0) }, () => ({
          condition: copies.condition,
          shelf_location: copies.shelf_location.trim() || null,
          source_type: copies.source_type,
        }))
        : []

      const response = await api.invoke('save-book', {
        book: editing ? { ...payload, id: resolvedBookId } : payload,
        copies: copyRows,
      })

      onSaved?.(response.data, editing)
    } catch (error) {
      if (error.reason === 'DUPLICATE') {
        setConflict({
          message: error.message,
          existingBookId: error.details?.existing_book_id ?? null,
        })
      } else {
        setFeedback({ type: 'error', message: error.message })
      }
    } finally {
      setSaving(false)
    }
  }

  const switchToExisting = async () => {
    if (!conflict?.existingBookId) return
    setLookupState('loading')
    try {
      const { data, error } = await supabase.from('books').select(BOOK_COLUMNS).eq('id', conflict.existingBookId).single()
      if (error) throw error
      setResolvedBookId(data.id)
      setConflict(null)
      setForm(bookToForm(data))
      setFeedback({ type: 'success', message: 'Loaded the existing title. Saving now will update its metadata; use “Add Copies” on the catalog pane to top up stock.' })
    } catch (error) {
      setFeedback({ type: 'error', message: error.message })
    } finally {
      setLookupState(null)
    }
  }

  return (
    <div className="books-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <div className="books-modal books-modal-wide" role="dialog" aria-modal="true" aria-label={editing ? 'Edit book' : 'Add book'}>
        <div className="books-modal-head">
          <div>
            <div className="books-eyebrow">{editing ? 'Edit catalog record' : 'Register a new title'}</div>
            <h2>{editing ? 'Edit book metadata' : 'Add a book'}</h2>
            <p>ISBN autofill or manual entry. Metadata and the first physical copies are saved in one transaction.</p>
          </div>
          <button type="button" className="books-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="books-modal-tabs">
          <button type="button" className={activeTab === 'metadata' ? 'active' : ''} onClick={() => setActiveTab('metadata')}>Metadata</button>
          <button type="button" className={activeTab === 'copies' ? 'active' : ''} onClick={() => setActiveTab('copies')}>
            {editing ? 'Copies' : 'Initial copies'}
          </button>
          <button type="button" className={activeTab === 'cover' ? 'active' : ''} onClick={() => setActiveTab('cover')}>Cover</button>
        </div>

        {feedback && (
          <div className={`books-alert ${feedback.type === 'error' ? 'danger' : 'success'}`}>
            <span>{feedback.message}</span>
            <button type="button" onClick={() => setFeedback(null)}>✕</button>
          </div>
        )}

        {conflict && (
          <div className="books-conflict">
            <div>
              <strong>Duplicate ISBN</strong>
              <p>{conflict.message} This title is already registered in the catalog. Would you like to add new copies to the existing record instead?</p>
            </div>
            {conflict.existingBookId && (
              <button type="button" className="admin-btn-outline" onClick={switchToExisting}>Add copies to existing book</button>
            )}
          </div>
        )}

        <form className="books-modal-body" onSubmit={handleSubmit}>
          {activeTab === 'metadata' && (
            <>
              <div className="books-lookup-row">
                <div className="books-field grow">
                  <label htmlFor="book-isbn">ISBN lookup</label>
                  <div className="books-inline">
                    <input
                      id="book-isbn"
                      value={lookupIsbn}
                      onChange={(event) => setLookupIsbn(event.target.value)}
                      placeholder="Scan or type ISBN-10 / ISBN-13"
                    />
                    <button type="button" className="admin-btn-primary" onClick={handleLookup} disabled={lookupState === 'loading'}>
                      {lookupState === 'loading' ? 'Looking up…' : 'Lookup metadata'}
                    </button>
                  </div>
                  {lookupWarning && (
                    <div className="books-hint warn">{lookupWarning}</div>
                  )}
                </div>
              </div>

              <div className="books-form-grid">
                <div className="books-field span-2">
                  <label htmlFor="book-title">Title *</label>
                  <input id="book-title" value={form.title} onChange={(event) => setField('title', event.target.value)} required />
                </div>
                <div className="books-field span-2">
                  <label htmlFor="book-authors">Authors</label>
                  <input id="book-authors" value={form.authors} onChange={(event) => setField('authors', event.target.value)} placeholder="Comma separated" />
                </div>
                <div className="books-field">
                  <label htmlFor="book-isbn13">ISBN-13</label>
                  <input id="book-isbn13" value={form.isbn13} onChange={(event) => setField('isbn13', event.target.value)} />
                </div>
                <div className="books-field">
                  <label htmlFor="book-isbn10">ISBN-10</label>
                  <input id="book-isbn10" value={form.isbn10} onChange={(event) => setField('isbn10', event.target.value)} />
                </div>
                <div className="books-field">
                  <label htmlFor="book-publisher">Publisher</label>
                  <input id="book-publisher" value={form.publisher} onChange={(event) => setField('publisher', event.target.value)} />
                </div>
                <div className="books-field">
                  <label htmlFor="book-year">Year</label>
                  <input id="book-year" type="number" value={form.year} onChange={(event) => setField('year', event.target.value)} />
                </div>
                <div className="books-field">
                  <label htmlFor="book-language">Language</label>
                  <input id="book-language" value={form.language} onChange={(event) => setField('language', event.target.value)} placeholder="vi, en…" />
                </div>
                <div className="books-field">
                  <label htmlFor="book-category">Category</label>
                  <input id="book-category" value={form.category} onChange={(event) => setField('category', event.target.value)} />
                </div>
                <div className="books-field">
                  <label htmlFor="book-field">Field of study</label>
                  <input id="book-field" value={form.field} onChange={(event) => setField('field', event.target.value)} />
                </div>
                <div className="books-field">
                  <label htmlFor="book-shelf">Default shelf location</label>
                  <input id="book-shelf" value={form.shelf_location} onChange={(event) => setField('shelf_location', event.target.value)} placeholder="e.g. CS-A1" />
                </div>
                <div className="books-field span-2">
                  <label htmlFor="book-description">Description</label>
                  <textarea id="book-description" rows="3" value={form.description} onChange={(event) => setField('description', event.target.value)} />
                </div>
                <div className="books-field span-2">
                  <label htmlFor="book-toc">Table of contents</label>
                  <textarea id="book-toc" rows="2" value={form.toc} onChange={(event) => setField('toc', event.target.value)} />
                </div>
                <div className="books-field span-2">
                  <label htmlFor="book-keywords">Keywords</label>
                  <input id="book-keywords" value={form.keywords} onChange={(event) => setField('keywords', event.target.value)} placeholder="Comma separated" />
                </div>
              </div>

              <div className="books-form-section">
                <div className="books-section-title">Collection & commercial terms</div>
                <div className="books-collection-options">
                  {COLLECTIONS.map((collection) => (
                    <button
                      key={collection.value}
                      type="button"
                      className={`books-collection-card ${form.collection === collection.value ? 'active' : ''}`}
                      onClick={() => setField('collection', collection.value)}
                    >
                      <span className="radio-dot" />
                      <span>
                        <strong>{collection.label}</strong>
                        <small>{collection.hint}</small>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="books-form-grid" style={{ marginTop: 12 }}>
                  <div className="books-field">
                    <label htmlFor="book-price">Replacement price (VND)</label>
                    <input id="book-price" type="number" min="0" value={form.replacement_price} onChange={(event) => setField('replacement_price', event.target.value)} />
                  </div>
                  <div className="books-field">
                    <label htmlFor="book-status">Catalog status</label>
                    <select id="book-status" value={form.status} onChange={(event) => setField('status', event.target.value)}>
                      <option value="active">Active — visible to readers</option>
                      <option value="draft">Draft — staff only</option>
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'copies' && (
            <div className="books-form-section">
              {editing ? (
                <div className="books-empty-note">
                  Copies are managed from the catalog detail pane with <strong>Add Copies</strong>, and their status is changed in the
                  Copies tab. This editor only changes bibliographic metadata.
                </div>
              ) : (
                <>
                  <div className="books-section-title">Initial physical copies</div>
                  <p className="books-muted">Each copy gets a unique Code 128 barcode and a <code>manual_addition</code> transaction.</p>
                  <div className="books-form-grid">
                    <div className="books-field">
                      <label htmlFor="copy-count">Number of copies</label>
                      <input id="copy-count" type="number" min="0" max="100" value={copies.count} onChange={(event) => setCopies({ ...copies, count: event.target.value })} />
                    </div>
                    <div className="books-field">
                      <label htmlFor="copy-condition">Condition</label>
                      <select id="copy-condition" value={copies.condition} onChange={(event) => setCopies({ ...copies, condition: event.target.value })}>
                        {CONDITIONS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
                      </select>
                    </div>
                    <div className="books-field">
                      <label htmlFor="copy-source">Acquisition source</label>
                      <select id="copy-source" value={copies.source_type} onChange={(event) => setCopies({ ...copies, source_type: event.target.value })}>
                        <option value="purchase_outside_batch">Purchase outside batch</option>
                        <option value="donation">Donation</option>
                        <option value="replacement">Replacement</option>
                        <option value="import">Import</option>
                      </select>
                    </div>
                    <div className="books-field">
                      <label htmlFor="copy-shelf">Shelf override</label>
                      <input id="copy-shelf" value={copies.shelf_location} onChange={(event) => setCopies({ ...copies, shelf_location: event.target.value })} placeholder={form.shelf_location || 'Use book default'} />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'cover' && (
            <div className="books-cover-panel">
              <div className="books-cover-preview">
                {coverPreview ? <img src={coverPreview} alt="Cover preview" /> : <span>No cover</span>}
              </div>
              <div>
                <div className="books-section-title">Cover image</div>
                <p className="books-muted">JPEG, PNG, or WebP up to 1 MiB. Uploaded to the public <code>covers</code> bucket.</p>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleCover} hidden />
                <div className="books-inline">
                  <button type="button" className="admin-btn-outline" onClick={() => fileRef.current?.click()}>Choose file</button>
                  {coverFile && <span className="books-muted">{coverFile.name}</span>}
                </div>
                <div className="books-field" style={{ marginTop: 12 }}>
                  <label htmlFor="cover-path">Or use an image URL / stored path</label>
                  <input id="cover-path" value={form.cover_path} onChange={(event) => setField('cover_path', event.target.value)} />
                  <button type="button" className="books-link" onClick={() => { setCoverFile(null); setField('cover_path', '') }}>
                    Remove cover
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="books-modal-actions">
            <button type="button" className="admin-btn-outline books-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="admin-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Save and create copies'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
