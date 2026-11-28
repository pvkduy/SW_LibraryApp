import React, { useState } from 'react'
import { api } from '../../../lib/api'
import { CONDITIONS, formatVnd } from './booksUtils'

export function AddCopiesModal({ book, onClose, onSaved }) {
  const [count, setCount] = useState(1)
  const [condition, setCondition] = useState('good')
  const [sourceType, setSourceType] = useState('purchase_outside_batch')
  const [shelf, setShelf] = useState('')
  const [barcodes, setBarcodes] = useState('')
  const [reason, setReason] = useState('Copies added to existing title')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFeedback(null)

    const explicitBarcodes = barcodes.split('\n').map((line) => line.trim()).filter(Boolean)
    if (explicitBarcodes.length > 0 && explicitBarcodes.length !== Number(count)) {
      setFeedback({ type: 'error', message: 'The number of barcodes must match the copy count (or leave blank to auto-generate).' })
      return
    }

    setSaving(true)
    try {
      const copies = Array.from({ length: Math.max(1, Number(count) || 1) }, (_, index) => ({
        condition,
        source_type: sourceType,
        shelf_location: shelf.trim() || null,
        barcode: explicitBarcodes[index] || null,
      }))
      const response = await api.invoke('add-copies', { book_id: book.id, copies, reason })
      onSaved?.(response.data)
    } catch (error) {
      setFeedback({ type: 'error', message: error.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="books-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <div className="books-modal" role="dialog" aria-modal="true" aria-label="Add copies">
        <div className="books-modal-head">
          <div>
            <div className="books-eyebrow">Add copies to existing title</div>
            <h2>{book.title}</h2>
            <p>{book.authors?.join(', ') || 'Unknown author'} · {formatVnd(book.replacement_price)} replacement value</p>
          </div>
          <button type="button" className="books-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="books-modal-body" onSubmit={handleSubmit}>
          {feedback && (
            <div className={`books-alert ${feedback.type === 'error' ? 'danger' : 'success'}`}>
              <span>{feedback.message}</span>
              <button type="button" onClick={() => setFeedback(null)}>✕</button>
            </div>
          )}

          <div className="books-form-grid">
            <div className="books-field">
              <label htmlFor="add-copy-count">Number of copies</label>
              <input id="add-copy-count" type="number" min="1" max="100" value={count} onChange={(event) => setCount(event.target.value)} />
            </div>
            <div className="books-field">
              <label htmlFor="add-copy-condition">Condition</label>
              <select id="add-copy-condition" value={condition} onChange={(event) => setCondition(event.target.value)}>
                {CONDITIONS.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
            <div className="books-field">
              <label htmlFor="add-copy-source">Acquisition source</label>
              <select id="add-copy-source" value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
                <option value="purchase_outside_batch">Purchase outside batch</option>
                <option value="donation">Donation</option>
                <option value="replacement">Replacement</option>
                <option value="import">Import</option>
              </select>
            </div>
            <div className="books-field">
              <label htmlFor="add-copy-shelf">Shelf override</label>
              <input id="add-copy-shelf" value={shelf} onChange={(event) => setShelf(event.target.value)} placeholder={book.shelf_location || 'Use book default'} />
            </div>
            <div className="books-field span-2">
              <label htmlFor="add-copy-barcodes">Optional barcodes (one per line)</label>
              <textarea id="add-copy-barcodes" rows="3" value={barcodes} onChange={(event) => setBarcodes(event.target.value)} placeholder="Leave blank to auto-generate ISBN-13 sequences" />
            </div>
            <div className="books-field span-2">
              <label htmlFor="add-copy-reason">Audit reason</label>
              <input id="add-copy-reason" value={reason} onChange={(event) => setReason(event.target.value)} required />
            </div>
          </div>

          <div className="books-modal-actions">
            <button type="button" className="admin-btn-outline books-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="admin-btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create copies'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
