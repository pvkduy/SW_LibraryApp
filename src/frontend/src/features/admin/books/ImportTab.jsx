import React, { useRef, useState } from 'react'
import { api } from '../../../lib/api'
import {
  IMPORT_TEMPLATE,
  buildImportPreview,
  downloadText,
  formatVnd,
  uploadToBucket,
} from './booksUtils'

const MAX_BYTES = 2 * 1024 * 1024
const MAX_ROWS = 1000

// UC-19 §2.2.2 / FR-INV-01: a duplicate ISBN adds copies to the existing title.
const DUPLICATE_RULE = 'add_copies'

export function ImportTab({ onImported }) {
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [result, setResult] = useState(null)
  const fileRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const handleFile = async (file) => {
    setFeedback(null)
    setResult(null)
    if (!file) return
    if (!/\.csv$/i.test(file.name)) {
      setFeedback({ type: 'error', message: 'Choose a UTF-8 .csv file.' })
      return
    }
    if (file.size > MAX_BYTES) {
      setFeedback({ type: 'error', message: 'File exceeds the 2 MB upload limit.' })
      return
    }

    try {
      const text = await file.text()
      const parsed = buildImportPreview(text, file.name)
      if (parsed.totalRows > MAX_ROWS) {
        setPreview(parsed)
        setFeedback({ type: 'error', message: `File contains ${parsed.totalRows.toLocaleString('vi-VN')} data rows. The maximum is 1,000 rows; the file was rejected before upload.` })
        return
      }
      setPreview({ ...parsed, file })
      if (parsed.errors.length > 0) {
        setFeedback({ type: 'error', message: `${parsed.errors.length} row(s) have validation errors and will be excluded. ${parsed.validRows.length} valid row(s) are ready.` })
      } else {
        setFeedback({ type: 'success', message: `${parsed.validRows.length} row(s) validated. Review the preview and confirm the import.` })
      }
    } catch (error) {
      setFeedback({ type: 'error', message: error.message })
    }
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    handleFile(file)
  }

  const handleConfirm = async () => {
    if (!preview || preview.totalRows > MAX_ROWS) return
    if (preview.validRows.length === 0) {
      setFeedback({ type: 'error', message: 'No valid rows to import. Correct the file and try again.' })
      return
    }

    setBusy(true)
    setFeedback(null)
    setResult(null)
    try {
      let storagePath = null
      if (preview.file) {
        try {
          storagePath = await uploadToBucket('imports', 'catalog-csv', preview.file)
        } catch {
          // A storage failure must not block the catalog import itself.
          storagePath = null
        }
      }

      const response = await api.invoke('import-books', {
        rows: preview.validRows,
        duplicate_rule: DUPLICATE_RULE,
        source_file: storagePath,
      })
      const data = response.data ?? {}
      setResult({ ...data, storagePath })
      setFeedback({
        type: 'success',
        message: `Import finished: ${data.imported ?? 0} row(s) ingested, ${data.skipped ?? 0} skipped as duplicates${data.errors?.length ? `, ${data.errors.length} server-side error(s)` : ''}.`,
      })
      onImported?.()
    } catch (error) {
      setFeedback({ type: 'error', message: error.message })
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setPreview(null)
    setResult(null)
    setFeedback(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const headerPreview = preview?.rows?.slice(0, 3) ?? []

  return (
    <div className="books-tab">
      <section className="books-panel">
        <div className="books-panel-head">
          <div className="books-step-badge">1</div>
          <div>
            <h3>Upload input CSV</h3>
            <p>UTF-8 / RFC 4180. Use the template to avoid column-name surprises.</p>
          </div>
          <button type="button" className="admin-btn-outline books-btn-sm books-push-right" onClick={() => downloadText('catalog-import-template.csv', IMPORT_TEMPLATE)}>↓ CSV template download</button>
        </div>

        <div
          className={`books-dropzone ${dragging ? 'dragging' : ''}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
          {preview?.fileName ? (
            <div className="books-file-card">
              <span className="books-file-icon">CSV</span>
              <div>
                <strong>{preview.fileName}</strong>
                <div className="books-subline">{preview.totalRows.toLocaleString('vi-VN')} data rows parsed · {preview.validRows.length} valid</div>
              </div>
              <button type="button" className="books-link" onClick={reset}>Remove</button>
            </div>
          ) : (
            <button type="button" className="books-dropzone-cta" onClick={() => fileRef.current?.click()}>
              <span className="books-file-icon">CSV</span>
              <span>
                <strong>Choose a CSV file or drop it here</strong>
                <small>Maximum 2 MB · 1,000 rows · UTF-8</small>
              </span>
            </button>
          )}
          <div className="books-upload-constraints">
            <strong>Upload constraints:</strong>
            <span>Maximum file size: ≤ 2 MB</span>
            <span>Maximum batch limit: ≤ 1,000 rows</span>
            <span>Required encoding: UTF-8 / RFC 4180</span>
            <span style={{ marginTop: 6 }}>Accepted aliases: <code>isbn</code>, <code>author</code>, <code>call_number</code>, <code>initial_copies</code>.</span>
          </div>
        </div>

        <div className="books-schema-hint">
          <span className="books-schema-label">Schema</span>
          <span>isbn13, title, authors, publisher, year, language, category, field, collection, description, keywords, replacement_price, shelf_location, copies</span>
        </div>
      </section>

      <section className="books-panel">
        <div className="books-panel-head">
          <div className="books-step-badge">2</div>
          <div>
            <h3>Erroneous rows preview</h3>
            <p>Only invalid rows are listed with per-row reasons; valid rows are ingested when you confirm.</p>
          </div>
          <span className={`books-badge tone-${preview?.errors?.length ? 'danger' : 'neutral'} books-push-right`}>
            {preview ? `${preview.errors.length} row(s) with errors` : 'No file selected'}
          </span>
        </div>
        <div className="books-schema-hint">
          <span className="books-schema-label">Duplicate ISBN</span>
          <span>Rows whose ISBN already exists in the catalog add copies to the existing title (UC-19 §2.2.2).</span>
        </div>

        {feedback && (
          <div className={`books-alert ${feedback.type === 'error' ? 'danger' : 'success'}`}>
            <span>{feedback.message}</span>
            <button type="button" onClick={() => setFeedback(null)}>✕</button>
          </div>
        )}

        {preview && preview.errors.length > 0 && (
          <div className="books-table-scroll">
            <table className="admin-table books-table import-errors-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>ISBN-13</th>
                  <th>Title & author</th>
                  <th>Shelf</th>
                  <th>Copies</th>
                  <th>Notes & target action</th>
                </tr>
              </thead>
              <tbody>
                {preview.errors.map((error) => (
                  <tr key={`${error.row}-${error.reason}`}>
                    <td className="mono danger-text">{String(error.row).padStart(3, '0')}</td>
                    <td className="mono danger-text">{error.data?.isbn13 || '—'}</td>
                    <td>
                      <div className="books-title-line">{error.data?.title || 'Untitled'}</div>
                      <div className="books-subline">{error.data?.authors?.join(', ') || 'Unknown author'}</div>
                    </td>
                    <td>{error.data?.shelf_location || '—'}</td>
                    <td className="mono">+{error.data?.copies ?? 1}</td>
                    <td className="danger-text">{error.reason} — row excluded from transaction.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {preview && preview.errors.length === 0 && (
          <div className="books-valid-preview">
            <div className="books-valid-head">
              <span className="books-badge tone-success">All {preview.validRows.length} rows valid</span>
              <span className="books-muted">No invalid rows to preview.</span>
            </div>
            {headerPreview.length > 0 && (
              <div className="books-table-scroll">
                <table className="admin-table books-table">
                  <thead>
                    <tr><th>Row</th><th>Title</th><th>ISBN-13</th><th>Collection</th><th>Copies</th><th>Replacement price</th></tr>
                  </thead>
                  <tbody>
                    {headerPreview.map((row) => (
                      <tr key={row.row}>
                        <td className="mono">{row.row}</td>
                        <td>{row.title}</td>
                        <td className="mono">{row.isbn13 || '—'}</td>
                        <td><span className={`books-badge ${row.collection}`}>{row.collection}</span></td>
                        <td className="mono">+{row.copies}</td>
                        <td>{formatVnd(row.replacement_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!preview && (
          <div className="books-empty-note">Upload a CSV to validate rows. Invalid rows remain excluded; nothing is written until you confirm.</div>
        )}
      </section>

      {result && (
        <section className="books-panel books-import-result">
          <div className="books-panel-head">
            <div className="books-step-badge success">✓</div>
            <div>
              <h3>Import committed</h3>
              <p>{result.imported ?? 0} title(s)/stock update(s) ingested · {result.skipped ?? 0} duplicate(s) skipped · {result.errors?.length ?? 0} server error(s).</p>
            </div>
          </div>
          {result.errors?.length > 0 && (
            <ul className="books-error-list">
              {result.errors.map((error) => (
                <li key={`${error.row}-${error.reason}`}>Row {error.row}: {error.reason}</li>
              ))}
            </ul>
          )}
          <div className="books-inline">
            <button type="button" className="admin-btn-outline" onClick={reset}>Import another file</button>
          </div>
        </section>
      )}

      <button
        type="button"
        className="books-confirm-import"
        disabled={busy || !preview || preview.totalRows > MAX_ROWS || preview.validRows.length === 0}
        onClick={handleConfirm}
      >
        {busy ? 'Importing…' : 'Confirm Import'}
      </button>
    </div>
  )
}
