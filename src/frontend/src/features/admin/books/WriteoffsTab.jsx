import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import { supabase } from '../../../lib/supabase'
import {
  formatDateTime,
  formatVnd,
  printHtml,
  statusLabel,
  statusTone,
  uploadToBucket,
  WRITEOFF_REASONS,
} from './booksUtils'

const PAGE_SIZE = 25

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

    setSlipLoading(true)
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

    if (draftReason === 'damaged_beyond_repair') {
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
        replacement_price: stageCandidate.books?.replacement_price,
        target_status: stageTargetStatus,
        assessment_note: stageNote,
        photo_paths: stagePhotos,
      },
    ])

    setStageCandidate(null)
    setStageBarcodeQuery('')
    setStageCandidateError(null)
    setShowStageModal(false)
    setFeedback({ type: 'success', message: `Copy ${stageCandidate.barcode} added to slip.` })
  }

  // Remove copy from staging
  const handleRemoveStagedCopy = (copyId) => {
    setStagedCopies((prev) => prev.filter((c) => c.copy_id !== copyId))
  }

  // Print slip summary
  const handlePrintSlip = () => {
    if (!selectedSlip) return
    const rowsHtml = stagedCopies
      .map(
        (c) => `
        <tr>
          <td style="padding: 6px 10px; border: 1px solid #ccc; font-family: monospace;">${c.barcode}</td>
          <td style="padding: 6px 10px; border: 1px solid #ccc;">${c.title || '—'}</td>
          <td style="padding: 6px 10px; border: 1px solid #ccc;">${statusLabel(c.current_status)}</td>
          <td style="padding: 6px 10px; border: 1px solid #ccc; font-weight: bold;">${statusLabel(c.target_status)}</td>
          <td style="padding: 6px 10px; border: 1px solid #ccc;">${formatVnd(c.replacement_price)}</td>
          <td style="padding: 6px 10px; border: 1px solid #ccc;">${c.assessment_note || '—'}</td>
        </tr>
      `
      )
      .join('')

    const totalLossVal = stagedCopies.reduce((sum, c) => sum + (Number(c.replacement_price) || 0), 0)

    const html = `
      <div style="font-family: sans-serif; padding: 24px; color: #241e19;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #6e472a; padding-bottom: 12px; margin-bottom: 16px;">
          <div>
            <h1 style="margin: 0; font-size: 20px;">ShelfHelp — Write-Off Decommissioning Slip</h1>
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

  return (
    <div className="books-tab">
      {/* Search & Actions Bar */}
      <div className="admin-search-bar-wrap">
        <div className="admin-barcode-input">
          <span className="books-search-icon">🔍</span>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search write-off slip number, reason, or notes…"
          />
        </div>
        <button type="button" className="admin-btn-primary" onClick={handleCreateNewSlip} disabled={saving}>
          + Create Write-Off Slip
        </button>
      </div>

      {feedback && (
        <div className={`books-alert ${feedback.type === 'error' ? 'danger' : 'success'}`}>
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)}>✕</button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="admin-filter-tabs">
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
        <span className="books-push-right books-muted">Total: {total} slips</span>
      </div>

      {/* Work Layout: Table + Detail Inspector */}
      <div className="admin-work-layout">
        {/* Left: Slips Table */}
        <div className="admin-table-container">
          <div className="admin-table-toolbar books-table-toolbar">
            <span className="books-muted">
              Showing <strong>{slips.length}</strong> of <strong>{total}</strong> write-off slips
            </span>
            <button type="button" className="admin-btn-outline books-btn-sm" onClick={loadSlips}>
              Refresh
            </button>
          </div>

          <div className="books-table-scroll">
            <table className="admin-table books-table">
              <thead>
                <tr>
                  <th>Slip Number</th>
                  <th>Reason</th>
                  <th>Copies</th>
                  <th>Status</th>
                  <th>Created by</th>
                  <th>Created Date</th>
                </tr>
              </thead>
              <tbody>
                {slips.map((slip) => {
                  const isSelected = slip.id === selectedSlipId
                  const copyCount = slip.writeoff_slip_copies?.[0]?.count ?? 0
                  return (
                    <tr
                      key={slip.id}
                      className={isSelected ? 'selected' : ''}
                      onClick={() => setSelectedSlipId(slip.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <strong style={{ color: '#6e472a' }}>{slip.number}</strong>
                      </td>
                      <td>
                        <span>{statusLabel(slip.reason_code)}</span>
                      </td>
                      <td>
                        <strong>{copyCount}</strong> {copyCount === 1 ? 'copy' : 'copies'}
                      </td>
                      <td>
                        <span className={`books-badge tone-${statusTone(slip.status)}`}>
                          {statusLabel(slip.status)}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px' }}>{slip.profiles?.full_name || 'Staff'}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: '#72685e' }}>{formatDateTime(slip.created_at)}</span>
                      </td>
                    </tr>
                  )
                })}
                {slips.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#9d9388' }}>
                      No write-off slips found matching criteria. Click "+ Create Write-Off Slip" to draft a new slip.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
                  ←
                </button>
                <button
                  type="button"
                  className="books-page-pill"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Slip Detail Drawer */}
        <aside className="admin-drawer books-detail">
          {slipLoading ? (
            <div className="books-empty-note">Loading slip details…</div>
          ) : selectedSlip ? (
            <>
              {/* Slip Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#241e19' }}>{selectedSlip.number}</h3>
                  <div style={{ fontSize: '11px', color: '#72685e' }}>
                    Created by <strong>{selectedSlip.profiles?.full_name || 'Staff'}</strong> on {formatDateTime(selectedSlip.created_at)}
                  </div>
                </div>
                <span className={`books-badge tone-${statusTone(selectedSlip.status)}`}>
                  {statusLabel(selectedSlip.status)}
                </span>
              </div>

              {isCompleted && (
                <div style={{ padding: '8px 12px', background: '#f3f4f6', borderRadius: '8px', fontSize: '12px', color: '#4b5563', borderLeft: '4px solid #16a34a' }}>
                  🔒 <strong>Immutable:</strong> Completed on {formatDateTime(selectedSlip.completed_at)}. Edit and delete controls are disabled (FR-COND-03).
                </div>
              )}

              {isCancelled && (
                <div style={{ padding: '8px 12px', background: '#fee2e2', borderRadius: '8px', fontSize: '12px', color: '#991b1b', borderLeft: '4px solid #dc2626' }}>
                  ✕ <strong>Cancelled:</strong> {selectedSlip.cancellation_reason || 'No cancellation reason recorded'} (on {formatDateTime(selectedSlip.cancelled_at)}).
                </div>
              )}

              {/* Reason & Notes */}
              <div className="books-field">
                <label>Reason Code</label>
                {isDraft ? (
                  <select
                    value={draftReason}
                    onChange={(e) => setDraftReason(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {WRITEOFF_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                ) : (
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>
                    {statusLabel(selectedSlip.reason_code)}
                  </div>
                )}
              </div>

              <div className="books-field">
                <label>Staff Notes</label>
                {isDraft ? (
                  <textarea
                    rows={2}
                    value={draftNotes}
                    onChange={(e) => setDraftNotes(e.target.value)}
                    placeholder="Describe condition, disposal authorization, or stocktaking audit notes…"
                  />
                ) : (
                  <div style={{ fontSize: '13px', color: '#4b5563', whiteSpace: 'pre-wrap' }}>
                    {selectedSlip.notes || '—'}
                  </div>
                )}
              </div>

              {/* General Photographic Evidence */}
              <div className="books-field">
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Photographic Evidence ({draftPhotos.length})</span>
                  {isDraft && (
                    <label className="admin-btn-outline books-btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                      <span>{uploadingPhoto ? 'Uploading…' : '+ Add Photo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleUploadSlipPhoto}
                        disabled={uploadingPhoto}
                      />
                    </label>
                  )}
                </label>
                {draftPhotos.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                    {draftPhotos.map((path, idx) => {
                      const url = supabase.storage.from('evidence').getPublicUrl(path).data.publicUrl
                      return (
                        <div key={path} style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #dcd3c5' }}>
                          <img src={url} alt="Evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          {isDraft && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSlipPhoto(idx)}
                              style={{
                                position: 'absolute',
                                top: 2,
                                right: 2,
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                background: 'rgba(0,0,0,0.6)',
                                color: '#fff',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="books-muted" style={{ fontSize: '12px' }}>
                    {draftReason === 'damaged_beyond_repair'
                      ? '⚠️ Photo evidence is required before completing under "Damage beyond repair".'
                      : 'No evidence photos attached.'}
                  </div>
                )}
              </div>

              {/* Staged Copies Section */}
              <div style={{ borderTop: '1px solid #ede6db', paddingTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '13px' }}>Staged Copies ({stagedCopies.length})</strong>
                  {isDraft && (
                    <button
                      type="button"
                      className="admin-btn-primary books-btn-sm"
                      onClick={() => {
                        setStageCandidate(null)
                        setStageCandidateError(null)
                        setStageBarcodeQuery('')
                        setShowStageModal(true)
                      }}
                    >
                      + Stage Copies
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                  {stagedCopies.map((c) => (
                    <div
                      key={c.copy_id}
                      style={{
                        padding: '8px 10px',
                        background: '#faf7f2',
                        border: '1px solid #ede6db',
                        borderRadius: '8px',
                        fontSize: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <button
                            type="button"
                            className="admin-btn-outline books-btn-sm books-btn-ghost"
                            style={{ fontFamily: 'monospace', padding: 0, fontWeight: 700, color: '#6e472a', textDecoration: 'underline' }}
                            onClick={() => onOpenCopies?.(c.book_id)}
                            title="Inspect copy in Copies tab"
                          >
                            {c.barcode}
                          </button>
                          <div style={{ color: '#72685e', fontSize: '11px' }}>{c.title || 'Book Title'}</div>
                        </div>
                        {isDraft && (
                          <button
                            type="button"
                            className="admin-btn-outline books-btn-sm books-btn-ghost"
                            style={{ color: '#dc2626', padding: '2px 4px' }}
                            onClick={() => handleRemoveStagedCopy(c.copy_id)}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '11px', color: '#6e665e' }}>
                        <span>Target: <strong style={{ color: '#6e472a' }}>{statusLabel(c.target_status)}</strong></span>
                        {c.condition && <span>· Cond: {c.condition}</span>}
                        {c.replacement_price && <span>· {formatVnd(c.replacement_price)}</span>}
                      </div>
                      {c.assessment_note && (
                        <div style={{ fontStyle: 'italic', color: '#8c827a', fontSize: '11px' }}>
                          "{c.assessment_note}"
                        </div>
                      )}
                    </div>
                  ))}
                  {stagedCopies.length === 0 && (
                    <div className="books-empty-note">
                      No copies staged on this slip.
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ borderTop: '1px solid #ede6db', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {isDraft && (
                  <>
                    <button
                      type="button"
                      className="admin-btn-primary"
                      style={{ width: '100%', justifyContent: 'center' }}
                      disabled={saving || stagedCopies.length === 0}
                      onClick={handleCompleteSlip}
                    >
                      {saving ? 'Processing…' : 'Complete Slip'}
                    </button>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="admin-btn-outline"
                        style={{ flex: 1, justifyContent: 'center' }}
                        disabled={saving}
                        onClick={handleSaveDraft}
                      >
                        Save Draft
                      </button>
                      <button
                        type="button"
                        className="admin-btn-outline books-btn-danger"
                        style={{ flex: 1, justifyContent: 'center' }}
                        disabled={saving}
                        onClick={() => setShowCancelPrompt(true)}
                      >
                        Cancel Slip
                      </button>
                    </div>
                  </>
                )}

                {isCompleted && (
                  <button
                    type="button"
                    className="admin-btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={handlePrintSlip}
                  >
                    🖨️ Print / Export
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="books-empty-note">Select a write-off slip from the list to inspect details or complete decommissioning.</div>
          )}
        </aside>
      </div>

      {/* Stage Copies Modal */}
      {showStageModal && (
        <div className="books-modal-backdrop" onClick={() => setShowStageModal(false)}>
          <div className="books-modal" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
            <div className="books-modal-header">
              <h3 style={{ margin: 0, fontSize: '16px' }}>Stage Copy to Write-off Slip</h3>
              <button type="button" className="admin-btn-outline books-btn-sm books-btn-ghost" onClick={() => setShowStageModal(false)}>✕</button>
            </div>

            <div className="books-modal-body">
              <div className="admin-search-bar-wrap" style={{ padding: '8px 12px' }}>
                <div className="admin-barcode-input">
                  <input
                    value={stageBarcodeQuery}
                    onChange={(e) => setStageBarcodeQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLookupCopyForStage()}
                    placeholder="Scan or enter copy barcode (e.g. LIB-2026-00001)…"
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  className="admin-btn-primary books-btn-sm"
                  disabled={stageSearching || !stageBarcodeQuery.trim()}
                  onClick={handleLookupCopyForStage}
                >
                  {stageSearching ? 'Looking up…' : 'Lookup'}
                </button>
              </div>

              {stageCandidateError && (
                <div className="books-alert danger" style={{ fontSize: '12px' }}>
                  <span>{stageCandidateError}</span>
                </div>
              )}

              {stageCandidate && (
                <div style={{ padding: '14px', background: '#fdfbf7', border: '1px solid #ede6db', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <strong style={{ fontSize: '14px', color: '#241e19' }}>{stageCandidate.books?.title}</strong>
                      <div style={{ fontSize: '12px', color: '#72685e' }}>Barcode: <strong style={{ fontFamily: 'monospace' }}>{stageCandidate.barcode}</strong></div>
                    </div>
                    <span className={`books-badge tone-${statusTone(stageCandidate.status)}`}>
                      {statusLabel(stageCandidate.status)}
                    </span>
                  </div>

                  <div className="books-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
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
                        style={{ background: '#f5eee6' }}
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
          <div className="books-modal" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="books-modal-header">
              <h3 style={{ margin: 0, fontSize: '16px' }}>Cancel Write-off Slip</h3>
              <button type="button" className="admin-btn-outline books-btn-sm books-btn-ghost" onClick={() => setShowCancelPrompt(false)}>✕</button>
            </div>
            <div className="books-modal-body">
              <p style={{ margin: 0, fontSize: '13px', color: '#4b5563' }}>
                Are you sure you want to cancel draft slip <strong>{selectedSlip?.number}</strong>?
                No copy status will be changed, and this draft will become inactive.
              </p>
              <div className="books-field" style={{ marginTop: '12px' }}>
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
    </div>
  )
}

