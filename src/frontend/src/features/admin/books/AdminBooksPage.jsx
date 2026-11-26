import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { BOOK_SAFE_COLUMNS, BOOK_SAFE_COLUMNS_WITH_PAGES } from '../../reader/catalog/cartHelpers'
import { StageWriteoffModal } from './StageWriteoffModal.jsx'
import './adminBooks.css'

const EMPTY_BOOK_FORM = {
  id: null,
  title: '',
  authors: '',
  isbn13: '',
  publisher: '',
  year: 2026,
  pages: 320,
  language: 'English',
  category: 'Non-Fiction',
  field: '',
  description: '',
  collection: 'standard',
  replacement_price: 180000,
  shelf_location: '',
  status: 'active',
}

const REASON_OPTIONS = [
  { id: 'damaged', label: 'Damage Beyond Repair' },
  { id: 'lost', label: 'Lost / Permanently Missing' },
  { id: 'obsolete', label: 'Obsolete Edition' },
  { id: 'water_damage', label: 'Water / Mold Damage' },
]

/**
 * ShelfHelp Admin — Books & Inventory
 * Matches the 4 Figma Admin screens:
 *  - A-04 Books & Catalog (Split table + Right Metadata & Tier Inspector)
 *  - A-07 Books: Copies (Split table + Right Change Copy Status & Log Inspector)
 *  - A-15 Books: Write-offs (Split slips list + Right Draft Inspection & Execution)
 *  - A-15 Stage Copy for Write-off Modal (StageWriteoffModal)
 */
export function AdminBooksPage() {
  const [activeTab, setActiveTab] = useState('catalog') // 'catalog' | 'copies' | 'history' | 'writeoffs'
  const [books, setBooks] = useState([])
  const [copies, setCopies] = useState([])
  const [dbSlips, setDbSlips] = useState([])
  const [statusLogs, setStatusLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState(null)

  // Shared Lookup & Filter State
  const [lookupQuery, setLookupQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [conditionFilter, setConditionFilter] = useState('all')
  const [shelfFilter, setShelfFilter] = useState('all')

  // A-04 Catalog Inspector State
  const [selectedBookId, setSelectedBookId] = useState(null)
  const [checkedBookIds, setCheckedBookIds] = useState([])
  const [showBookModal, setShowBookModal] = useState(false)
  const [bookForm, setBookForm] = useState(EMPTY_BOOK_FORM)
  const [showAddCopyModal, setShowAddCopyModal] = useState(false)
  const [copyForm, setCopyForm] = useState({ book_id: '', barcode: '', shelf_location: '', condition: 'good' })

  // A-07 Copies Inspector State
  const [selectedCopyId, setSelectedCopyId] = useState(null)
  const [checkedCopyIds, setCheckedCopyIds] = useState([])
  const [targetCopyStatus, setTargetCopyStatus] = useState('under_repair')
  const [destinationShelf, setDestinationShelf] = useState('')
  const [statusReason, setStatusReason] = useState('')
  const [barcodePreviewCopy, setBarcodePreviewCopy] = useState(null)

  // A-15 Write-offs Draft & Execution State
  const [slipFilter, setSlipFilter] = useState('all') // 'all' | 'draft' | 'completed'
  const [draftSlips, setDraftSlips] = useState([
    {
      id: 'draft-wo-2026-003',
      slip_number: '#WO-2026-003',
      status: 'draft',
      reason: 'damaged',
      stagedCopies: [],
      evidenceFilename: 'water_damage_spine_crack.jpg',
      notes: 'Spine fracture and mold spots visible along signatures 1–4. Beyond economic binding repair.',
      createdBy: 'Thủ Thư Nhóm 7',
      createdAt: '2026-11-25T09:15:00Z',
    },
  ])
  const [selectedSlipId, setSelectedSlipId] = useState('draft-wo-2026-003')
  const [showStageModal, setShowStageModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      let booksRes = await supabase
        .from('books')
        .select(BOOK_SAFE_COLUMNS_WITH_PAGES)
        .order('added_at', { ascending: false })
        .limit(120)

      if (booksRes.error && String(booksRes.error.message || '').toLowerCase().includes('pages')) {
        booksRes = await supabase
          .from('books')
          .select(BOOK_SAFE_COLUMNS)
          .order('added_at', { ascending: false })
          .limit(120)
      }

      const [copiesRes, slipsRes, logsRes] = await Promise.all([
        supabase
          .from('copies')
          .select('id, book_id, barcode, status, shelf_location, condition, source_type, held_until, created_at, books ( id, title, authors, isbn13, shelf_location )')
          .order('barcode', { ascending: true })
          .limit(250),
        supabase
          .from('write_off_slips')
          .select('id, slip_number, reason, condition_at_writeoff, notes, status, target_state, evidence_filename, created_at, copies ( id, barcode ), books ( title )')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('copy_status_logs')
          .select('id, previous_status, new_status, destination_shelf, reason, created_at, copies ( barcode ), books ( title )')
          .order('created_at', { ascending: false })
          .limit(60),
      ])

      const bList = booksRes.data || []
      const cList = copiesRes.data || []
      setBooks(bList)
      setCopies(cList)
      setDbSlips(slipsRes.data || [])
      setStatusLogs(logsRes.data || [])

      setSelectedBookId((prev) => (bList.some((b) => b.id === prev) ? prev : bList[0]?.id ?? null))
      setSelectedCopyId((prev) => (cList.some((c) => c.id === prev) ? prev : cList[0]?.id ?? null))
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Failed to load Books & Inventory.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => {
      loadAll()
    }, 0)
    return () => window.clearTimeout(t)
  }, [loadAll])

  // Distinct shelf list for filter dropdown
  const uniqueShelves = useMemo(() => {
    const s = new Set()
    books.forEach((b) => b.shelf_location && s.add(b.shelf_location))
    copies.forEach((c) => c.shelf_location && s.add(c.shelf_location))
    return Array.from(s)
  }, [books, copies])

  // Filtered Books (A-04)
  const filteredBooks = useMemo(() => {
    const q = lookupQuery.trim().toLowerCase()
    return books.filter((b) => {
      if (statusFilter === 'available' && (b.available_copies ?? 0) <= 0) return false
      if (statusFilter === 'out' && (b.available_copies ?? 0) > 0) return false
      if (statusFilter === 'draft' && b.status !== 'draft') return false
      if (shelfFilter !== 'all' && b.shelf_location !== shelfFilter) return false
      if (!q) return true
      return (
        (b.title || '').toLowerCase().includes(q) ||
        (b.authors || []).join(' ').toLowerCase().includes(q) ||
        (b.isbn13 || '').toLowerCase().includes(q) ||
        (b.shelf_location || '').toLowerCase().includes(q)
      )
    })
  }, [books, lookupQuery, statusFilter, shelfFilter])

  const selectedBook = useMemo(
    () => books.find((b) => b.id === selectedBookId) || filteredBooks[0] || null,
    [books, selectedBookId, filteredBooks],
  )

  const selectedBookCopies = useMemo(
    () => (selectedBook ? copies.filter((c) => c.book_id === selectedBook.id && c.status !== 'retired') : []),
    [copies, selectedBook],
  )

  // Filtered Copies (A-07)
  const filteredCopies = useMemo(() => {
    const q = lookupQuery.trim().toLowerCase()
    return copies.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (conditionFilter !== 'all' && c.condition !== conditionFilter) return false
      if (shelfFilter !== 'all' && c.shelf_location !== shelfFilter) return false
      if (!q) return true
      return (
        (c.barcode || '').toLowerCase().includes(q) ||
        (c.books?.title || '').toLowerCase().includes(q) ||
        (c.books?.authors || []).join(' ').toLowerCase().includes(q) ||
        (c.shelf_location || '').toLowerCase().includes(q)
      )
    })
  }, [copies, lookupQuery, statusFilter, conditionFilter, shelfFilter])

  const selectedCopy = useMemo(
    () => copies.find((c) => c.id === selectedCopyId) || filteredCopies[0] || null,
    [copies, selectedCopyId, filteredCopies],
  )

  // Combined Write-off Slips (Drafts + Completed DB Slips for A-15)
  const allSlips = useMemo(() => {
    const completed = dbSlips.map((s) => ({
      id: s.id,
      slip_number: s.slip_number.startsWith('#') ? s.slip_number : `#${s.slip_number}`,
      status: s.status || 'completed',
      reason: s.reason,
      stagedCopies: s.copies ? [{ copy: { id: s.copies.id, barcode: s.copies.barcode, condition: s.condition_at_writeoff, books: s.books }, targetState: s.target_state || 'retired' }] : [],
      evidenceFilename: s.evidence_filename || 'archived_evidence.jpg',
      notes: s.notes || '',
      createdBy: 'Thủ Thư Nhóm 7',
      createdAt: s.created_at,
    }))
    return [...draftSlips, ...completed]
  }, [draftSlips, dbSlips])

  const filteredSlips = useMemo(() => {
    const q = lookupQuery.trim().toLowerCase()
    return allSlips.filter((s) => {
      if (slipFilter !== 'all' && s.status !== slipFilter) return false
      if (!q) return true
      return (
        s.slip_number.toLowerCase().includes(q) ||
        (s.notes || '').toLowerCase().includes(q) ||
        s.stagedCopies.some((sc) => (sc.copy?.barcode || '').toLowerCase().includes(q))
      )
    })
  }, [allSlips, slipFilter, lookupQuery])

  const selectedSlip = useMemo(
    () => allSlips.find((s) => s.id === selectedSlipId) || filteredSlips[0] || null,
    [allSlips, selectedSlipId, filteredSlips],
  )

  // Handlers — A-04 Catalog
  const handleSelectCopyRow = (copy) => {
    setSelectedCopyId(copy.id)
    setDestinationShelf(copy.shelf_location || copy.books?.shelf_location || '')
    setTargetCopyStatus(copy.status === 'damaged' ? 'under_repair' : copy.status === 'available' ? 'damaged' : 'available')
  }

  const handleQuickTierChange = async (newTier) => {
    if (!selectedBook || selectedBook.collection === newTier) return
    setSaving(true)
    setNotice(null)
    try {
      const { data, error } = await supabase.rpc('rpc_admin_update_book_tier', {
        p_book_id: selectedBook.id,
        p_collection: newTier,
        p_replacement_price: selectedBook.replacement_price ?? 180000,
      })
      if (error) {
        const { error: updErr } = await supabase
          .from('books')
          .update({ collection: newTier })
          .eq('id', selectedBook.id)
        if (updErr) throw updErr
      } else if (!data?.success) {
        throw new Error(data?.message || 'Failed to switch collection tier.')
      }
      setNotice({ type: 'success', text: `Updated "${selectedBook.title}" to ${newTier.toUpperCase()} tier.` })
      await loadAll()
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const openEditBook = (book) => {
    setBookForm({
      id: book.id,
      title: book.title || '',
      authors: (book.authors || []).join(', '),
      isbn13: book.isbn13 || '',
      publisher: book.publisher || '',
      year: book.year || 2026,
      pages: book.pages || 320,
      language: book.language || 'English',
      category: book.category || 'Non-Fiction',
      field: book.field || '',
      description: book.description || '',
      collection: book.collection || 'standard',
      replacement_price: book.replacement_price ?? 180000,
      shelf_location: book.shelf_location || '',
      status: book.status || 'active',
    })
    setShowBookModal(true)
  }

  const handleSaveBook = async (e) => {
    e.preventDefault()
    setSaving(true)
    setNotice(null)
    try {
      const authorsArr = bookForm.authors.split(',').map((s) => s.trim()).filter(Boolean)
      const { data, error } = await supabase.rpc('rpc_admin_upsert_book', {
        p_id: bookForm.id,
        p_title: bookForm.title,
        p_authors: authorsArr,
        p_isbn13: bookForm.isbn13 || null,
        p_publisher: bookForm.publisher || null,
        p_year: bookForm.year ? Number(bookForm.year) : null,
        p_pages: bookForm.pages ? Number(bookForm.pages) : null,
        p_language: bookForm.language,
        p_category: bookForm.category,
        p_field: bookForm.field || null,
        p_description: bookForm.description || null,
        p_collection: bookForm.collection,
        p_replacement_price: Number(bookForm.replacement_price || 100000),
        p_shelf_location: bookForm.shelf_location || null,
        p_status: bookForm.status,
      })
      if (error) throw error
      if (!data?.success) throw new Error(data?.message || 'Could not save title.')

      setShowBookModal(false)
      setNotice({ type: 'success', text: bookForm.id ? 'Title metadata updated.' : 'New title added to catalog!' })
      await loadAll()
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveCopy = async (e) => {
    e.preventDefault()
    setSaving(true)
    setNotice(null)
    try {
      const { data, error } = await supabase.rpc('rpc_admin_add_copy', {
        p_book_id: copyForm.book_id,
        p_barcode: copyForm.barcode,
        p_shelf_location: copyForm.shelf_location || null,
        p_condition: copyForm.condition,
      })
      if (error) throw error
      if (!data?.success) throw new Error(data?.message || 'Failed to register copy.')

      setShowAddCopyModal(false)
      setNotice({ type: 'success', text: `Copy ${copyForm.barcode} added to inventory.` })
      await loadAll()
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  // Handlers — A-07 Copies Status Transition & Batch CSV Export
  const handleUpdateCopyStatus = async () => {
    if (!selectedCopy) return
    if (!statusReason.trim()) {
      setNotice({ type: 'error', text: 'Please enter a mandatory reason for the status change.' })
      return
    }
    setSaving(true)
    setNotice(null)
    try {
      const { data, error } = await supabase.rpc('rpc_admin_update_copy_status', {
        p_copy_id: selectedCopy.id,
        p_new_status: targetCopyStatus,
        p_destination_shelf: destinationShelf || null,
        p_reason: statusReason.trim(),
      })
      if (error) {
        const mappedStatus = targetCopyStatus === 'found' ? 'available' : targetCopyStatus
        const { error: updErr } = await supabase
          .from('copies')
          .update({
            status: mappedStatus,
            shelf_location: destinationShelf || selectedCopy.shelf_location,
          })
          .eq('id', selectedCopy.id)
        if (updErr) throw updErr
      } else if (!data?.success) {
        throw new Error(data?.message || 'Status transition rejected.')
      }

      setStatusReason('')
      setNotice({
        type: 'success',
        text: `Copy ${selectedCopy.barcode} updated to ${targetCopyStatus.replace('_', ' ').toUpperCase()} & transaction logged.`,
      })
      await loadAll()
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleBatchExportCsv = () => {
    const rows = [
      ['Barcode', 'Book Title', 'Status', 'Location', 'Condition'],
      ...filteredCopies.map((c) => [
        c.barcode,
        `"${(c.books?.title || '').replace(/"/g, '""')}"`,
        c.status,
        `"${(c.shelf_location || '').replace(/"/g, '""')}"`,
        c.condition,
      ]),
    ]
    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'shelfhelp-copies-inventory.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Handlers — A-15 Write-offs (Drafts + Staging Modal + Finalize)
  const handleAddDraftSlip = () => {
    const nextNum = draftSlips.length + dbSlips.length + 1
    const newId = `draft-wo-${Date.now()}`
    const slip = {
      id: newId,
      slip_number: `#WO-2026-${String(nextNum).padStart(3, '0')}`,
      status: 'draft',
      reason: 'damaged',
      stagedCopies: [],
      evidenceFilename: '',
      notes: '',
      createdBy: 'Thủ Thư Nhóm 7',
      createdAt: new Date().toISOString(),
    }
    setDraftSlips((prev) => [slip, ...prev])
    setSelectedSlipId(newId)
    setNotice({ type: 'success', text: `Created draft slip ${slip.slip_number}. Stage copies to proceed.` })
  }

  const updateActiveDraft = (patch) => {
    if (!selectedSlip || selectedSlip.status !== 'draft') return
    setDraftSlips((prev) =>
      prev.map((d) => (d.id === selectedSlip.id ? { ...d, ...patch } : d)),
    )
  }

  const handleStageCopyOntoSlip = ({ copy, targetState, assessmentNotes, evidenceFile }) => {
    if (!selectedSlip || selectedSlip.status !== 'draft') return
    updateActiveDraft({
      stagedCopies: [
        ...selectedSlip.stagedCopies.filter((sc) => sc.copy.id !== copy.id),
        { copy, targetState, assessmentNotes },
      ],
      evidenceFilename: evidenceFile || selectedSlip.evidenceFilename,
      notes: assessmentNotes || selectedSlip.notes,
    })
    setShowStageModal(false)
    setNotice({ type: 'success', text: `Staged ${copy.barcode} onto ${selectedSlip.slip_number}.` })
  }

  const handleCompleteWriteoffSlip = async () => {
    if (!selectedSlip || selectedSlip.status !== 'draft') return
    if (selectedSlip.stagedCopies.length === 0) {
      setNotice({ type: 'error', text: 'Please stage at least one physical copy before completing write-off.' })
      return
    }
    if (!selectedSlip.evidenceFilename?.trim()) {
      setNotice({ type: 'error', text: 'Mandatory evidence photo attachment is required.' })
      return
    }

    setSaving(true)
    setNotice(null)
    try {
      for (const staged of selectedSlip.stagedCopies) {
        const { data, error } = await supabase.rpc('rpc_admin_writeoff_copy', {
          p_copy_id: staged.copy.id,
          p_reason: selectedSlip.reason,
          p_notes: selectedSlip.notes || staged.assessmentNotes || 'Completed write-off slip',
        })
        if (error) throw error
        if (!data?.success) throw new Error(data?.message || `Failed to write off ${staged.copy.barcode}.`)
      }

      setDraftSlips((prev) => prev.filter((d) => d.id !== selectedSlip.id))
      setNotice({
        type: 'success',
        text: `Write-off ${selectedSlip.slip_number} completed permanently! ${selectedSlip.stagedCopies.length} copy(ies) retired.`,
      })
      await loadAll()
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleDiscardDraft = () => {
    if (!selectedSlip || selectedSlip.status !== 'draft') return
    setDraftSlips((prev) => prev.filter((d) => d.id !== selectedSlip.id))
    setNotice({ type: 'success', text: `Discarded draft ${selectedSlip.slip_number}.` })
  }

  return (
    <div className="ab-page">
      {/* Header matching Figma A-04 / A-07 / A-15 */}
      <div className="ab-header">
        <h1>Books &amp; Inventory</h1>
        <p>Physical copy inventory, condition tracking, status transitions &amp; barcode printing</p>
      </div>

      {/* Sub-Tabs matching Figma */}
      <div className="ab-tabs">
        <button
          type="button"
          className={`ab-tab ${activeTab === 'catalog' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('catalog')
            setStatusFilter('all')
          }}
        >
          <span>📖 Catalog (A-04)</span>
          <span className="ab-tab-count">{books.length}</span>
        </button>

        <button
          type="button"
          className={`ab-tab ${activeTab === 'copies' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('copies')
            setStatusFilter('all')
          }}
        >
          <span>🏷️ Copies (A-07)</span>
          <span className="ab-tab-count">{copies.length}</span>
        </button>

        <button
          type="button"
          className={`ab-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <span>🕒 History (A-14)</span>
          <span className="ab-tab-count">{statusLogs.length}</span>
        </button>

        <button
          type="button"
          className={`ab-tab ${activeTab === 'writeoffs' ? 'active' : ''}`}
          onClick={() => setActiveTab('writeoffs')}
        >
          <span>🗑️ Write-offs (A-15)</span>
          <span className="ab-tab-count">{allSlips.length}</span>
          {draftSlips.length > 0 && <span className="ab-tab-dot" />}
        </button>
      </div>

      {notice && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: 600,
            background: notice.type === 'error' ? '#fee2e2' : '#dcfce7',
            color: notice.type === 'error' ? '#b91c1c' : '#15803d',
            border: `1px solid ${notice.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
          }}
        >
          {notice.text}
        </div>
      )}

      {/* =====================================================================
          SCREEN 1: A-04 BOOKS & CATALOG
          ===================================================================== */}
      {activeTab === 'catalog' && (
        <>
          <div className="ab-lookup-card">
            <div className="ab-lookup-input-wrap">
              <span style={{ color: '#8c8277' }}>|||</span>
              <input
                type="search"
                placeholder="Search title, author, ISBN, or barcode (e.g. Clean Code, 9780465050659)..."
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
              />
              <span className="ab-kbd">Enter</span>
            </div>
            <button type="button" className="ab-btn-brown" onClick={loadAll}>
              🔍 Lookup
            </button>
            <button
              type="button"
              className="ab-btn-brown"
              onClick={() => {
                setBookForm(EMPTY_BOOK_FORM)
                setShowBookModal(true)
              }}
            >
              + Add Title
            </button>
          </div>

          <div className="ab-filters-row">
            <select
              className="ab-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Status: All Statuses</option>
              <option value="available">Status: Available on Shelf</option>
              <option value="out">Status: All Copies On Loan</option>
              <option value="draft">Status: Draft Only</option>
            </select>
            <select
              className="ab-filter-select"
              value={shelfFilter}
              onChange={(e) => setShelfFilter(e.target.value)}
            >
              <option value="all">Shelf: All Shelves</option>
              {uniqueShelves.map((sh) => (
                <option key={sh} value={sh}>
                  Shelf: {sh}
                </option>
              ))}
            </select>
          </div>

          <div className="ab-split">
            {/* Left Catalog Table */}
            <div className="ab-panel">
              <div style={{ overflowX: 'auto' }}>
                <table className="ab-table">
                  <thead>
                    <tr>
                      <th style={{ width: '32px' }} />
                      <th>Title &amp; Author</th>
                      <th>ISBN</th>
                      <th>Collection</th>
                      <th>Copies</th>
                      <th>Shelf</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '28px', color: '#7c736a' }}>
                          Loading catalog...
                        </td>
                      </tr>
                    ) : filteredBooks.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '28px', color: '#7c736a' }}>
                          No titles match your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredBooks.map((book) => {
                        const isSelected = selectedBook?.id === book.id
                        const isChecked = checkedBookIds.includes(book.id)
                        return (
                          <tr
                            key={book.id}
                            className={isSelected ? 'selected' : ''}
                            onClick={() => setSelectedBookId(book.id)}
                          >
                            <td onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) =>
                                  setCheckedBookIds((prev) =>
                                    e.target.checked
                                      ? [...prev, book.id]
                                      : prev.filter((id) => id !== book.id),
                                  )
                                }
                              />
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div className="ab-thumb">
                                  {(book.title || 'BK').slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 700, color: '#241e19', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {book.title}
                                    {book.status === 'draft' && <span className="ab-pill ab-pill-draft">DRAFT</span>}
                                  </div>
                                  <div style={{ fontSize: '14px', color: '#7c736a' }}>
                                    {book.authors?.join(', ') || 'Unknown Author'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td style={{ fontFamily: 'monospace', fontSize: '14px', color: '#5b524a' }}>
                              {book.isbn13 || '—'}
                            </td>
                            <td>
                              <span className={`ab-pill ab-pill-${book.collection}`}>
                                {book.collection}
                              </span>
                            </td>
                            <td style={{ fontWeight: 700 }}>
                              {book.available_copies} / {book.total_copies}
                            </td>
                            <td style={{ fontSize: '14px', color: '#6e665e' }}>
                              {book.shelf_location || '—'}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="ab-table-footer">
                <span>
                  Showing 1–{filteredBooks.length} of {books.length} titles • {checkedBookIds.length} selected
                </span>
                <span>Page 1 of 1</span>
              </div>
            </div>

            {/* Right Inspector Drawer (Figma A-04) */}
            {selectedBook && (
              <aside className="ab-panel ab-panel-pad">
                {/* Book Top Summary */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                  <div className="ab-thumb" style={{ width: '58px', height: '78px', fontSize: '17px' }}>
                    {(selectedBook.title || 'BK').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '5px', flexWrap: 'wrap' }}>
                      <span className={`ab-pill ab-pill-${selectedBook.collection}`}>
                        {selectedBook.collection === 'premium' ? 'PREMIUM TIER' : 'STANDARD'}
                      </span>
                      <span
                        className={`ab-pill ${(selectedBook.available_copies ?? 0) > 0 ? 'ab-pill-available' : 'ab-pill-borrowed'}`}
                      >
                        {(selectedBook.available_copies ?? 0) > 0 ? 'AVAILABLE' : 'ALL ON LOAN'}
                      </span>
                    </div>
                    <h3 style={{ margin: '0 0 2px', fontSize: '19px', fontWeight: 800, color: '#241e19' }}>
                      {selectedBook.title}
                    </h3>
                    <div style={{ fontSize: '14px', color: '#6e665e', marginBottom: '4px' }}>
                      {selectedBook.authors?.join(', ')}
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '14px',
                        color: '#8c8277',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {selectedBook.description || 'No description recorded.'}
                    </p>
                  </div>
                </div>

                {/* TITLE METADATA */}
                <div className="ab-inspector-label">
                  <span>Title Metadata</span>
                  <button
                    type="button"
                    onClick={() => openEditBook(selectedBook)}
                    style={{ background: 'none', border: 'none', color: '#6e472a', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
                  >
                    Edit ↗
                  </button>
                </div>
                <div className="ab-meta-grid">
                  <div className="ab-meta-cell">
                    <small>Publisher &amp; Year</small>
                    <strong>
                      {selectedBook.publisher || 'University Press'}, {selectedBook.year || '—'}
                    </strong>
                  </div>
                  <div className="ab-meta-cell">
                    <small>Language</small>
                    <strong>{selectedBook.language || 'English'}</strong>
                  </div>
                  <div className="ab-meta-cell">
                    <small>ISBN-13</small>
                    <strong style={{ fontFamily: 'monospace' }}>{selectedBook.isbn13 || '—'}</strong>
                  </div>
                  <div className="ab-meta-cell">
                    <small>Pages</small>
                    <strong>{selectedBook.pages ? `${selectedBook.pages} pages` : '—'}</strong>
                  </div>
                  <div className="ab-meta-cell">
                    <small>Category / Field</small>
                    <strong>
                      {selectedBook.category || 'General'} {selectedBook.field ? `/ ${selectedBook.field}` : ''}
                    </strong>
                  </div>
                  <div className="ab-meta-cell">
                    <small>Primary Shelf</small>
                    <strong>{selectedBook.shelf_location || '—'}</strong>
                  </div>
                </div>

                {/* Collection Tier Selection (Figma A-04) */}
                <div className="ab-inspector-label">Collection Tier Selection</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                  <button
                    type="button"
                    disabled={saving}
                    className={`ab-radio-card ${selectedBook.collection === 'standard' ? 'selected' : ''}`}
                    onClick={() => handleQuickTierChange('standard')}
                  >
                    <span className="ab-radio-dot" />
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 700 }}>Standard</div>
                      <div style={{ fontSize: '13px', color: '#7c736a' }}>Free loan · 7–14d</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    className={`ab-radio-card ${selectedBook.collection === 'premium' ? 'selected' : ''}`}
                    onClick={() => handleQuickTierChange('premium')}
                  >
                    <span className="ab-radio-dot" />
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 700 }}>Premium Tier</div>
                      <div style={{ fontSize: '13px', color: '#7c736a' }}>5.000₫ / 7d · Priority</div>
                    </div>
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '14px',
                    padding: '8px 10px',
                    background: '#faf7f2',
                    borderRadius: '8px',
                    marginBottom: '14px',
                  }}
                >
                  <span style={{ color: '#6e665e' }}>Required Replacement Price</span>
                  <strong style={{ color: '#241e19' }}>
                    {(selectedBook.replacement_price || 100000).toLocaleString('vi-VN')}₫
                  </strong>
                </div>

                {/* Physical Copies Summary */}
                <div className="ab-inspector-label">
                  <span>Physical Copies Summary ({selectedBookCopies.length})</span>
                  <button
                    type="button"
                    onClick={() => {
                      setLookupQuery(selectedBook.title)
                      setActiveTab('copies')
                    }}
                    style={{ background: 'none', border: 'none', color: '#6e472a', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                  >
                    View All Copies →
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                  {selectedBookCopies.length === 0 ? (
                    <div style={{ fontSize: '14px', color: '#8c8277' }}>No physical copies registered.</div>
                  ) : (
                    selectedBookCopies.slice(0, 4).map((c) => (
                      <div
                        key={c.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          background: '#faf8f5',
                          border: '1px solid #ede6db',
                          borderRadius: '8px',
                          fontSize: '14px',
                        }}
                      >
                        <div>
                          <strong style={{ fontFamily: 'monospace' }}>{c.barcode}</strong>
                          <div style={{ fontSize: '13px', color: '#7c736a' }}>{c.shelf_location || selectedBook.shelf_location}</div>
                        </div>
                        <span className={`ab-pill ab-pill-${c.status}`}>{c.status}</span>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button type="button" className="ab-btn-outline" style={{ width: '100%' }} onClick={() => openEditBook(selectedBook)}>
                    ✎ Edit Metadata
                  </button>
                  <button
                    type="button"
                    className="ab-btn-brown"
                    style={{ width: '100%' }}
                    onClick={() => {
                      setCopyForm({
                        book_id: selectedBook.id,
                        barcode: `BK-${Math.floor(10000 + Math.random() * 90000)}`,
                        shelf_location: selectedBook.shelf_location || '',
                        condition: 'good',
                      })
                      setShowAddCopyModal(true)
                    }}
                  >
                    + Add Copies to Title
                  </button>
                </div>
              </aside>
            )}
          </div>
        </>
      )}

      {/* =====================================================================
          SCREEN 2: A-07 BOOKS: COPIES
          ===================================================================== */}
      {activeTab === 'copies' && (
        <>
          <div className="ab-lookup-card">
            <div className="ab-lookup-input-wrap">
              <span style={{ color: '#8c8277' }}>|||</span>
              <input
                type="search"
                placeholder="Scan or search copy barcode (e.g. BK-10019)..."
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
              />
              <span className="ab-kbd">Enter</span>
            </div>
            <button type="button" className="ab-btn-brown" onClick={loadAll}>
              🔍 Lookup
            </button>
            <button type="button" className="ab-btn-outline" onClick={handleBatchExportCsv}>
              ⇩ Batch Export
            </button>
          </div>

          <div className="ab-filters-row">
            <select className="ab-filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Status: All Statuses</option>
              <option value="available">Available</option>
              <option value="borrowed">Borrowed</option>
              <option value="held">Held</option>
              <option value="damaged">Damaged</option>
              <option value="under_repair">Under Repair</option>
              <option value="lost">Lost</option>
              <option value="retired">Retired</option>
            </select>
            <select className="ab-filter-select" value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)}>
              <option value="all">Condition: All Conditions</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
              <option value="damaged">Damaged</option>
            </select>
            <select className="ab-filter-select" value={shelfFilter} onChange={(e) => setShelfFilter(e.target.value)}>
              <option value="all">Shelf: All Shelves</option>
              {uniqueShelves.map((sh) => (
                <option key={sh} value={sh}>
                  {sh}
                </option>
              ))}
            </select>
          </div>

          <div className="ab-split">
            {/* Left Copies Table */}
            <div className="ab-panel">
              <div style={{ overflowX: 'auto' }}>
                <table className="ab-table">
                  <thead>
                    <tr>
                      <th style={{ width: '32px' }} />
                      <th>Barcode</th>
                      <th>Title &amp; Author</th>
                      <th>Status</th>
                      <th>Location</th>
                      <th>Condition</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCopies.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '28px', color: '#7c736a' }}>
                          No physical copies match your criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredCopies.map((copy) => {
                        const isSelected = selectedCopy?.id === copy.id
                        const isChecked = checkedCopyIds.includes(copy.id)
                        return (
                          <tr
                            key={copy.id}
                            className={isSelected ? 'selected' : ''}
                            onClick={() => handleSelectCopyRow(copy)}
                          >
                            <td onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) =>
                                  setCheckedCopyIds((prev) =>
                                    e.target.checked
                                      ? [...prev, copy.id]
                                      : prev.filter((id) => id !== copy.id),
                                  )
                                }
                              />
                            </td>
                            <td style={{ fontWeight: 700, fontFamily: 'monospace', color: '#241e19' }}>
                              {copy.barcode}
                            </td>
                            <td>
                              <div style={{ fontWeight: 700, color: '#241e19' }}>{copy.books?.title || '—'}</div>
                              <div style={{ fontSize: '13px', color: '#7c736a' }}>
                                {copy.books?.authors?.join(', ')}
                              </div>
                            </td>
                            <td>
                              <span className={`ab-pill ab-pill-${copy.status}`}>
                                {copy.status.replace('_', ' ')}
                              </span>
                            </td>
                            <td style={{ fontSize: '14px', color: '#5b524a' }}>
                              {copy.shelf_location || copy.books?.shelf_location || '—'}
                            </td>
                            <td style={{ textTransform: 'capitalize', fontWeight: 600, color: copy.condition === 'damaged' ? '#b91c1c' : '#4b423b' }}>
                              {copy.condition}
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setActiveTab('history')
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#6e472a',
                                  fontWeight: 700,
                                  fontSize: '14px',
                                  cursor: 'pointer',
                                }}
                              >
                                Copy History →
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="ab-table-footer">
                <span>
                  Showing 1–{filteredCopies.length} of {copies.length} copies • {checkedCopyIds.length} selected
                </span>
                <span>Page 1 of 1</span>
              </div>
            </div>

            {/* Right Inspector: Change Copy Status (Figma A-07) */}
            {selectedCopy && (
              <aside className="ab-panel ab-panel-pad">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '19px', fontWeight: 800 }}>Change Copy Status</h3>
                  <span style={{ fontFamily: 'monospace', fontSize: '14px', background: '#f5efe6', color: '#6e472a', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                    {selectedCopy.barcode}
                  </span>
                </div>

                {/* Selected copy banner */}
                <div
                  style={{
                    background: '#faf7f2',
                    border: '1px solid #ede6db',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    marginBottom: '14px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '16px', color: '#241e19' }}>{selectedCopy.books?.title}</strong>
                    <span className={`ab-pill ab-pill-${selectedCopy.status}`}>{selectedCopy.status.replace('_', ' ')}</span>
                  </div>
                  <div style={{ fontSize: '14px', color: '#7c736a', marginTop: '4px' }}>
                    📍 Current Location: {selectedCopy.shelf_location || selectedCopy.books?.shelf_location || 'Main Shelf'}
                  </div>
                </div>

                {/* Status Radio Options matching Figma A-07 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                  {[
                    { id: 'available', title: 'Available', desc: 'Return copy to active circulating stock' },
                    { id: 'damaged', title: 'Damaged', desc: 'Flagged for damage assessment & write-off' },
                    { id: 'under_repair', title: 'Under Repair', desc: 'Temporarily withdrawn while being repaired/rebound' },
                    { id: 'found', title: 'Found', desc: 'Recovered copy previously marked lost or overdue' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`ab-radio-card ${targetCopyStatus === opt.id ? 'selected' : ''}`}
                      onClick={() => setTargetCopyStatus(opt.id)}
                    >
                      <span className="ab-radio-dot" />
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#241e19' }}>{opt.title}</div>
                        <div style={{ fontSize: '13px', color: '#7c736a' }}>{opt.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#5b524a', marginBottom: '4px' }}>
                    Destination Shelf
                  </label>
                  <input
                    type="text"
                    value={destinationShelf}
                    onChange={(e) => setDestinationShelf(e.target.value)}
                    placeholder="e.g. Shelf B-04 (Conservation Bench)"
                    style={{
                      width: '100%',
                      height: '36px',
                      borderRadius: '8px',
                      border: '1px solid #dcd3c5',
                      padding: '0 10px',
                      fontSize: '15px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#5b524a', marginBottom: '4px' }}>
                    Mandatory Reason for Status Change *
                  </label>
                  <textarea
                    rows={3}
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder="Spine hinge deterioration along page 45; routed to conservation bench for archival glue regluing..."
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #dcd3c5',
                      padding: '8px 10px',
                      fontSize: '15px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="ab-btn-outline"
                    onClick={() => setStatusReason('')}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="ab-btn-brown"
                    style={{ background: '#8b5e3c' }}
                    onClick={() => setBarcodePreviewCopy(selectedCopy)}
                  >
                    🖨 Print Barcode
                  </button>
                  <button
                    type="button"
                    className="ab-btn-brown"
                    style={{ flex: 1 }}
                    disabled={saving || !statusReason.trim()}
                    onClick={handleUpdateCopyStatus}
                  >
                    {saving ? 'Updating...' : '✓ Update & Log Transaction'}
                  </button>
                </div>
              </aside>
            )}
          </div>
        </>
      )}

      {/* =====================================================================
          HISTORY TAB (A-14 Audit Trail linked from A-07)
          ===================================================================== */}
      {activeTab === 'history' && (
        <div className="ab-panel">
          <div style={{ overflowX: 'auto' }}>
            <table className="ab-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Barcode</th>
                  <th>Book Title</th>
                  <th>Transition</th>
                  <th>Destination Shelf</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {statusLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '28px', color: '#7c736a' }}>
                      No copy status transitions logged yet. Update a copy status in <strong>Copies (A-07)</strong> to create an audit entry.
                    </td>
                  </tr>
                ) : (
                  statusLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '14px', color: '#7c736a' }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{log.copies?.barcode || '—'}</td>
                      <td style={{ fontWeight: 600 }}>{log.books?.title || '—'}</td>
                      <td>
                        <span className={`ab-pill ab-pill-${log.previous_status}`}>{log.previous_status}</span>
                        {' → '}
                        <span className={`ab-pill ab-pill-${log.new_status}`}>{log.new_status}</span>
                      </td>
                      <td>{log.destination_shelf || '—'}</td>
                      <td style={{ color: '#5b524a' }}>{log.reason}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 3: A-15 BOOKS: WRITE-OFFS
          ===================================================================== */}
      {activeTab === 'writeoffs' && (
        <>
          <div className="ab-lookup-card">
            <div className="ab-lookup-input-wrap">
              <span style={{ color: '#8c8277' }}>|||</span>
              <input
                type="search"
                placeholder="Search slip number or barcode (e.g. #WO-2026-003, BK-10019)..."
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
              />
              <span className="ab-kbd">Enter</span>
            </div>
            <button type="button" className="ab-btn-brown" onClick={loadAll}>
              🔍 Lookup
            </button>
            <button type="button" className="ab-btn-brown" onClick={handleAddDraftSlip}>
              + Add Slip
            </button>
          </div>

          <div className="ab-filters-row">
            {[
              { id: 'all', label: `All Slips (${allSlips.length})` },
              { id: 'draft', label: `Drafts (${draftSlips.length})` },
              { id: 'completed', label: `Completed (${dbSlips.length})` },
            ].map((pill) => (
              <button
                key={pill.id}
                type="button"
                className={slipFilter === pill.id ? 'ab-btn-brown' : 'ab-btn-outline'}
                style={{ height: '32px', fontSize: '14px', borderRadius: '999px' }}
                onClick={() => setSlipFilter(pill.id)}
              >
                {pill.label}
              </button>
            ))}
          </div>

          <div className="ab-split">
            {/* Left Write-off Slips List */}
            <div>
              {filteredSlips.length === 0 ? (
                <div className="ab-panel ab-panel-pad" style={{ textAlign: 'center', color: '#7c736a' }}>
                  No write-off slips match this filter. Click <strong>+ Add Slip</strong> to begin a write-off.
                </div>
              ) : (
                filteredSlips.map((slip) => {
                  const isSelected = selectedSlip?.id === slip.id
                  const isDraft = slip.status === 'draft'
                  return (
                    <div
                      key={slip.id}
                      className={`ab-slip-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedSlipId(slip.id)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ fontSize: '17px', fontFamily: 'monospace' }}>{slip.slip_number}</strong>
                          <span className={`ab-pill ${isDraft ? 'ab-pill-draft' : 'ab-pill-completed'}`}>
                            {isDraft ? 'DRAFT · IN PROGRESS' : '✓ COMPLETED'}
                          </span>
                        </div>
                        <span style={{ fontSize: '14px', color: '#8c8277' }}>
                          {new Date(slip.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div style={{ fontSize: '15px', color: '#5b524a', marginBottom: '8px' }}>
                        {slip.stagedCopies.length} {slip.stagedCopies.length === 1 ? 'copy' : 'copies'}{' '}
                        {isDraft ? 'staged' : 'retired'}
                        {isDraft && !slip.evidenceFilename && (
                          <span style={{ color: '#b91c1c', fontWeight: 700, marginLeft: '8px' }}>
                            • Evidence Required
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #f2ece3' }}>
                        <span style={{ fontSize: '14px', color: '#7c736a' }}>
                          {isDraft ? `Created by ${slip.createdBy}` : `Signed off by ${slip.createdBy}`}
                        </span>
                        <span
                          className={isDraft ? 'ab-btn-brown' : 'ab-btn-outline'}
                          style={{ height: '28px', padding: '0 10px', fontSize: '14px' }}
                        >
                          {isDraft ? '✎ Edit Draft' : 'View Slip & History'}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Right Draft Inspection & Execution Panel (Figma A-15) */}
            {selectedSlip && (
              <aside className="ab-panel ab-panel-pad">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '19px', fontWeight: 800, fontFamily: 'monospace' }}>
                      {selectedSlip.slip_number}
                    </h3>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#8c8277', letterSpacing: '0.5px', marginTop: '2px' }}>
                      {selectedSlip.status === 'draft' ? 'DRAFT INSPECTION & EXECUTION' : 'FINALIZED ARCHIVAL RECORD'}
                    </div>
                  </div>
                  <span className={`ab-pill ${selectedSlip.status === 'draft' ? 'ab-pill-draft' : 'ab-pill-completed'}`}>
                    {selectedSlip.status === 'draft' ? 'IN PROGRESS' : 'COMPLETED'}
                  </span>
                </div>

                {/* Mandatory Reason Code 2x2 Grid */}
                <div className="ab-inspector-label">Mandatory Reason Code</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                  {REASON_OPTIONS.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      disabled={selectedSlip.status !== 'draft'}
                      className={`ab-radio-card ${selectedSlip.reason === r.id ? 'selected' : ''}`}
                      onClick={() => updateActiveDraft({ reason: r.id })}
                    >
                      <span className="ab-radio-dot" />
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#241e19' }}>{r.label}</span>
                    </button>
                  ))}
                </div>

                {/* Staged Copies */}
                <div className="ab-inspector-label">
                  <span>Staged Copies ({selectedSlip.stagedCopies.length})</span>
                  {selectedSlip.status === 'draft' && (
                    <button
                      type="button"
                      onClick={() => setShowStageModal(true)}
                      style={{ background: 'none', border: 'none', color: '#6e472a', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
                    >
                      + Stage Another Copy
                    </button>
                  )}
                </div>

                <div style={{ marginBottom: '14px' }}>
                  {selectedSlip.stagedCopies.length === 0 ? (
                    <div
                      style={{
                        border: '1.5px dashed #dcd3c5',
                        borderRadius: '10px',
                        padding: '14px',
                        textAlign: 'center',
                        fontSize: '14px',
                        color: '#7c736a',
                      }}
                    >
                      No copies staged yet.{' '}
                      <button
                        type="button"
                        onClick={() => setShowStageModal(true)}
                        style={{ background: 'none', border: 'none', color: '#6e472a', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}
                      >
                        Stage Copy for Write-off
                      </button>
                    </div>
                  ) : (
                    selectedSlip.stagedCopies.map((sc) => (
                      <div
                        key={sc.copy.id}
                        style={{
                          background: '#faf8f5',
                          border: '1px solid #ede6db',
                          borderRadius: '10px',
                          padding: '10px 12px',
                          marginBottom: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '16px', fontWeight: 700 }}>
                            {sc.copy.books?.title || 'Book Copy'} •{' '}
                            <span style={{ fontFamily: 'monospace', color: '#6e472a' }}>{sc.copy.barcode}</span>
                          </div>
                          <div style={{ fontSize: '13px', color: '#7c736a', marginTop: '2px' }}>
                            Condition: <strong style={{ textTransform: 'capitalize' }}>{sc.copy.condition}</strong> • Target:{' '}
                            <strong style={{ textTransform: 'uppercase' }}>{sc.targetState}</strong>
                          </div>
                        </div>
                        {selectedSlip.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() =>
                              updateActiveDraft({
                                stagedCopies: selectedSlip.stagedCopies.filter((x) => x.copy.id !== sc.copy.id),
                              })
                            }
                            style={{ background: 'none', border: 'none', fontSize: '19px', color: '#8c8277', cursor: 'pointer' }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Evidence Photo & Assessment */}
                <div className="ab-inspector-label">Evidence Photo &amp; Assessment (Mandatory)</div>
                <div
                  style={{
                    background: '#faf8f5',
                    border: '1px solid #ede6db',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#241e19' }}>
                      📷 {selectedSlip.evidenceFilename || 'No photo attached'}
                    </div>
                    <div style={{ fontSize: '13px', color: '#7c736a' }}>
                      Verified Evidence Attachment (Archival Log)
                    </div>
                  </div>
                  {selectedSlip.status === 'draft' && (
                    <label
                      style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#6e472a',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      + Upload photo
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) updateActiveDraft({ evidenceFilename: f.name })
                        }}
                      />
                    </label>
                  )}
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#6e665e', marginBottom: '4px' }}>
                    Detailed Assessment Notes
                  </label>
                  <textarea
                    rows={3}
                    disabled={selectedSlip.status !== 'draft'}
                    value={selectedSlip.notes}
                    onChange={(e) => updateActiveDraft({ notes: e.target.value })}
                    placeholder="Record physical damage inspection notes..."
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #dcd3c5',
                      padding: '8px 10px',
                      fontSize: '15px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {selectedSlip.status === 'draft' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <button
                        type="button"
                        className="ab-btn-outline"
                        onClick={() => setNotice({ type: 'success', text: `Saved draft ${selectedSlip.slip_number}.` })}
                      >
                        Save Draft
                      </button>
                      <button type="button" className="ab-btn-danger-outline" onClick={handleDiscardDraft}>
                        Discard Slip
                      </button>
                    </div>
                    <button
                      type="button"
                      className="ab-btn-brown"
                      style={{ width: '100%' }}
                      disabled={saving || selectedSlip.stagedCopies.length === 0}
                      onClick={handleCompleteWriteoffSlip}
                    >
                      {saving ? 'Finalizing...' : '✓ Complete Write-off (Irreversible)'}
                    </button>
                  </div>
                )}
              </aside>
            )}
          </div>
        </>
      )}

      {/* SCREEN 4 MODAL: Stage Copy for Write-off */}
      {showStageModal && selectedSlip && (
        <StageWriteoffModal
          copies={copies}
          alreadyStagedIds={selectedSlip.stagedCopies.map((sc) => sc.copy.id)}
          onClose={() => setShowStageModal(false)}
          onStageCopy={handleStageCopyOntoSlip}
        />
      )}

      {/* MODAL: Add / Edit Book Title (from A-04) */}
      {showBookModal && (
        <div className="ab-modal-backdrop" onClick={() => setShowBookModal(false)}>
          <div className="ab-modal-box" style={{ maxWidth: '520px', padding: '22px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 14px' }}>{bookForm.id ? 'Edit Book Metadata' : 'Add New Catalog Title'}</h3>
            <form onSubmit={handleSaveBook} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '14px', fontWeight: 700 }}>Title *</label>
                <input
                  required
                  value={bookForm.title}
                  onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                  style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid #dcd3c5', padding: '0 10px', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '14px', fontWeight: 700 }}>Authors (comma separated)</label>
                <input
                  value={bookForm.authors}
                  onChange={(e) => setBookForm({ ...bookForm, authors: e.target.value })}
                  style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid #dcd3c5', padding: '0 10px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 700 }}>ISBN-13</label>
                <input
                  value={bookForm.isbn13}
                  onChange={(e) => setBookForm({ ...bookForm, isbn13: e.target.value })}
                  style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid #dcd3c5', padding: '0 10px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 700 }}>Publisher</label>
                <input
                  value={bookForm.publisher}
                  onChange={(e) => setBookForm({ ...bookForm, publisher: e.target.value })}
                  style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid #dcd3c5', padding: '0 10px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 700 }}>Category</label>
                <select
                  value={bookForm.category}
                  onChange={(e) => setBookForm({ ...bookForm, category: e.target.value })}
                  style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid #dcd3c5', padding: '0 10px' }}
                >
                  <option value="Non-Fiction">Non-Fiction</option>
                  <option value="Fiction">Fiction</option>
                  <option value="Science">Science</option>
                  <option value="Computer Science">Computer Science</option>
                  <option value="Natural Sciences">Natural Sciences</option>
                  <option value="Arts">Arts</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 700 }}>Collection Tier</label>
                <select
                  value={bookForm.collection}
                  onChange={(e) => setBookForm({ ...bookForm, collection: e.target.value })}
                  style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid #dcd3c5', padding: '0 10px' }}
                >
                  <option value="standard">Standard</option>
                  <option value="premium">Premium Tier</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 700 }}>Shelf Location</label>
                <input
                  value={bookForm.shelf_location}
                  onChange={(e) => setBookForm({ ...bookForm, shelf_location: e.target.value })}
                  style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid #dcd3c5', padding: '0 10px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 700 }}>Status</label>
                <select
                  value={bookForm.status}
                  onChange={(e) => setBookForm({ ...bookForm, status: e.target.value })}
                  style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid #dcd3c5', padding: '0 10px' }}
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '14px', fontWeight: 700 }}>Description</label>
                <textarea
                  rows={3}
                  value={bookForm.description}
                  onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })}
                  style={{ width: '100%', borderRadius: '8px', border: '1px solid #dcd3c5', padding: '8px 10px', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button type="button" className="ab-btn-outline" onClick={() => setShowBookModal(false)}>Cancel</button>
                <button type="submit" className="ab-btn-brown" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Title'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Physical Copy (from A-04) */}
      {showAddCopyModal && (
        <div className="ab-modal-backdrop" onClick={() => setShowAddCopyModal(false)}>
          <div className="ab-modal-box" style={{ maxWidth: '420px', padding: '22px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 14px' }}>Add Physical Copy to Title</h3>
            <form onSubmit={handleSaveCopy} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 700 }}>Book Title</label>
                <select
                  required
                  value={copyForm.book_id}
                  onChange={(e) => setCopyForm({ ...copyForm, book_id: e.target.value })}
                  style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid #dcd3c5', padding: '0 10px' }}
                >
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>{b.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 700 }}>Barcode *</label>
                <input
                  required
                  value={copyForm.barcode}
                  onChange={(e) => setCopyForm({ ...copyForm, barcode: e.target.value })}
                  style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid #dcd3c5', padding: '0 10px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 700 }}>Shelf Location</label>
                <input
                  value={copyForm.shelf_location}
                  onChange={(e) => setCopyForm({ ...copyForm, shelf_location: e.target.value })}
                  style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid #dcd3c5', padding: '0 10px', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button type="button" className="ab-btn-outline" onClick={() => setShowAddCopyModal(false)}>Cancel</button>
                <button type="submit" className="ab-btn-brown" disabled={saving}>
                  {saving ? 'Adding...' : 'Register Copy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Print Barcode Label (from A-07) */}
      {barcodePreviewCopy && (
        <div className="ab-modal-backdrop" onClick={() => setBarcodePreviewCopy(null)}>
          <div className="ab-modal-box" style={{ maxWidth: '340px', padding: '24px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 6px' }}>Barcode Label Preview</h3>
            <p style={{ margin: '0 0 14px', fontSize: '14px', color: '#7c736a' }}>{barcodePreviewCopy.books?.title}</p>
            <div style={{ background: '#ffffff', border: '1.5px dashed #dcd3c5', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '34px', letterSpacing: '3px', fontFamily: 'monospace', fontWeight: 800, color: '#18120e' }}>
                ||| || ||| || |||
              </div>
              <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '18px', marginTop: '6px' }}>
                {barcodePreviewCopy.barcode}
              </div>
              <div style={{ fontSize: '13px', color: '#7c736a', marginTop: '2px' }}>
                {barcodePreviewCopy.shelf_location || 'ShelfHelp Library'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button type="button" className="ab-btn-outline" onClick={() => setBarcodePreviewCopy(null)}>Close</button>
              <button type="button" className="ab-btn-brown" onClick={() => window.print()}>🖨 Print Label</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
