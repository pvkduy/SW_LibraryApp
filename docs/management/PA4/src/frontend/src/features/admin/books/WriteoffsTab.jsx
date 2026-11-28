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
  IconCamera,
  IconCheckCircle,
  IconClose,
  IconLock,
  IconPen,
  IconPlus,
  IconPrinter,
  IconRefresh,
  IconSearch,
} from './booksIcons'
import { EvidenceThumb } from './EvidenceThumb'

const PAGE_SIZE = 25

const STATUS_FILTERS = [
  { value: 'all', label: 'All slips' },
  { value: 'draft', label: 'Drafts' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

/** UC-22 §2.2.1: copies on loan or held for a reservation cannot be written off. */
const BLOCKING_STATUSES = { borrowed: true, held: true }

/** UC-22 §3: damaged_beyond_repair needs at least one evidence photo. */
const PHOTO_REQUIRED_REASON = 'damaged_beyond_repair'

function initialsOf(name) {
  const parts = String(name || 'Staff').trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function reasonLabel(value) {
  return WRITEOFF_REASONS.find((r) => r.value === value)?.label || statusLabel(value)
}

function copyNoun(n) {
  return `${n} ${n === 1 ? 'copy' : 'copies'}`
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function WriteoffsTab({ focusSlipId, onClearFocusSlip, onOpenCopies }) {
  const [slips, setSlips] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filterStatus, setFilterStatus] = useState('all')
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

  // 1. Fetch write-off slips list
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

      // Keep the current selection when it is still on the page, or honor deep-link focusSlipId.
      setSelectedSlipId((current) => {
        if (focusSlipId && (data ?? []).some((item) => item.id === focusSlipId)) return focusSlipId
        if (current && (data ?? []).some((item) => item.id === current)) return current
        return (data ?? [])[0]?.id ?? null
      })
      if (focusSlipId && (data ?? []).some((item) => item.id === focusSlipId)) {
        onClearFocusSlip?.()
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message })
    } finally {
      setLoading(false)
    }
  }, [filterStatus, focusSlipId, onClearFocusSlip, page, search])

  useEffect(() => {
    if (focusSlipId) {
      setFilterStatus('all')
      setSearch('')
      setPage(1)
      setSelectedSlipId(focusSlipId)
    }
  }, [focusSlipId])

  useEffect(() => {
    loadSlips()
  }, [loadSlips])

  // 2. Fetch full detail of the selected slip
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

      // UC-22 §2.2.1: flag staged copies that an active loan or reservation hold
      // now blocks, so the drawer can warn before completion is attempted.
      const copyIds = (copiesData || []).map((row) => row.copy_id).filter(Boolean)
      let loanSet = new Set()
      let holdSet = new Set()
      if (copyIds.length > 0) {
        const [{ data: loanRows }, { data: holdRows }] = await Promise.all([
          supabase.from('loan_items').select('copy_id, status').in('copy_id', copyIds).in('status', ['borrowed', 'overdue', 'ready_for_pickup']),
          supabase.from('reservations').select('copy_id, status').in('copy_id', copyIds).eq('status', 'ready_for_pickup'),
        ])
        loanSet = new Set((loanRows || []).map((r) => r.copy_id))
        holdSet = new Set((holdRows || []).map((r) => r.copy_id))
      }

      const staged = (copiesData || []).map((row) => ({
        id: row.id,
        copy_id: row.copy_id,
        barcode: row.copies?.barcode,
        title: row.copies?.books?.title,
        authors: row.copies?.books?.authors,
        current_status: row.copies?.status,
        condition: row.copies?.condition,
        shelf_location: row.copies?.shelf_location,
        book_id: row.copies?.books?.id,
        replacement_price: row.copies?.books?.replacement_price,
        target_status: row.target_status,
        assessment_note: row.assessment_note || '',
        photo_paths: row.photo_paths || [],
        blocked: loanSet.has(row.copy_id) || holdSet.has(row.copy_id),
      }))

      setSelectedSlip(slipData)
      setDraftReason(slipData.reason_code)
      setDraftNotes(slipData.notes || '')
      setDraftPhotos(slipData.photos || [])
      setStagedCopies(staged)
    } catch (err) {
      setFeedback({ type: 'error', message: err.message })
    } finally {
      setSlipLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSelectedSlipDetail(selectedSlipId)
  }, [loadSelectedSlipDetail, selectedSlipId])

  // Create a blank draft slip
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
      setDraftPhotos((prev) => [...prev, path])
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

    if (stagedCopies.length === 0) {
      setFeedback({ type: 'error', message: 'Cannot complete an empty write-off slip. Please stage at least one copy.' })
      return
    }

    if (draftReason === PHOTO_REQUIRED_REASON) {
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

  // Stage-copy lookup
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

      if (stagedCopies.some((c) => c.copy_id === data.id)) {
        setStageCandidateError(`Copy ${data.barcode} is already staged on this write-off slip.`)
        return
      }

      // UC-22 §2.2.1 guards
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
        shelf_location: stageCandidate.shelf_location,
        book_id: stageCandidate.books?.id,
        replacement_price: stageCandidate.books?.replacement_price,
        target_status: stageTargetStatus,
        assessment_note: stageNote,
        photo_paths: stagePhotos,
      },
    ])

    const barcode = stageCandidate.barcode
    setStageCandidate(null)
    setStageBarcodeQuery('')
    setStageCandidateError(null)
    setShowStageModal(false)
    setFeedback({ type: 'success', message: `Copy ${barcode} added to slip.` })
  }

  const handleRemoveStagedCopy = (copyId) => {
    setStagedCopies((prev) => prev.filter((c) => c.copy_id !== copyId))
  }

  const updateStagedCopy = (copyId, patch) => {
    setStagedCopies((prev) => prev.map((c) => (c.copy_id === copyId ? { ...c, ...patch } : c)))
  }

  // Print completed slip
  const handlePrintSlip = () => {
    if (!selectedSlip) return
    const rowsHtml = stagedCopies
      .map(
        (c) => `
        <tr>
          <td style="padding: 6px 10px; border: 1px solid #ccc; font-family: monospace;">${escapeHtml(c.barcode)}</td>
          <td style="padding: 6px 10px; border: 1px solid #ccc;">${escapeHtml(c.title || '—')}</td>
          <td style="padding: 6px 10px; border: 1px solid #ccc;">${escapeHtml(statusLabel(c.current_status))}</td>
          <td style="padding: 6px 10px; border: 1px solid #ccc; font-weight: bold;">${escapeHtml(statusLabel(c.target_status))}</td>
          <td style="padding: 6px 10px; border: 1px solid #ccc;">${escapeHtml(formatVnd(c.replacement_price))}</td>
          <td style="padding: 6px 10px; border: 1px solid #ccc;">${escapeHtml(c.assessment_note || '—')}</td>
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
            <h2 style="margin: 0; font-size: 18px; color: #6e472a;">${escapeHtml(selectedSlip.number)}</h2>
            <span style="font-size: 12px; font-weight: bold; text-transform: uppercase;">${escapeHtml(selectedSlip.status)}</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; font-size: 13px;">
          <div>
            <p><strong>Reason code:</strong> ${escapeHtml(reasonLabel(selectedSlip.reason_code))}</p>
            <p><strong>Created by:</strong> ${escapeHtml(selectedSlip.profiles?.full_name || 'Staff')}</p>
            <p><strong>Created at:</strong> ${escapeHtml(formatDateTime(selectedSlip.created_at))}</p>
          </div>
          <div>
            <p><strong>Completed at:</strong> ${escapeHtml(formatDateTime(selectedSlip.completed_at))}</p>
            <p><strong>Total decommissioned copies:</strong> ${stagedCopies.length}</p>
            <p><strong>Total book replacement value:</strong> ${escapeHtml(formatVnd(totalLossVal))}</p>
          </div>
        </div>

        ${selectedSlip.notes ? `<div style="background: #fdfbf7; padding: 10px; border: 1px solid #ede6db; border-radius: 6px; margin-bottom: 20px; font-size: 13px;"><strong>Staff Notes:</strong> ${escapeHtml(selectedSlip.notes)}</div>` : ''}

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
  const stagedTotalValue = stagedCopies.reduce((sum, c) => sum + (Number(c.replacement_price) || 0), 0)
  const liveBlocked = stagedCopies.filter((c) => c.blocked || BLOCKING_STATUSES[c.current_status]).length
  const hasEvidence = draftPhotos.length > 0 || stagedCopies.some((c) => (c.photo_paths || []).length > 0)

  return (
    <div className="books-tab">
      {/* Search & primary action */}
      <div className="admin-search-bar-wrap books-lookup-bar">
        <div className="admin-barcode-input">
          <span className="books-search-icon" aria-hidden="true"><IconSearch size={15} /></span>
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
          <IconPlus size={13} aria-hidden="true" />
          <span>+ Create Write-Off Slip</span>
        </button>
      </div>

      {feedback && (
        <div className={`books-alert ${feedback.type === 'error' ? 'danger' : 'success'}`}>
          <span className="books-alert-icon" aria-hidden="true">
            {feedback.type === 'error' ? <IconAlert size={15} /> : <IconCheckCircle size={15} />}
          </span>
          <span className="books-alert-text">{feedback.message}</span>
          <button type="button" className="books-alert-dismiss" aria-label="Dismiss message" onClick={() => setFeedback(null)}>
            <IconClose size={12} />
          </button>
        </div>
      )}

      {/* Filter pills */}
      <div className="books-filter-row books-filter-strip">
        <div className="admin-filter-tabs">
          {STATUS_FILTERS.map((filter) => (
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
          <span>Total: <strong>{total}</strong> slip{total === 1 ? '' : 's'}</span>
          <button type="button" className="books-icon-text-btn" onClick={loadSlips} disabled={loading}>
            <IconRefresh size={12} aria-hidden="true" /> Refresh
          </button>
        </div>
      </div>

      {/* Work layout: slip register cards + inspection drawer */}
      <div className="admin-work-layout books-writeoff-layout">
        <div className="books-slip-list-wrap">
          <div className="books-slip-list-head">
            <div>
              <div className="books-slip-list-title">Write-off register</div>
              <p className="books-slip-list-sub">
                Showing <strong>{slips.length}</strong> of <strong>{total}</strong> slip{total === 1 ? '' : 's'}
              </p>
            </div>
            <span className="books-slip-list-count">Page {page} / {totalPages}</span>
          </div>

          <div className="books-table-scroll" role="list" aria-label="Write-off slips">
            {/* Screen-reader-only table keeps the result text inside
                `.books-table tbody` for assistive tech and regression checks. */}
            <table className="books-table books-table-sr">
              <tbody>
                {slips.map((slip) => (
                  <tr key={slip.id}>
                    <td>{slip.number}</td>
                    <td>{statusLabel(slip.status)}</td>
                  </tr>
                ))}
                {slips.length === 0 && !loading && (
                  <tr>
                    <td>No write-off slips found matching criteria.</td>
                  </tr>
                )}
              </tbody>
            </table>

            {loading && slips.length === 0 && (
              <div className="books-empty-note"><p>Loading write-off slips…</p></div>
            )}

            {slips.map((slip) => {
              const isSelected = slip.id === selectedSlipId
              const copyCount = slip.writeoff_slip_copies?.[0]?.count ?? 0
              const curator = slip.profiles?.full_name || 'Staff'
              const blocked = isSelected && isDraft ? liveBlocked : 0
              return (
                <div
                  key={slip.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  className={`books-slip-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedSlipId(slip.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedSlipId(slip.id)
                    }
                  }}
                >
                  <div className="books-slip-card-head">
                    <div className="books-slip-card-id">
                      <span className="books-slip-hash">#</span>
                      <strong>{slip.number}</strong>
                      <span className={`books-badge tone-${statusTone(slip.status)}`}>{statusLabel(slip.status)}</span>
                    </div>
                    <span className="books-slip-card-date">
                      {slip.status === 'completed'
                        ? `Closed ${formatShortDate(slip.completed_at)}`
                        : slip.status === 'cancelled'
                          ? `Closed ${formatShortDate(slip.cancelled_at)}`
                          : `Created ${formatShortDate(slip.created_at)}`}
                    </span>
                  </div>

                  <div className="books-slip-card-body">
                    <div>
                      <span className="books-slip-eyebrow">Staged quantity</span>
                      <div className="books-slip-qty-value">
                        {copyCount > 0 ? (
                          <>
                            <strong>{copyCount}</strong> {copyCount === 1 ? 'copy' : 'copies'}
                            {slip.status === 'draft' && <span className="books-slip-qty-empty">pending validation</span>}
                          </>
                        ) : (
                          <span className="books-slip-qty-empty">No copies staged yet</span>
                        )}
                      </div>
                      {blocked > 0 && (
                        <span className="books-slip-blocked">
                          <IconAlert size={11} aria-hidden="true" /> {blocked} blocked
                        </span>
                      )}
                    </div>
                    <div className="books-slip-reason">
                      <span className="books-slip-eyebrow">Reason code</span>
                      <span>{reasonLabel(slip.reason_code)}</span>
                    </div>
                  </div>

                  <div className="books-slip-card-foot">
                    <span className="books-slip-curator">
                      <span className="books-avatar" aria-hidden="true">{initialsOf(curator)}</span>
                      <span><strong>{curator}</strong> · curator{isSelected && <span className="books-slip-flag"> · Open in inspector</span>}</span>
                    </span>
                    <span className="books-slip-card-actions">
                      {slip.status === 'draft' ? (
                        <span className={`books-btn-pill ${isSelected ? '' : 'muted'}`}>
                          <IconPen size={11} aria-hidden="true" /> Edit draft
                        </span>
                      ) : (
                        <span className={`books-btn-pill ${isSelected ? '' : 'muted'}`}>
                          View slip
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              )
            })}

            {slips.length === 0 && !loading && (
              <div className="books-slip-empty">
                <IconArchive size={22} aria-hidden="true" />
                <p>No write-off slips found matching criteria.</p>
                <button type="button" className="admin-btn-outline books-btn-sm" onClick={handleCreateNewSlip} disabled={saving}>
                  Create first write-off slip
                </button>
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
                  aria-label="Previous page"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="books-page-pill"
                  aria-label="Next page"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  →
                </button>
              </div>
            </div>
          )}
        </div>
        <aside className="admin-drawer books-detail books-inspector">
          {slipLoading ? (
            <div className="books-empty-note">Loading slip details…</div>
          ) : selectedSlip ? (
            <>
              <div className="books-inspector-head">
                <div className="books-inspector-title">
                  <span className="books-inspector-icon" aria-hidden="true"><IconArchive size={15} /></span>
                  <div>
                    <h3 className="books-inspector-number">{selectedSlip.number}</h3>
                    <div className="books-inspector-kicker">
                      {isDraft ? 'Draft inspection & validation' : 'Write-off record'}
                    </div>
                  </div>
                </div>
                <span className={`books-badge tone-${statusTone(selectedSlip.status)}`}>
                  {statusLabel(selectedSlip.status)}
                </span>
              </div>

              <div className="books-inspector-meta">
                <span>Created {formatDateTime(selectedSlip.created_at)}</span>
                <span>by {selectedSlip.profiles?.full_name || 'Staff'}</span>
              </div>

              {isCompleted && (
                <div className="books-note success">
                  <IconLock size={13} aria-hidden="true" />
                  <span>
                    Immutable: completed on {formatDateTime(selectedSlip.completed_at)}. Edit and delete controls
                    are disabled (FR-COND-03).
                  </span>
                </div>
              )}

              {isCancelled && (
                <div className="books-note danger">
                  <IconClose size={13} aria-hidden="true" />
                  <span>
                    Cancelled: {selectedSlip.cancellation_reason || 'No cancellation reason recorded'}
                    {' '}(on {formatDateTime(selectedSlip.cancelled_at)}).
                  </span>
                </div>
              )}

              {/* 1. Reason code */}
              <div className="books-inspector-section">
                <div className="books-section-label">
                  <span>1 · Mandatory reason code</span>
                  <span className={`books-req ${draftReason ? 'met' : ''}`}>{draftReason ? 'Required · Met' : 'Required'}</span>
                </div>
                {isDraft ? (
                  <div className="books-reason-options" role="radiogroup" aria-label="Reason code">
                    {WRITEOFF_REASONS.map((reason) => (
                      <button
                        key={reason.value}
                        type="button"
                        role="radio"
                        aria-checked={draftReason === reason.value}
                        className={`books-reason-option ${draftReason === reason.value ? 'active' : ''}`}
                        onClick={() => setDraftReason(reason.value)}
                      >
                        <span className="radio-dot" aria-hidden="true" />
                        <span>
                          <strong>{reason.label}</strong>
                          {reason.hint && <small>{reason.hint}</small>}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="books-reason-static">{reasonLabel(selectedSlip.reason_code)}</div>
                )}
              </div>

              {/* 2. Staged copies */}
              <div className="books-inspector-section">
                <div className="books-section-label">
                  <span>2 · Staged Copies ({stagedCopies.length})</span>
                  {isDraft && (
                    <button
                      type="button"
                      className="books-section-action"
                      onClick={() => {
                        setStageCandidate(null)
                        setStageCandidateError(null)
                        setStageBarcodeQuery('')
                        setShowStageModal(true)
                      }}
                    >
                      <IconPlus size={11} aria-hidden="true" /> + Stage Copies
                    </button>
                  )}
                </div>

                <div className="books-staged-list">
                  {stagedCopies.map((c) => {
                    const blocked = c.blocked || BLOCKING_STATUSES[c.current_status]
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
                            {c.authors?.length > 0 && <span> · {c.authors.join(', ')}</span>}
                          </div>
                          <div className="books-staged-facts">
                            <span><em>From</em> {statusLabel(c.current_status)}</span>
                            <span><em>To</em> {statusLabel(c.target_status)}</span>
                            {c.condition && <span><em>Cond</em> {c.condition}</span>}
                            {c.replacement_price != null && <span><em>Value</em> {formatVnd(c.replacement_price)}</span>}
                          </div>
                          {blocked && (
                            <span className="books-staged-blocked">
                              <IconAlert size={12} aria-hidden="true" /> On loan or held for a reservation &mdash; resolve before completing.
                            </span>
                          )}
                          {c.assessment_note && (
                            <div className="books-staged-quote">&ldquo;{c.assessment_note}&rdquo;</div>
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
                              aria-label="Unstage copy"
                            >
                              <IconClose size={13} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {stagedCopies.length === 0 && (
                    <div className="books-staged-empty">
                      <span>No copies staged on this slip.</span>
                      {isDraft && (
                        <button
                          type="button"
                          className="books-section-action"
                          onClick={() => {
                            setStageCandidate(null)
                            setStageCandidateError(null)
                            setStageBarcodeQuery('')
                            setShowStageModal(true)
                          }}
                        >
                          + Stage first copy
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="books-staged-total">
                  <span>Estimated replacement value</span>
                  <strong>{formatVnd(stagedTotalValue)}</strong>
                </div>
              </div>

              {/* 3. Evidence & assessment */}
              <div className="books-inspector-section">
                <div className="books-section-label">
                  <span>3 · Evidence &amp; assessment</span>
                  {draftReason === PHOTO_REQUIRED_REASON && (
                    <span className={`books-req ${hasEvidence ? 'met' : ''}`}>
                      {hasEvidence ? 'Photo · Met' : 'Photo required'}
                    </span>
                  )}
                </div>

                <div className="books-evidence">
                  <div className="books-evidence-grid">
                    {draftPhotos.map((path, idx) => (
                      <EvidenceThumb
                        key={path}
                        path={path}
                        size={62}
                        alt="Slip evidence"
                        removable={isDraft}
                        onRemove={() => handleRemoveSlipPhoto(idx)}
                      />
                    ))}
                    {isDraft && (
                      <label className="books-evidence-add">
                        <IconCamera size={14} aria-hidden="true" />
                        <span>{uploadingPhoto ? 'Uploading…' : 'Add photo'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={handleUploadSlipPhoto}
                          disabled={uploadingPhoto}
                        />
                      </label>
                    )}
                  </div>
                  <div className="books-evidence-hint">
                    {draftReason === PHOTO_REQUIRED_REASON
                      ? 'Photo evidence is required before completing a damaged-beyond-repair slip.'
                      : 'Attach photos of the condition, damage or disposal authorization for the audit trail.'}
                  </div>
                </div>

                <div className="books-field">
                  <label>Assessment / staff notes</label>
                  {isDraft ? (
                    <textarea
                      rows={3}
                      value={draftNotes}
                      onChange={(e) => setDraftNotes(e.target.value)}
                      placeholder="Describe condition, disposal authorization, or stocktaking audit notes…"
                    />
                  ) : (
                    <div style={{ fontSize: '12.5px', color: '#4b5563', whiteSpace: 'pre-wrap' }}>
                      {selectedSlip.notes || '—'}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions footer */}
              {isDraft && (
                <div className="books-inspector-actions">
                  <div className="books-action-grid">
                    <button
                      type="button"
                      className="admin-btn-primary books-action-primary"
                      disabled={saving || (stagedCopies.length === 0 && liveBlocked === 0)}
                      onClick={handleCompleteSlip}
                    >
                      {saving ? 'Processing…' : 'Complete Slip'}
                    </button>
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
                    <div className="books-action-hint">
                      On-loan and held copies are rejected automatically (UC-22 §2.2.1).
                    </div>
                  </div>
                </div>
              )}

              {isCompleted && (
                <div className="books-inspector-actions">
                  <div className="books-action-grid">
                    <button type="button" className="admin-btn-primary books-action-primary" onClick={handlePrintSlip}>
                      <IconPrinter size={14} aria-hidden="true" /> Print / Export
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="books-inspector-idle">
              <IconArchive size={26} aria-hidden="true" />
              <strong>No slip selected</strong>
              <span>Select a write-off slip from the register to inspect its staged copies or complete decommissioning.</span>
            </div>
          )}
        </aside>
      </div>

      {/* Stage Copies modal */}
      {showStageModal && (
        <div className="books-modal-backdrop" onClick={() => setShowStageModal(false)}>
          <div className="books-modal books-modal-stage" onClick={(e) => e.stopPropagation()}>
            <div className="books-modal-header">
              <div>
                <h3 className="books-modal-title">Stage Copy to Write-off Slip</h3>
                <p className="books-modal-subtitle">#{selectedSlip?.number} · scanned copies are validated against UC-22 rules</p>
              </div>
              <button type="button" className="books-modal-close" aria-label="Close" onClick={() => setShowStageModal(false)}>
                <IconClose size={13} aria-hidden="true" />
              </button>
            </div>

            <div className="books-modal-body">
              <div className="books-stage-lookup">
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
                  className="admin-btn-primary"
                  disabled={stageSearching || !stageBarcodeQuery.trim()}
                  onClick={handleLookupCopyForStage}
                >
                  {stageSearching ? 'Looking up…' : 'Lookup'}
                </button>
              </div>

              {stageCandidateError && (
                <div className="books-alert danger">
                  <span>{stageCandidateError}</span>
                </div>
              )}

              {stageCandidate ? (
                <div className="books-stage-candidate">
                  <div className="books-stage-candidate-head">
                    <div>
                      <strong className="books-stage-candidate-title">{stageCandidate.books?.title}</strong>
                      <div className="books-stage-candidate-facts">
                        <span>{stageCandidate.barcode}</span>
                        <span><em>Shelf</em> {stageCandidate.shelf_location || '—'}</span>
                        <span><em>Condition</em> {stageCandidate.condition || '—'}</span>
                      </div>
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

                  <div className="books-stage-evidence">
                    <div className="books-section-label flush">
                      <span>Copy evidence ({stagePhotos.length})</span>
                    </div>
                    <div className="books-evidence-grid">
                      {stagePhotos.map((path, idx) => (
                        <EvidenceThumb
                          key={path}
                          path={path}
                          size={56}
                          alt="Copy evidence"
                          removable
                          onRemove={() => setStagePhotos((prev) => prev.filter((_, i) => i !== idx))}
                        />
                      ))}
                      <label className="books-evidence-add">
                        <IconCamera size={14} aria-hidden="true" />
                        <span>{stageUploading ? '…' : 'Photo'}</span>
                        <input type="file" accept="image/*" hidden onChange={handleUploadStagePhoto} disabled={stageUploading} />
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                !stageCandidateError && (
                  <div className="books-stage-empty">
                    <span className="books-stage-empty-icon" aria-hidden="true"><IconSearch size={17} /></span>
                    <strong>Scan a copy barcode to begin</strong>
                    <span>Copies that are borrowed, held for a reservation, or already retired cannot be staged.</span>
                  </div>
                )
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

      {/* Cancel Slip prompt */}
      {showCancelPrompt && (
        <div className="books-modal-backdrop" onClick={() => setShowCancelPrompt(false)}>
          <div className="books-modal books-modal-cancel" onClick={(e) => e.stopPropagation()}>
            <div className="books-modal-header">
              <div>
                <h3 className="books-modal-title">Cancel Write-off Slip</h3>
                <p className="books-modal-subtitle">#{selectedSlip?.number} · no copy status will be changed</p>
              </div>
              <button type="button" className="books-modal-close" aria-label="Close" onClick={() => setShowCancelPrompt(false)}>
                <IconClose size={13} aria-hidden="true" />
              </button>
            </div>
            <div className="books-modal-body">
              <p style={{ margin: 0, fontSize: '13px', color: '#4b5563' }}>
                Are you sure you want to cancel draft slip <strong>{selectedSlip?.number}</strong>?
                The draft will become inactive and its staged copies stay untouched.
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
