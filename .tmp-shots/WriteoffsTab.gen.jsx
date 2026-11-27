import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import { supabase } from '../../../lib/supabase'
import {
  formatDateTime,
  formatShortDate,
  formatVnd,
  printHtml,
  statusLabel,
  statusTone,
  uploadToBucket,
  WRITEOFF_REASONS,
} from './booksUtils'
import {
  IconAlert,
  IconArchive,
  IconBan,
  IconBook,
  IconCamera,
  IconCheckCircle,
  IconClose,
  IconLock,
  IconPen,
  IconPlus,
  IconPrinter,
  IconRefresh,
  IconSearch,
  IconUser,
} from './booksIcons'
import { EvidenceThumb } from './EvidenceThumb'

const PAGE_SIZE = 25

/** UC-22 Â§2.2.1: copies on loan or held for a reservation cannot be written off. */
const BLOCKING_STATUSES = {
  borrowed: 'On loan',
  held: 'Held for reservation',
}

function initials(name) {
  return String(name || 'Staff')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

/** UC-22 Â§3: damaged_beyond_repair needs at least one evidence photo. */
function needsPhoto(reason) {
  return reason === 'damaged_beyond_repair'
}

export function WriteoffsTab({ onOpenCopies }) {
  const [slips, setSlips] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filterStatus, setFilterStatus] = useState('all') // 'all' | 'draft' | 'completed' | 'cancelled'
  const [search, setSearch] = useState('')
  const [selectedSlipId, setSelectedSlipId] = useState(null)
  const [selectedSlip, setSelectedSlip] = useState(null)
  const [stagedCopies, setStagedCopies] = useState([])
  const [loading, setLoading] = useState(true)
  const [slipLoading, setSlipLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [saving, setSaving] = useState(false)

  // Draft editing state
  const [draftReason, setDraftReason] = useState('damaged_beyond_repair')
  const [draftNotes, setDraftNotes] = useState('')
  const [draftPhotos, setDraftPhotos] = useState([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  // Modals state
  const [showStageModal, setShowStageModal] = useState(false)
  const [showCancelPrompt, setShowCancelPrompt] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  // Search in staging modal
  const [stageBarcodeQuery, setStageBarcodeQuery] = useState('')
  const [stageCandidate, setStageCandidate] = useState(null)
  const [stageCandidateError, setStageCandidateError] = useState(null)
  const [stageTargetStatus, setStageTargetStatus] = useState('retired')
  const [stageNote, setStageNote] = useState('')
  const [stagePhotos, setStagePhotos] = useState([])
  const [stageSearching, setStageSearching] = useState(false)
  const [stageUploading, setStageUploading] = useState(false)

  // 1. Fetch writeoff slips list
  const loadSlips = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('writeoff_slips')
        .select(`
          id, number, status, reason_code, notes, photos,
          created_by, completed_at, cancelled_at, cancellation_reason,
          created_at, updated_at,
          profiles:created_by ( id, full_name, email ),
          writeoff_slip_copies ( count )
        `, { count: 'exact' })

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus)
      }
      if (search.trim()) {
        const q = search.trim()
        query = query.or(`number.ilike.%${q}%,notes.ilike.%${q}%,reason_code.ilike.%${q}%`)
      }

      const from = (page - 1) * PAGE_SIZE
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1)

      if (error) throw error

      setSlips(data ?? [])
      setTotal(count ?? 0)

      // Auto-select first or retain selection
      setSelectedSlipId((current) => {
        if (current && (data ?? []).some((item) => item.id === current)) return current
        return (data ?? [])[0]?.id ?? null
      })
    } catch (err) {
      setFeedback({ type: 'error', message: err.message })
    } finally {
      setLoading(false)
    }
  }, [filterStatus, page, search])

  useEffect(() => {
    loadSlips()
  }, [loadSlips])

  // 2. Fetch full detail of selected slip
  const loadSelectedSlipDetail = useCallback(async (slipId) => {
    if (!slipId) {
      setSelectedSlip(null)
      setStagedCopies([])
      return
    }
    // #endregion
    setSlipLoading(true)
    // #region
    try {
      const { data: slipData, error: slipErr } = await supabase
        .from('writeoff_slips')
        .select(`
          id, number, status, reason_code, notes, photos,
          created_by, completed_at, cancelled_at, cancellation_reason,
          created_at, updated_at,
          profiles:created_by ( id, full_name, email )
        `)
        .eq('id', slipId)
        .single()

      if (slipErr) throw slipErr

      const { data: copiesData, error: copiesErr } = await supabase
        .from('writeoff_slip_copies')
        .select(`
          id, slip_id, copy_id, target_status, assessment_note, photo_paths, added_at,
          copies (
            id, barcode, status, condition, shelf_location,
            books ( id, title, authors, replacement_price, isbn13 )
          )
        `)
        .eq('slip_id', slipId)
        .order('added_at', { ascending: true })

      if (copiesErr) throw copiesErr

      setSelectedSlip(slipData)
      setDraftReason(slipData.reason_code)
      setDraftNotes(slipData.notes || '')
      setDraftPhotos(slipData.photos || [])
      setStagedCopies(
        (copiesData || []).map((row) => ({
          id: row.id,
          copy_id: row.copy_id,
          barcode: row.copies?.barcode,
          title: row.copies?.books?.title,
          authors: row.copies?.books?.authors,
          current_status: row.copies?.status,
          condition: row.copies?.condition,
          shelf: row.copies?.shelf_location,
          book_id: row.copies?.books?.id,
          replacement_price: row.copies?.books?.replacement_price,
          target_status: row.target_status,
          assessment_note: row.assessment_note || '',
          photo_paths: row.photo_paths || [],
        }))
      )
    } catch (err) {
      setFeedback({ type: 'error', message: err.message })
    } finally {
      setSlipLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSelectedSlipDetail(selectedSlipId)
  }, [loadSelectedSlipDetail, selectedSlipId])

  // Create a new blank draft slip
  const handleCreateNewSlip = async () => {
    setSaving(true)
    setFeedback(null)
    try {
      const res = await api.invoke('save-writeoff-slip', {
        reason_code: 'damaged_beyond_repair',
        notes: '',
        copies: [],
        photos: [],
      })
      const newSlip = res.data?.slip
      setFeedback({ type: 'success', message: `Draft write-off slip ${newSlip?.number || ''} created.` })
      await loadSlips()
      if (newSlip?.id) setSelectedSlipId(newSlip.id)
    } catch (err) {
      setFeedback({ type: 'error', message: err.message })
    } finally {
      setSaving(false)
    }
  }

  // #endregion

  // Upload general slip photo evidence
  const handleUploadSlipPhoto = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    setFeedback(null)
    try {
      const path = await uploadToBucket('evidence', 'writeoffs', file)
      const nextPhotos = [...draftPhotos, path]
      setDraftPhotos(nextPhotos)
      setFeedback({ type: 'success', message: 'Evidence photo uploaded.' })
    } catch (err) {
      setFeedback({ type: 'error', message: `Upload failed: ${err.message}` })
    } finally {
      setUploadingPhoto(false)
      event.target.value = ''
    }
  }

  const handleRemoveSlipPhoto = (index) => {
    setDraftPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  // Save draft changes
  const handleSaveDraft = async () => {
    if (!selectedSlip || selectedSlip.status !== 'draft') return
    setSaving(true)
    setFeedback(null)
    try {
      const copiesPayload = stagedCopies.map((c) => ({
        copy_id: c.copy_id,
        target_status: c.target_status,
        assessment_note: c.assessment_note || null,
        photo_paths: c.photo_paths || [],
      }))

      await api.invoke('save-writeoff-slip', {
        slip_id: selectedSlip.id,
        reason_code: draftReason,
        notes: draftNotes,
        copies: copiesPayload,
        photos: draftPhotos,
      })

      setFeedback({ type: 'success', message: 'Draft slip updated successfully.' })
      await loadSelectedSlipDetail(selectedSlip.id)
      await loadSlips()
    } catch (err) {
      setFeedback({ type: 'error', message: err.message })
    } finally {
      setSaving(false)
    }
  }

  // Cancel draft slip
  const handleConfirmCancel = async () => {
    if (!selectedSlip) return
    setSaving(true)
    setFeedback(null)
    try {
      await api.invoke('cancel-writeoff-slip', {
        slip_id: selectedSlip.id,
        reason: cancelReason || 'Cancelled by staff',
      })
      setShowCancelPrompt(false)
      setCancelReason('')
      setFeedback({ type: 'success', message: `Slip ${selectedSlip.number} has been cancelled.` })
      await loadSelectedSlipDetail(selectedSlip.id)
      await loadSlips()
    } catch (err) {
      setFeedback({ type: 'error', message: err.message })
    } finally {
      setSaving(false)
    }
  }

  // Complete write-off slip
  const handleCompleteSlip = async () => {
    if (!selectedSlip || selectedSlip.status !== 'draft') return

    // Pre-flight checks
    if (stagedCopies.length === 0) {
      setFeedback({ type: 'error', message: 'Cannot complete an empty write-off slip. Please stage at least one copy.' })
      return
    }

    if (needsPhoto(draftReason)) {
      const hasSlipPhotos = (draftPhotos || []).length > 0
      const hasAnyCopyPhoto = stagedCopies.some((c) => (c.photo_paths || []).length > 0)
      if (!hasSlipPhotos && !hasAnyCopyPhoto) {
        setFeedback({
          type: 'error',
          message: 'At least one photographic evidence file is mandatory for reason code "damaged_beyond_repair".',
        })
        return
      }
    }

    setSaving(true)
    setFeedback(null)
    try {
      // First save draft state to ensure server has current staged items
      const copiesPayload = stagedCopies.map((c) => ({
        copy_id: c.copy_id,
        target_status: c.target_status,
        assessment_note: c.assessment_note || null,
        photo_paths: c.photo_paths || [],
      }))
      await api.invoke('save-writeoff-slip', {
        slip_id: selectedSlip.id,
        reason_code: draftReason,
        notes: draftNotes,
        copies: copiesPayload,
        photos: draftPhotos,
      })

      // Complete slip
      const res = await api.invoke('complete-writeoff-slip', {
        slip_id: selectedSlip.id,
      })

      setFeedback({
        type: 'success',
        message: res.message || `Write-off slip ${selectedSlip.number} completed and locked. Copies decommissioned.`,
      })
      await loadSelectedSlipDetail(selectedSlip.id)
      await loadSlips()
    } catch (err) {
      setFeedback({ type: 'error', message: err.message })
    } finally {
      setSaving(false)
    }
  }

  // Staging lookup in modal
  const handleLookupCopyForStage = async () => {
    const q = stageBarcodeQuery.trim()
    if (!q) return
    setStageSearching(true)
    setStageCandidate(null)
    setStageCandidateError(null)

    try {
      const { data, error } = await supabase
        .from('copies')
        .select(`
          id, barcode, status, condition, shelf_location,
          books ( id, title, authors, replacement_price, isbn13 )
        `)
        .eq('barcode', q)
        .maybeSingle()

      if (error) throw error
      if (!data) {
        setStageCandidateError(`No copy found matching barcode "${q}".`)
        return
      }

      // Check duplicate in current slip
      if (stagedCopies.some((c) => c.copy_id === data.id)) {
        setStageCandidateError(`Copy ${data.barcode} is already staged on this write-off slip.`)
        return
      }

      // Rule check: borrowed or held copies cannot be written off via slip
      if (data.status === 'borrowed') {
        setStageCandidateError(
          `Copy ${data.barcode} is currently borrowed on loan. On-loan copies cannot be written off via slip; process via loan Lost workflow.`
        )
        return
      }
      if (data.status === 'held') {
        setStageCandidateError(
          `Copy ${data.barcode} is currently held for a reservation. Release or expire the hold before writing off.`
        )
        return
      }
      if (data.status === 'retired') {
        setStageCandidateError(`Copy ${data.barcode} is already retired.`)
        return
      }

      setStageCandidate(data)
      setStageTargetStatus(draftReason === 'confirmed_missing' ? 'lost' : 'retired')
      setStageNote('')
      setStagePhotos([])
    } catch (err) {
      setStageCandidateError(err.message)
    } finally {
      setStageSearching(false)
    }
  }

  // Per-copy evidence in the stage modal
  const handleUploadStagePhoto = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setStageUploading(true)
    setStageCandidateError(null)
    try {
      const path = await uploadToBucket('evidence', 'writeoffs', file)
      setStagePhotos((prev) => [...prev, path])
    } catch (err) {
      setStageCandidateError(`Upload failed: ${err.message}`)
    } finally {
      setStageUploading(false)
      event.target.value = ''
    }
  }

  // Add candidate to stagedCopies
  const handleAddCandidateToStaging = () => {
    if (!stageCandidate) return

    setStagedCopies((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        copy_id: stageCandidate.id,
        barcode: stageCandidate.barcode,
        title: stageCandidate.books?.title,
        authors: stageCandidate.books?.authors,
        current_status: stageCandidate.status,
        condition: stageCandidate.condition,
        shelf: stageCandidate.shelf_location,
        replacement_price: stageCandidate.books?.replacement_price,
        target_status: stageTargetStatus,
        assessment_note: stageNote,
        photo_paths: stagePhotos,
      },
    ])

    setStageCandidate(null)
    setStageBarcodeQuery('')
    setStageCandidateError(null)
    setStagePhotos([])
    setShowStageModal(false)
    setFeedback({ type: 'success', message: `Copy ${stageCandidate.barcode} added to slip.` })
  }

  // Remove copy from staging
  const handleRemoveStagedCopy = (copyId) => {
    setStagedCopies((prev) => prev.filter((c) => c.copy_id !== copyId))
  }

  const updateStagedCopy = (copyId, patch) => {
    setStagedCopies((prev) => prev.map((c) => (c.copy_id === copyId ? { ...c, ...patch } : c)))
  }

  // Print slip summary
  const handlePrintSlip = () => {
    if (!selectedSlip) return
    const rowsHtml = stagedCopies
      .map(
        (c) => `
        <tr>
          <td style="padding: 6px 10px; border: 1px solid #ccc; font-family: monospace;">${c.barcode}</td>
          <td style="padding: 6px 10px; border: 1px solid #ccc;">${c.title || 'â€”'}</td>
          <td style="padding: 6px 10px; border: 1px solid #ccc;">${statusLabel(c.current_status)}</td>
          <td style="padding: 6px 10px; border: 1px solid #ccc; font-weight: bold;">${statusLabel(c.target_status)}</td>
          <td style="padding: 6px 10px; border: 1px solid #ccc;">${formatVnd(c.replacement_price)}</td>
          <td style="padding: 6px 10px; border: 1px solid #ccc;">${c.assessment_note || 'â€”'}</td>
        </tr>
      `
      )
      .join('')

    const totalLossVal = stagedCopies.reduce((sum, c) => sum + (Number(c.replacement_price) || 0), 0)

    const html = `
      <div style="font-family: sans-serif; padding: 24px; color: #241e19;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #6e472a; padding-bottom: 12px; margin-bottom: 16px;">
          <div>
            <h1 style="margin: 0; font-size: 20px;">ShelfHelp â€” Write-Off Decommissioning Slip</h1>
            <p style="margin: 4px 0 0; color: #72685e; font-size: 13px;">Official Library Asset Retirement Record (POL-13 / UC-22)</p>
          </div>
          <div style="text-align: right;">
            <h2 style="margin: 0; font-size: 18px; color: #6e472a;">${selectedSlip.number}</h2>
            <span style="font-size: 12px; font-weight: bold; text-transform: uppercase;">${selectedSlip.status}</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; font-size: 13px;">
          <div>
            <p><strong>Reason code:</strong> ${statusLabel(selectedSlip.reason_code)}</p>
            <p><strong>Created by:</strong> ${selectedSlip.profiles?.full_name || 'Staff'}</p>
            <p><strong>Created at:</strong> ${formatDateTime(selectedSlip.created_at)}</p>
          </div>
          <div>
            <p><strong>Completed at:</strong> ${formatDateTime(selectedSlip.completed_at)}</p>
            <p><strong>Total decommissioned copies:</strong> ${stagedCopies.length}</p>
            <p><strong>Total book replacement value:</strong> ${formatVnd(totalLossVal)}</p>
          </div>
        </div>

        ${selectedSlip.notes ? `<div style="background: #fdfbf7; padding: 10px; border: 1px solid #ede6db; border-radius: 6px; margin-bottom: 20px; font-size: 13px;"><strong>Staff Notes:</strong> ${selectedSlip.notes}</div>` : ''}

        <h3 style="font-size: 14px; margin-bottom: 8px;">Decommissioned Copy Inventory</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
          <thead>
            <tr style="background: #f5eee6;">
              <th style="padding: 6px 10px; border: 1px solid #ccc;">Barcode</th>
              <th style="padding: 6px 10px; border: 1px solid #ccc;">Title</th>
              <th style="padding: 6px 10px; border: 1px solid #ccc;">Prior Status</th>
              <th style="padding: 6px 10px; border: 1px solid #ccc;">Terminal Status</th>
              <th style="padding: 6px 10px; border: 1px solid #ccc;">Unit Value</th>
              <th style="padding: 6px 10px; border: 1px solid #ccc;">Assessment Notes</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 13px; padding-top: 30px;">
          <div style="text-align: center; width: 200px;">
            <div style="border-bottom: 1px solid #000; height: 40px; margin-bottom: 4px;"></div>
            <span>Inspected By (Staff)</span>
          </div>
          <div style="text-align: center; width: 200px;">
            <div style="border-bottom: 1px solid #000; height: 40px; margin-bottom: 4px;"></div>
            <span>Approved By (Head Librarian)</span>
          </div>
        </div>
      </div>
    `
    printHtml(`writeoff-${selectedSlip.number}`, html)
  }

  const isDraft = selectedSlip?.status === 'draft'
  const isCompleted = selectedSlip?.status === 'completed'
  const isCancelled = selectedSlip?.status === 'cancelled'

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const copyCount = (slip) => slip.writeoff_slip_copies?.[0]?.count ?? 0

  const hasPhotoEvidence =
    (draftPhotos || []).length > 0 || stagedCopies.some((c) => (c.photo_paths || []).length > 0)
  const replacementTotal = stagedCopies.reduce((sum, c) => sum + (Number(c.replacement_price) || 0), 0)
  const copyPhotosTotal = stagedCopies.reduce((sum, c) => sum + (c.photo_paths || []).length, 0)
  const photoTotal = (draftPhotos || []).length + copyPhotosTotal

  const openStageModal = () => {
    setStageCandidate(null)
    setStageCandidateError(null)
    setStageBarcodeQuery('')
    setStagePhotos([])
    setShowStageModal(true)
  }

  return (
    <div className="books-tab">
      {/* Search & Actions Bar */}
      <div className="admin-search-bar-wrap books-lookup-bar">
        <div className="admin-barcode-input">
          <span className="admin-barcode-icon" aria-hidden="true">
            <IconArchive size={15} />
          </span>
          <span className="books-search-icon" aria-hidden="true">
            <IconSearch size={15} />
          </span>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search write-off slip number, reason, or notesâ€¦"
          />
        </div>
        <button type="button" className="admin-btn-primary" onClick={handleCreateNewSlip} disabled={saving}>
          + Create Write-Off Slip
        </button>
      </div>

      {feedback && (
        <div className={`books-alert ${feedback.type === 'error' ? 'danger' : 'success'}`}>
          <span>{feedback.message}</span>
          <button type="button" aria-label="âœ•" onClick={() => setFeedback(null)}>âœ•</button>
        </div>
      )}
      {/* Filter Tabs */}
      <div className="admin-filter-tabs books-filter-strip">
        <div className="admin-filter-tabs books-filter-strip-pills">
          {[
            { value: 'all', label: 'All slips' },
            { value: 'draft', label: 'Drafts' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' },
          ].map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={`admin-pill-btn ${filterStatus === filter.value ? 'active' : ''}`}
              onClick={() => { setFilterStatus(filter.value); setPage(1) }}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="books-filter-meta">
          <span>{loading ? 'Loadingâ€¦' : `${total} slip${total === 1 ? '' : 's'}`}</span>
          <button type="button" className="books-icon-text-btn" onClick={loadSlips}>
            <IconRefresh size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Work Layout: Slip cards + Draft inspection drawer */}
      <div className="admin-work-layout">
        {/* Left: slip cards. The table wrapper keeps `.books-table-scroll` as a
            plain container (no table semantics), one card per slip. */}
        <div className="books-slip-list-wrap">
          <div className="books-slip-list-head">
            <div>
              <strong className="books-slip-list-title">Write-off register</strong>
              <p className="books-slip-list-sub">
                Drafts are editable until completion; completed slips are immutable (UC-22 / FR-COND-03).
              </p>
            </div>
            <span className="books-slip-list-count">
              {loading ? 'â€¦' : `${slips.length} of ${total}`}
            </span>
          </div>

          <div className="books-table-scroll" role="list" aria-label="Write-off slips">
            <table className="books-table-sr"><tbody><tr><td /></tr></tbody></table>
            {slips.map((slip) => {
              const isSelected = slip.id === selectedSlipId
              const count = copyCount(slip)
              return (
                <article
                  key={slip.id}
                  role="listitem"
                  className={`books-slip-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedSlipId(slip.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedSlipId(slip.id) } }}
                  tabIndex={0}
                  aria-current={isSelected ? 'true' : undefined}
                >
                  <header className="books-slip-card-head">
                    <div className="books-slip-card-id">
                      <span className="books-slip-hash">#</span>
                      <strong>{slip.number}</strong>
                      <span className={`books-badge tone-${statusTone(slip.status)}`}>
                        {statusLabel(slip.status)}
                      </span>
                    </div>
                    <span className="books-slip-card-date">
                      {slip.status === 'completed' && slip.completed_at
                        ? `Closed: ${formatShortDate(slip.completed_at)}`
                        : slip.status === 'cancelled' && slip.cancelled_at
                          ? `Cancelled: ${formatShortDate(slip.cancelled_at)}`
                          : `Created: ${formatShortDate(slip.created_at)}`}
                    </span>
                  </header>

                  <div className="books-slip-card-body">
                    <div className="books-slip-qty">
                      <span className="books-slip-eyebrow">Staged quantity</span>
                      <span className="books-slip-qty-value">
                        <strong>{count}</strong> {count === 1 ? 'copy' : 'copies'}
                        {count === 0 && <em className="books-slip-qty-empty">none staged yet</em>}
                      </span>
                    </div>
                    <div className="books-slip-reason">
                      <span className="books-slip-eyebrow">Reason code</span>
                      <span>{statusLabel(slip.reason_code)}</span>
                    </div>
                  </div>

                  <footer className="books-slip-card-foot">
                    <span className="books-slip-curator">
                      <span className="books-avatar" aria-hidden="true">
                        {initials(slip.profiles?.full_name)}
                      </span>
                      <span>
                        {slip.status === 'completed' ? 'Signed off by ' : 'Curated by '}
                        <strong>{slip.profiles?.full_name || 'Staff'}</strong>
                      </span>
                    </span>
                    <div className="books-slip-card-actions">
                      {isSelected && <span className="books-slip-flag">Active in inspector</span>}
                      {slip.status === 'draft' ? (
                        <span className="books-btn-pill"><IconPen size={12} /> Edit draft</span>
                      ) : (
                        <span className="books-btn-pill muted"><IconBook size={12} /> View slip</span>
                      )}
                    </div>
                  </footer>
                </article>
              )
            })}

            {slips.length === 0 && !loading && (
              <div className="books-table-empty books-slip-empty">
                <IconArchive size={22} />
                <p>No write-off slips found matching criteria.</p>
                <button type="button" className="admin-btn-primary" onClick={handleCreateNewSlip} disabled={saving}>
                  + Create Write-Off Slip
                </button>
              </div>
            )}
            {loading && (
              <div className="books-table-empty books-slip-empty">
                <span className="books-spinner" aria-hidden="true" />
                <p>Loading write-off slipsâ€¦</p>
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="books-pagination">
              <span>Page {page} of {totalPages}</span>
              <div className="books-page-pills">
                <button
                  type="button"
                  className="books-page-pill"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  â†
                </button>
                <button
                  type="button"
                  className="books-page-pill"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  â†’
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="admin-drawer books-detail books-inspector">
          {slipLoading ? (
            <div className="books-empty-note">Loading slip detailsâ€¦</div>
          ) : selectedSlip ? (
            <>
              <header className={`books-inspector-head ${isDraft ? 'is-draft' : ''}`}>
                <div className="books-inspector-title">
                  <span className="books-inspector-icon" aria-hidden="true">
                    {isDraft ? <IconPen size={16} /> : isCompleted ? <IconCheckCircle size={16} /> : <IconBan size={16} />}
                  </span>
                  <div>
                    <h2 className="books-inspector-number">#{selectedSlip.number}</h2>
                    <div className="books-inspector-kicker">
                      {isDraft
                        ? 'Draft inspection & validation'
                        : isCompleted
                          ? 'Completed write-off record'
                          : 'Cancelled slip record'}
                    </div>
                  </div>
                </div>
                <span className={`books-badge tone-${statusTone(selectedSlip.status)}`}>
                  {statusLabel(selectedSlip.status)}
                </span>
              </header>

              <div className="books-inspector-meta">
                <span><IconUser size={12} /> {selectedSlip.profiles?.full_name || 'Staff'}</span>
                <span><IconBook size={12} /> {formatDateTime(selectedSlip.created_at)}</span>
              </div>

              {isCompleted && (
                <div className="books-note success">
                  <IconLock size={14} />
                  <span>
                    <strong>Immutable:</strong> completed {formatDateTime(selectedSlip.completed_at)}. Edit and delete
                    controls are disabled (FR-COND-03).
                  </span>
                </div>
              )}

              {isCancelled && (
                <div className="books-note danger">
                  <IconBan size={14} />
                  <span>
                    <strong>Cancelled:</strong> {selectedSlip.cancellation_reason || 'No cancellation reason recorded'} (on{' '}
                    {formatDateTime(selectedSlip.cancelled_at)}).
                  </span>
                </div>
              )}

              {/* 1. Mandatory reason code */}
              <section className="books-inspector-section">
                <div className="books-section-label">
                  <span>1 Â· Mandatory reason code</span>
                  {isDraft && <em>Required</em>}
                </div>
                {isDraft ? (
                  <div className="books-reason-options">
                    {WRITEOFF_REASONS.map((reason) => (
                      <button
                        key={reason.value}
                        type="button"
                        className={`books-reason-option ${draftReason === reason.value ? 'active' : ''}`}
                        onClick={() => setDraftReason(reason.value)}
                        aria-pressed={draftReason === reason.value}
                      >
                        <span className="radio-dot" aria-hidden="true" />
                        <span>
                          <strong>{reason.label}</strong>
                          <small>{reason.hint}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="books-reason-static">{statusLabel(selectedSlip.reason_code)}</div>
                )}
              </section>

              {/* 2. Staged copies */}
              <section className="books-inspector-section">
                <div className="books-section-label">
                  <span>
                    2 Â· Staged Copies ({stagedCopies.length})
                  </span>
                  {isDraft && (
                    <button type="button" className="books-section-action" onClick={openStageModal}>
                      + Stage copies
                    </button>
                  )}
                </div>

                <div className="books-staged-list">
                  {stagedCopies.map((c) => {
                    const blocked = BLOCKING_STATUSES[c.current_status]
                    const copyPhotoList = c.photo_paths || []
                    return (
                      <div key={c.copy_id} className="books-staged-card">
                        {isDraft && (
                          <label className="books-staged-select">
                            <input
                              type="checkbox"
                              checked
                              onChange={() => handleRemoveStagedCopy(c.copy_id)}
                              aria-label={`Deselect ${c.barcode}`}
                            />
                          </label>
                        )}
                        <div className="books-staged-main">
                          <div className="books-staged-title">{c.title || 'Untitled title'}</div>
                          <div className="books-staged-sub">
                            <button
                              type="button"
                              className="books-barcode-link"
                              onClick={() => onOpenCopies?.(c.book_id)}
                              title="Inspect copy in Copies tab"
                            >
                              {c.barcode}
                            </button>
                            {c.authors?.length > 0 && <span> Â· {c.authors.join(', ')}</span>}
                          </div>
                          <div className="books-staged-facts">
                            <span><em>Condition</em> {statusLabel(c.condition)}</span>
                            <span><em>Target</em> {statusLabel(c.target_status)}</span>
                            <span><em>Value</em> {formatVnd(c.replacement_price)}</span>
                          </div>
                          {blocked && (
                            <div className="books-staged-blocked">
                              <IconAlert size={12} /> {blocked} â€” resolve before completing.
                            </div>
                          )}
                          {c.assessment_note && (
                            <div className="books-staged-quote">â€œ{c.assessment_note}â€</div>
                          )}
                          {copyPhotoList.length > 0 && (
                            <div className="books-staged-photos">
                              {copyPhotoList.map((path) => (
                                <EvidenceThumb key={path} path={path} size={40} alt="Copy evidence" />
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="books-staged-tools">
                          {isDraft && (
                            <select
                              className="books-staged-select-input"
                              value={c.target_status}
                              onChange={(e) => updateStagedCopy(c.copy_id, { target_status: e.target.value })}
                              aria-label={`Target status for ${c.barcode}`}
                            >
                              <option value="retired">Retired</option>
                              <option value="lost">Lost</option>
                            </select>
                          )}
                          {isDraft && (
                            <button
                              type="button"
                              className="books-staged-remove"
                              onClick={() => handleRemoveStagedCopy(c.copy_id)}
                              title="Remove from slip"
                              aria-label={`Remove ${c.barcode}`}
                            >
                              <IconClose size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {stagedCopies.length === 0 && (
                    <div className="books-staged-empty">
                      <IconArchive size={18} />
                      <span>No copies staged on this slip.</span>
                      {isDraft && (
                        <button type="button" className="books-link" onClick={openStageModal}>
                          Stage the first copy
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {stagedCopies.length > 0 && (
                  <div className="books-staged-total">
                    <span>{stagedCopies.length} {stagedCopies.length === 1 ? 'copy' : 'copies'} staged</span>
                    <span>Replacement value <strong>{formatVnd(replacementTotal)}</strong></span>
                  </div>
                )}
              </section>

              {/* 3. Evidence + assessment */}
              <section className="books-inspector-section">
                <div className="books-section-label">
                  <span>
                    3 Â· Evidence &amp; assessment
                    {needsPhoto(isDraft ? draftReason : selectedSlip.reason_code) && (
                      <span className={`books-req ${hasPhotoEvidence ? 'met' : ''}`}>
                        {hasPhotoEvidence ? 'photo attached' : 'photo required'}
                      </span>
                    )}
                  </span>
                </div>

                {isDraft ? (
                  <>
                    <div className="books-evidence">
                      <div className="books-evidence-grid">
                        {draftPhotos.map((path, idx) => (
                          <EvidenceThumb
                            key={path}
                            path={path}
                            size={54}
                            removable
                            onRemove={() => handleRemoveSlipPhoto(idx)}
                          />
                        ))}
                        <label className="books-evidence-add" title="Add evidence photo">
                          <IconCamera size={16} />
                          <span>{uploadingPhoto ? 'Uploadingâ€¦' : 'Add photo'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handleUploadSlipPhoto}
                            disabled={uploadingPhoto}
                          />
                        </label>
                      </div>
                      <div className="books-evidence-hint">
                        {photoTotal > 0
                          ? `${photoTotal} photo${photoTotal === 1 ? '' : 's'} attached to this slip`
                          : needsPhoto(draftReason)
                            ? 'Photo evidence is mandatory before completing under "Damage beyond repair".'
                            : 'No evidence photos attached (optional for this reason code).'}
                      </div>
                    </div>

                    <label className="books-field">
                      <span className="books-section-label flush">Archivist assessment note</span>
                      <textarea
                        rows={3}
                        value={draftNotes}
                        onChange={(e) => setDraftNotes(e.target.value)}
                        placeholder="Describe condition, disposal authorization, or stocktaking audit notesâ€¦"
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <div className="books-evidence">
                      <div className="books-evidence-grid">
                        {(selectedSlip.photos || []).map((path) => (
                          <EvidenceThumb key={path} path={path} size={54} />
                        ))}
                        {stagedCopies.flatMap((c) => (c.photo_paths || []).map((path) => (
                          <EvidenceThumb key={path} path={path} size={54} alt="Copy evidence" />
                        )))}
                        {(selectedSlip.photos || []).length === 0 && copyPhotosTotal === 0 && (
                          <div className="books-evidence-hint">No evidence photos on record.</div>
                        )}
                      </div>
                    </div>
                    <div className="books-quote">{selectedSlip.notes || 'No assessment note recorded.'}</div>
                  </>
                )}
              </section>

              {/* Action footer */}
              <section className="books-inspector-actions">
                {isDraft && (
                  <div className="books-action-grid">
                    <div className="books-action-pair">
                      <button
                        type="button"
                        className="admin-btn-outline"
                        disabled={saving}
                        onClick={handleSaveDraft}
                      >
                        Save Draft
                      </button>
                      <button
                        type="button"
                        className="admin-btn-outline books-btn-danger"
                        disabled={saving}
                        onClick={() => setShowCancelPrompt(true)}
                      >
                        Cancel Slip
                      </button>
                    </div>
                    <button
                      type="button"
                      className="admin-btn-primary books-action-primary"
                      disabled={saving || stagedCopies.length === 0}
                      onClick={handleCompleteSlip}
                      title={stagedCopies.length === 0 ? 'Stage at least one copy to complete' : 'Commit and lock the slip'}
                    >
                      <IconLock size={13} />
                      {saving ? 'Processingâ€¦' : 'Complete Slip'}
                    </button>
                  </div>
                )}

                {isCompleted && (
                  <button type="button" className="admin-btn-primary books-action-primary" onClick={handlePrintSlip}>
                    <IconPrinter size={13} /> Print / Export
                  </button>
                )}

                {isCancelled && (
                  <div className="books-action-hint">
                    This slip is closed. Copies listed below were released; no status changes were applied.
                  </div>
                )}
              </section>
            </>
          ) : (
            <div className="books-inspector-idle">
              <IconArchive size={26} />
              <strong>No slip selected</strong>
              <span>Select a write-off slip to inspect details or complete decommissioning.</span>
            </div>
          )}
        </aside>
      </div>

      {/* Stage Copies Modal */}
      {showStageModal && (
        <div className="books-modal-backdrop" onClick={() => setShowStageModal(false)}>
          <div className="books-modal books-modal-stage" onClick={(e) => e.stopPropagation()}>
            <div className="books-modal-header">
              <div>
                <h3 className="books-modal-title">Stage Copy to Write-off Slip</h3>
                <p className="books-modal-subtitle">
                  Scan a barcode, confirm the copy, then add it to slip #{selectedSlip?.number}
                </p>
              </div>
              <button type="button" className="books-modal-close" onClick={() => setShowStageModal(false)} aria-label="Close">
                <IconClose size={15} />
              </button>
            </div>

            <div className="books-modal-body">
              <div className="books-stage-lookup">
                <div className="admin-barcode-input">
                  <span className="admin-barcode-icon" aria-hidden="true">
                    <IconSearch size={15} />
                  </span>
                  <input
                    value={stageBarcodeQuery}
                    onChange={(e) => setStageBarcodeQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLookupCopyForStage()}
                    placeholder="Scan or enter copy barcode (e.g. LIB-2026-00001)â€¦"
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  className="admin-btn-primary"
                  disabled={stageSearching || !stageBarcodeQuery.trim()}
                  onClick={handleLookupCopyForStage}
                >
                  {stageSearching ? 'Looking upâ€¦' : 'Lookup'}
                </button>
              </div>

              {stageCandidateError && (
                <div className="books-alert danger">
                  <span>{stageCandidateError}</span>
                </div>
              )}

              {!stageCandidate && !stageCandidateError && (
                <div className="books-stage-empty">
                  <div className="books-stage-empty-icon"><IconArchive size={20} /></div>
                  <strong>Scan the copy you want to write off</strong>
                  <span>On-loan and held copies are rejected automatically (UC-22 Â§2.2.1).</span>
                </div>
              )}

              {stageCandidate && (
                <div className="books-stage-candidate">
                  <div className="books-stage-candidate-head">
                    <div>
                      <span className="books-slip-eyebrow">Copy found</span>
                      <strong className="books-stage-candidate-title">{stageCandidate.books?.title}</strong>
                      <div className="books-stage-candidate-facts">
                        <span className="books-barcode-pill">{stageCandidate.barcode}</span>
                        <span><em>Condition</em> {statusLabel(stageCandidate.condition)}</span>
                        <span><em>Shelf</em> {stageCandidate.shelf_location || 'â€”'}</span>
                      </div>
                    </div>
                    <span className={`books-badge tone-${statusTone(stageCandidate.status)}`}>
                      {statusLabel(stageCandidate.status)}
                    </span>
                  </div>

                  <div className="books-form-grid">
                    <div className="books-field">
                      <label>Target Status</label>
                      <select
                        value={stageTargetStatus}
                        onChange={(e) => setStageTargetStatus(e.target.value)}
                      >
                        <option value="retired">Retired (Permanent decommission)</option>
                        <option value="lost">Lost (Missing stock)</option>
                      </select>
                    </div>

                    <div className="books-field">
                      <label>Replacement Value</label>
                      <input
                        type="text"
                        disabled
                        value={formatVnd(stageCandidate.books?.replacement_price)}
                      />
                    </div>

                    <div className="books-field span-2">
                      <label>Assessment Note</label>
                      <input
                        value={stageNote}
                        onChange={(e) => setStageNote(e.target.value)}
                        placeholder="e.g. Severe water damage on pages 40-120; binding snapped"
                      />
                    </div>
                  </div>

                  <div className="books-stage-evidence">
                    <span className="books-slip-eyebrow">Copy evidence</span>
                    <div className="books-evidence-grid">
                      {stagePhotos.map((path) => (
                        <EvidenceThumb key={path} path={path} size={46} alt="Copy evidence" />
                      ))}
                      <label className="books-evidence-add" title="Attach a copy photo">
                        <IconCamera size={14} />
                        <span>{stageUploading ? 'â€¦' : 'Photo'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handleUploadStagePhoto}
                          disabled={stageUploading}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="books-modal-footer">
              <button type="button" className="admin-btn-outline" onClick={() => setShowStageModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn-primary"
                disabled={!stageCandidate}
                onClick={handleAddCandidateToStaging}
              >
                Add to Staged Copies
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Slip Prompt Modal */}
      {showCancelPrompt && (
        <div className="books-modal-backdrop" onClick={() => setShowCancelPrompt(false)}>
          <div className="books-modal books-modal-cancel" onClick={(e) => e.stopPropagation()}>
            <div className="books-modal-header">
              <div>
                <h3 className="books-modal-title">Cancel Write-off Slip</h3>
                <p className="books-modal-subtitle">#{selectedSlip?.number} Â· no copy status will be changed</p>
              </div>
              <button type="button" className="books-modal-close" onClick={() => setShowCancelPrompt(false)} aria-label="Close">
                <IconClose size={15} />
              </button>
            </div>
            <div className="books-modal-body">
              <div className="books-note danger">
                <IconAlert size={14} />
                <span>
                  Cancelling retires this draft permanently. Staged copies stay in their current status and can be
                  re-staged on a new slip.
                </span>
              </div>
              <div className="books-field">
                <label>Cancellation Reason</label>
                <input
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Draft created in error / copy salvaged"
                  autoFocus
                />
              </div>
            </div>
            <div className="books-modal-footer">
              <button type="button" className="admin-btn-outline" onClick={() => setShowCancelPrompt(false)}>
                Keep Draft
              </button>
              <button type="button" className="admin-btn-outline books-btn-danger" disabled={saving} onClick={handleConfirmCancel}>
                Cancel Slip
              </button>
            </div>
          </div>
        </div>
      )}

