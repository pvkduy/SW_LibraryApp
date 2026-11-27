import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { api } from '../../../lib/api'
import { EvidenceThumb } from '../books/EvidenceThumb'
import {
  IconBarcode,
  IconCalendar,
  IconDownload,
  IconRefresh,
  IconCheck,
  IconReturn,
  IconSearch,
  IconBooks,
  IconBookOpen,
  IconPackage,
  IconAlertTriangle,
  IconMoney,
  IconSort,
} from '../components/AdminIcons'

const CONDITION_RANK = { good: 0, fair: 1, poor: 2, damaged: 3 }
const DAILY_FINE_RATE = 5000

function getConditionRank(value) {
  return CONDITION_RANK[value] ?? 0
}

function getLocalCalendarDayDiff(fromDate, toDate) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const start = new Date(`${fmt.format(fromDate)}T00:00:00Z`)
  const end = new Date(`${fmt.format(toDate)}T00:00:00Z`)
  return Math.round((end.getTime() - start.getTime()) / 86400000)
}

function renderStatusBadge(status) {
  const map = {
    awaiting_payment: { cls: 'admin-badge-ready', label: 'Awaiting Payment' },
    payment_failed: { cls: 'admin-badge-overdue', label: 'Payment Failed' },
    ready_for_pickup: { cls: 'admin-badge-ready', label: 'Ready for Pickup' },
    borrowed: { cls: 'admin-badge-borrowed', label: 'On Loan' },
    overdue: { cls: 'admin-badge-overdue', label: 'Overdue' },
    lost: { cls: 'admin-badge-overdue', label: 'Lost' },
    returned: { cls: 'admin-badge-gray', label: 'Returned' },
    cancelled: { cls: 'admin-badge-gray', label: 'Cancelled' },
    expired: { cls: 'admin-badge-gray', label: 'Expired' },
  }
  const entry = map[status] || { cls: 'admin-badge-gray', label: status || 'Unknown' }
  return <span className={`admin-badge ${entry.cls}`}>{entry.label}</span>
}

export function CirculationPage({ profile }) {
  const [mainTab, setMainTab] = useState('handover-return') // 'handover-return' | 'counter-payments'
  const [drawerMode, setDrawerMode] = useState('handover') // 'handover' | 'return'
  const [filterPill, setFilterPill] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [sortAscending, setSortAscending] = useState(true)
  const [handoverPage, setHandoverPage] = useState(1)
  const [paymentPage, setPaymentPage] = useState(1)
  const [today] = useState(() => new Date())
  const pageSize = 6

  // Search input (shared context-aware bar)
  const [barcodeSearch, setBarcodeSearch] = useState('')

  // Data states
  const [loanItems, setLoanItems] = useState([])
  const [charges, setCharges] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [selectedCharge, setSelectedCharge] = useState(null)
  const [checkedHandoverIds, setCheckedHandoverIds] = useState(() => new Set())
  const [loadError, setLoadError] = useState(null)

  // Inspection states (Handover — UC-20)
  const [handoverCondition, setHandoverCondition] = useState('good')
  const [handoverNotes, setHandoverNotes] = useState('')
  const [handoverScanBarcode, setHandoverScanBarcode] = useState('')
  const [handoverFeeCollected, setHandoverFeeCollected] = useState('')
  const [handoverMedia, setHandoverMedia] = useState([])
  const [handoverMediaError, setHandoverMediaError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionFeedback, setActionFeedback] = useState(null)

  // Inspection states (Return — UC-21)
  const [returnBarcode, setReturnBarcode] = useState('')
  const [returnCondition, setReturnCondition] = useState('good')
  const [returnDamageMode, setReturnDamageMode] = useState('tier') // 'tier' | 'custom'
  const [returnDamageTier, setReturnDamageTier] = useState(0) // 0, 10, 30, 100 (%)
  const [returnCustomDamage, setReturnCustomDamage] = useState('')
  const [returnNextStatus, setReturnNextStatus] = useState('available') // 'available' | 'damaged' | 'under_repair'
  const [returnConditionNotes, setReturnConditionNotes] = useState('')
  const [returnMedia, setReturnMedia] = useState([])
  const [returnMediaError, setReturnMediaError] = useState('')
  const [returnSettleNow, setReturnSettleNow] = useState(false)
  const [returnAmountCollected, setReturnAmountCollected] = useState('')

  // Mark as Lost modal (FR-CIRC-05)
  const [showLostModal, setShowLostModal] = useState(false)
  const [lostReason, setLostReason] = useState('')
  const [lostError, setLostError] = useState(null)

  // Counter Payment state (FR-CIRC-07)
  const [paymentAmountCollected, setPaymentAmountCollected] = useState('')
  const [paymentAmountFocused, setPaymentAmountFocused] = useState(false)
  const [paymentNotes, setPaymentNotes] = useState('')

  // Fetch loans and charges
  const loadData = useCallback(async () => {
    setLoadError(null)
    try {
      const [{ data: items, error: itemsErr }, { data: chgData, error: chgErr }] = await Promise.all([
        supabase
          .from('loan_items')
          .select(`
            id, request_id, status, is_premium, fee, duration_days, pickup_deadline, handover_at, due_at, due_date, returned_at, lost_at,
            condition_out, condition_out_media, condition_in, condition_in_notes, condition_in_media, notes, created_at,
            loan_requests ( id, pickup_code, status ),
            books ( id, title, authors, replacement_price, shelf_location, isbn13 ),
            copies ( id, barcode, status, shelf_location, condition ),
            profiles:uid ( id, full_name, student_id, email, debt_outstanding, active_items, status )
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('charges')
          .select(`
            id, type, amount, status, rate, frozen, paid_at, notes, created_at,
            profiles:uid ( id, full_name, student_id, email, debt_outstanding ),
            loan_items ( id, due_at, books ( title ) )
          `)
          .order('created_at', { ascending: false }),
      ])

      if (itemsErr) throw itemsErr
      if (chgErr) throw chgErr

      const safeItems = items || []
      const safeCharges = chgData || []
      setLoanItems(safeItems)
      setSelectedItem((prev) => safeItems.find((item) => item.id === prev?.id) || null)
      setCheckedHandoverIds((prev) => {
        const readyIds = new Set(safeItems.filter((item) => item.status === 'ready_for_pickup').map((item) => item.id))
        return new Set([...prev].filter((id) => readyIds.has(id)))
      })

      setCharges(safeCharges)
      setSelectedCharge((prev) => safeCharges.find((charge) => charge.id === prev?.id) || null)
    } catch (err) {
      setLoadError(err?.message || 'Failed to load circulation records.')
    }
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      if (active) await loadData()
    })()
    return () => { active = false }
  }, [loadData])

  // KPI Calculations
  const readyCount = loanItems.filter((i) => i.status === 'ready_for_pickup').length
  const awaitingPaymentCount = loanItems.filter((i) => i.status === 'awaiting_payment').length
  const onLoanCount = loanItems.filter((i) => i.status === 'borrowed').length
  const overdueCount = loanItems.filter((i) => i.status === 'overdue').length
  const lostCount = loanItems.filter((i) => i.status === 'lost').length
  const historyCount = loanItems.filter((i) => ['returned', 'cancelled', 'expired'].includes(i.status)).length
  const dueTodayCount = loanItems.filter((i) => {
    const due = i.due_at || i.due_date
    if (i.status !== 'borrowed' || !due) return false
    return getLocalCalendarDayDiff(today, new Date(due)) === 0
  }).length
  const unpaidChargesCount = charges.filter((c) => c.status === 'unpaid').length

  // Filtered loan list (FR-CIRC-01: searchable by student ID, name, book title, copy barcode, OR pickup code)
  const filteredItems = loanItems.filter((item) => {
    const matchesStatus = {
      all: () => true,
      ready: () => item.status === 'ready_for_pickup',
      awaiting_payment: () => item.status === 'awaiting_payment',
      on_loan: () => item.status === 'borrowed',
      overdue: () => item.status === 'overdue',
      lost: () => item.status === 'lost',
      history: () => ['returned', 'cancelled', 'expired'].includes(item.status),
    }[filterPill]?.() ?? true
    if (!matchesStatus) return false

    const query = barcodeSearch.trim().toLowerCase()
    if (!query) return true
    const searchableFields = [
      item.copies?.barcode,
      item.books?.title,
      item.profiles?.student_id,
      item.profiles?.full_name,
      item.loan_requests?.pickup_code,
    ]
    return searchableFields.some((value) => value?.toLowerCase().includes(query))
  }).sort((a, b) => {
    const deadlineA = new Date(a.due_at || a.due_date || a.pickup_deadline || a.created_at).getTime()
    const deadlineB = new Date(b.due_at || b.due_date || b.pickup_deadline || b.created_at).getTime()
    return sortAscending ? deadlineA - deadlineB : deadlineB - deadlineA
  })

  // Filtered counter charges (matching real DB charge types)
  const filteredCharges = charges.filter((charge) => {
    if (charge.status !== 'unpaid') return false
    if (paymentFilter === 'all') return true
    if (paymentFilter === 'overdue') return charge.type === 'overdue_fine'
    if (paymentFilter === 'damage') return ['damage_fee', 'loss_fee'].includes(charge.type)
    if (paymentFilter === 'checkout') return charge.type === 'borrow_fee'
    return !['overdue_fine', 'damage_fee', 'loss_fee', 'borrow_fee'].includes(charge.type)
  })

  const visibleCharges = filteredCharges.filter((charge) => {
    const query = barcodeSearch.trim().toLowerCase()
    if (!query) return true
    return [
      charge.profiles?.full_name,
      charge.profiles?.student_id,
      charge.type,
      charge.notes,
      charge.loan_items?.books?.title,
    ].some((value) => value?.toLowerCase().includes(query))
  })

  const handoverPageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const activeHandoverPage = Math.min(handoverPage, handoverPageCount)
  const handoverPageItems = filteredItems.slice((activeHandoverPage - 1) * pageSize, activeHandoverPage * pageSize)
  const handoverRangeStart = filteredItems.length ? (activeHandoverPage - 1) * pageSize + 1 : 0
  const handoverRangeEnd = Math.min(activeHandoverPage * pageSize, filteredItems.length)

  const paymentPageCount = Math.max(1, Math.ceil(visibleCharges.length / pageSize))
  const activePaymentPage = Math.min(paymentPage, paymentPageCount)
  const paymentPageItems = visibleCharges.slice((activePaymentPage - 1) * pageSize, activePaymentPage * pageSize)
  const paymentRangeStart = visibleCharges.length ? (activePaymentPage - 1) * pageSize + 1 : 0
  const paymentRangeEnd = Math.min(activePaymentPage * pageSize, visibleCharges.length)

  const getItemOutstanding = (item) => {
    const chargeTotal = charges
      .filter((charge) => charge.status === 'unpaid' && charge.loan_items?.id === item.id)
      .reduce((sum, charge) => sum + (Number(charge.amount) || 0), 0)
    const pendingCheckoutFee = item.status === 'awaiting_payment' ? (Number(item.fee) || 0) : 0
    return pendingCheckoutFee + chargeTotal
  }

  // Handover gating checks (UC-20 §2.2.1, §2.2.2, §2.2.3, §2.2.4)
  const nowMs = today.getTime()
  const isPickupExpired = Boolean(
    selectedItem?.pickup_deadline &&
    ['ready_for_pickup', 'awaiting_payment'].includes(selectedItem?.status) &&
    new Date(selectedItem.pickup_deadline).getTime() < nowMs,
  )
  const handoverPatronBlockedDebt = Number(selectedItem?.profiles?.debt_outstanding || 0) > 0
  const handoverPatronInactive = Boolean(selectedItem?.profiles && selectedItem.profiles.status !== 'active')
  const handoverBarcodeMismatch = Boolean(
    handoverScanBarcode.trim() &&
    selectedItem?.copies?.barcode &&
    handoverScanBarcode.trim().toLowerCase() !== selectedItem.copies.barcode.toLowerCase(),
  )
  const handoverBarcodeVerified = Boolean(
    handoverScanBarcode.trim() &&
    selectedItem?.copies?.barcode &&
    handoverScanBarcode.trim().toLowerCase() === selectedItem.copies.barcode.toLowerCase(),
  )
  const isAwaitingCounterFee = selectedItem?.status === 'awaiting_payment'
  const handoverFeeRequired = isAwaitingCounterFee ? Number(selectedItem?.fee || 0) : 0
  const handoverFeeValid = !isAwaitingCounterFee || Number(handoverFeeCollected || 0) >= handoverFeeRequired
  const handoverCanSubmit = Boolean(
    selectedItem &&
    ['ready_for_pickup', 'awaiting_payment'].includes(selectedItem.status) &&
    !handoverPatronBlockedDebt &&
    !handoverPatronInactive &&
    !isPickupExpired &&
    !handoverBarcodeMismatch &&
    handoverFeeValid,
  )

  // Return fine & damage calculations (UC-21 §2.2.1, §2.2.2, §3.2)
  const selectedItemCharges = charges.filter((charge) => charge.loan_items?.id === selectedItem?.id)
  const existingPaidFine = selectedItemCharges
    .filter((charge) => charge.type === 'overdue_fine' && charge.status === 'paid')
    .reduce((sum, charge) => sum + (Number(charge.amount) || 0), 0)
  const existingUnpaidFine = selectedItemCharges
    .filter((charge) => charge.type === 'overdue_fine' && charge.status === 'unpaid')
    .reduce((sum, charge) => sum + (Number(charge.amount) || 0), 0)
  const existingUnpaidLossFee = selectedItemCharges
    .filter((charge) => charge.type === 'loss_fee' && charge.status === 'unpaid')
    .reduce((sum, charge) => sum + (Number(charge.amount) || 0), 0)

  const effectiveDue = selectedItem?.due_at || selectedItem?.due_date
  const isLostRecoveryItem = selectedItem?.status === 'lost'
  const returnOverdueDays = (() => {
    if (!selectedItem || !effectiveDue) return 0
    const due = new Date(effectiveDue)
    const referenceDate = isLostRecoveryItem && selectedItem.lost_at ? new Date(selectedItem.lost_at) : today
    if (referenceDate.getTime() <= due.getTime()) return 0
    const dayDiff = getLocalCalendarDayDiff(due, referenceDate)
    return isLostRecoveryItem ? Math.max(0, dayDiff) : Math.max(1, dayDiff)
  })()

  const replacementPrice = Number(selectedItem?.books?.replacement_price || 0)
  const rawFine = returnOverdueDays * DAILY_FINE_RATE
  const cappedFine = replacementPrice > 0 ? Math.min(rawFine, replacementPrice) : rawFine
  const incrementalFine = Math.max(0, cappedFine - existingPaidFine - existingUnpaidFine)
  const returnFineSubtotal = existingUnpaidFine + incrementalFine

  const conditionDegraded = Boolean(
    selectedItem?.condition_out &&
    getConditionRank(returnCondition) > getConditionRank(selectedItem.condition_out),
  )
  const requiresDamageDecision = conditionDegraded || ['poor', 'damaged'].includes(returnCondition)

  const projectedDamageAmount = (() => {
    if (!requiresDamageDecision) return 0
    if (returnDamageMode === 'custom') {
      const custom = Math.max(0, Number(returnCustomDamage) || 0)
      return replacementPrice > 0 ? Math.min(custom, replacementPrice) : custom
    }
    if (returnDamageTier === null || returnDamageTier === undefined) return 0
    return Math.round((replacementPrice * Number(returnDamageTier)) / 100)
  })()

  const totalReturnDueNow = returnFineSubtotal + projectedDamageAmount
  const selectedItemBarcode = ['borrowed', 'overdue', 'lost'].includes(selectedItem?.status)
    ? selectedItem?.copies?.barcode || ''
    : ''

  const clearHandoverMedia = () => {
    handoverMedia.forEach((media) => URL.revokeObjectURL(media.preview))
    setHandoverMedia([])
    setHandoverMediaError('')
  }

  const clearReturnMedia = () => {
    returnMedia.forEach((media) => URL.revokeObjectURL(media.preview))
    setReturnMedia([])
    setReturnMediaError('')
  }

  const resetHandoverForm = (item) => {
    setHandoverCondition(item?.copies?.condition || 'good')
    setHandoverNotes('')
    setHandoverScanBarcode('')
    setHandoverFeeCollected(item?.status === 'awaiting_payment' ? String(item.fee || 0) : '')
  }

  const resetReturnForm = (item) => {
    const baseline = item?.condition_out || 'good'
    setReturnCondition(baseline === 'damaged' ? 'damaged' : 'good')
    setReturnDamageMode('tier')
    setReturnDamageTier(baseline === 'damaged' ? null : 0)
    setReturnCustomDamage('')
    setReturnNextStatus(baseline === 'damaged' ? 'damaged' : 'available')
    setReturnConditionNotes('')
    setReturnSettleNow(false)
    setReturnAmountCollected('')
  }

  const selectLoanItem = (item) => {
    if (selectedItem?.id !== item.id) {
      clearHandoverMedia()
      clearReturnMedia()
      resetHandoverForm(item)
      resetReturnForm(item)
    }
    setSelectedItem(item)
    if (['borrowed', 'overdue', 'lost'].includes(item.status)) {
      setDrawerMode('return')
      setReturnBarcode(item.copies?.barcode || '')
    } else {
      setDrawerMode('handover')
      setReturnBarcode('')
    }
  }

  const updateBarcodeSearch = (value) => {
    setBarcodeSearch(value)
    setHandoverPage(1)
    setPaymentPage(1)
  }

  const toggleHandoverCheckbox = (itemId) => {
    setCheckedHandoverIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  const isEligibleForBatchHandover = (item) => (
    item.status === 'ready_for_pickup' &&
    item.profiles?.status === 'active' &&
    Number(item.profiles?.debt_outstanding || 0) === 0 &&
    (!item.pickup_deadline || new Date(item.pickup_deadline).getTime() >= nowMs)
  )

  const addHandoverMedia = (event) => {
    const files = Array.from(event.currentTarget.files || [])
    event.currentTarget.value = ''
    const validFiles = files.filter((file) => (
      ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) &&
      file.size <= 10 * 1024 * 1024
    ))
    const remainingSlots = Math.max(0, 3 - handoverMedia.length)
    const acceptedFiles = validFiles.slice(0, remainingSlots)
    const rejectedCount = files.length - acceptedFiles.length

    setHandoverMediaError(
      rejectedCount > 0
        ? 'Select up to 3 JPG, PNG, or WebP images; each image must be 10 MB or smaller.'
        : ''
    )

    const newMedia = acceptedFiles.map((file) => ({
      id: window.crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
    }))
    setHandoverMedia((current) => [...current, ...newMedia].slice(0, 3))
  }

  const removeHandoverMedia = (mediaId) => {
    const removedMedia = handoverMedia.find((media) => media.id === mediaId)
    if (removedMedia) URL.revokeObjectURL(removedMedia.preview)
    setHandoverMedia((current) => current.filter((media) => media.id !== mediaId))
    setHandoverMediaError('')
  }

  const addReturnMedia = (event) => {
    const files = Array.from(event.currentTarget.files || [])
    event.currentTarget.value = ''
    const validFiles = files.filter((file) => (
      ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) &&
      file.size <= 10 * 1024 * 1024
    ))
    const remainingSlots = Math.max(0, 3 - returnMedia.length)
    const acceptedFiles = validFiles.slice(0, remainingSlots)
    const rejectedCount = files.length - acceptedFiles.length

    setReturnMediaError(
      rejectedCount > 0
        ? 'Select up to 3 JPG, PNG, or WebP images; each image must be 10 MB or smaller.'
        : ''
    )
    const newMedia = acceptedFiles.map((file) => ({
      id: window.crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
    }))
    setReturnMedia((current) => [...current, ...newMedia].slice(0, 3))
  }

  const removeReturnMedia = (mediaId) => {
    const removedMedia = returnMedia.find((media) => media.id === mediaId)
    if (removedMedia) URL.revokeObjectURL(removedMedia.preview)
    setReturnMedia((current) => current.filter((media) => media.id !== mediaId))
    setReturnMediaError('')
  }

  const exportCurrentTab = () => {
    const csvCell = (value) => {
      const text = String(value ?? '')
      const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
      return `"${safe.replace(/"/g, '""')}"`
    }

    if (mainTab === 'counter-payments') {
      const columns = ['Student', 'Student ID', 'Charge Type', 'Book', 'Notes', 'Amount (VND)', 'Created']
      const csv = [
        columns,
        ...visibleCharges.map((chg) => [
          chg.profiles?.full_name,
          chg.profiles?.student_id,
          chg.type,
          chg.loan_items?.books?.title || '—',
          chg.notes || '',
          chg.amount,
          chg.created_at,
        ]),
      ].map((row) => row.map(csvCell).join(',')).join('\r\n')
      const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'counter-charges.csv'
      link.click()
      URL.revokeObjectURL(url)
      return
    }

    const columns = ['Borrower', 'Student ID', 'Pickup Code', 'Book', 'Barcode', 'Status', 'Amount', 'Due']
    const csv = [
      columns,
      ...filteredItems.map((item) => [
        item.profiles?.full_name,
        item.profiles?.student_id,
        item.loan_requests?.pickup_code || '',
        item.books?.title,
        item.copies?.barcode,
        item.status,
        getItemOutstanding(item),
        item.due_at || item.due_date || item.pickup_deadline,
      ]),
    ].map((row) => row.map(csvCell).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'circulation-records.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  // Handle Single Handover Confirmation (UC-20)
  const handleConfirmHandover = async () => {
    if (!selectedItem || !handoverCanSubmit) return
    setActionLoading(true)
    setActionFeedback(null)
    const uploadedPaths = []

    try {
      for (const media of handoverMedia) {
        const extension = {
          'image/jpeg': 'jpg',
          'image/png': 'png',
          'image/webp': 'webp',
        }[media.file.type]
        const path = `handover/${selectedItem.id}/${window.crypto.randomUUID()}.${extension}`
        const { error: uploadError } = await supabase.storage
          .from('evidence')
          .upload(path, media.file, { contentType: media.file.type, upsert: false })

        if (uploadError) throw new Error(`Unable to upload image ${media.file.name}: ${uploadError.message}`)
        uploadedPaths.push(path)
      }

      const res = await api.invoke('handover-items', {
        loan_item_id: selectedItem.id,
        condition_out: handoverCondition,
        notes: handoverNotes.trim() || null,
        condition_out_media: uploadedPaths,
        expected_barcode: handoverScanBarcode.trim() || null,
        collect_counter_fee: isAwaitingCounterFee,
        amount_collected: isAwaitingCounterFee ? Number(handoverFeeCollected || 0) : 0,
      })

      const dueText = res.data?.due_at
        ? ` Loan due on ${new Date(res.data.due_at).toLocaleDateString('vi-VN')}.`
        : ''
      const receiptText = res.data?.receipt_number
        ? ` Receipt: ${res.data.receipt_number}${res.data.change > 0 ? ` (Change: ${Number(res.data.change).toLocaleString('vi-VN')}đ)` : ''}.`
        : ''
      setActionFeedback({
        type: 'success',
        message: `${res.message || 'Handover confirmed successfully.'}${dueText}${receiptText}`,
      })
      clearHandoverMedia()
      setHandoverScanBarcode('')
      setHandoverNotes('')
      await loadData()
    } catch (err) {
      // Always clean up uploaded evidence files if handover did not commit
      if (uploadedPaths.length) {
        await supabase.storage.from('evidence').remove(uploadedPaths)
      }
      setActionFeedback({ type: 'error', message: err.message })
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Partial / Batch Handover of Selected Items (UC-20 §2.2.5)
  const handleBatchHandover = async () => {
    const ids = [...checkedHandoverIds]
    if (ids.length === 0) return
    setActionLoading(true)
    setActionFeedback(null)

    let succeeded = 0
    const errors = []

    try {
      for (const id of ids) {
        try {
          await api.invoke('handover-items', {
            loan_item_id: id,
            condition_out: 'good',
            notes: 'Batch handover confirmed at circulation desk.',
            condition_out_media: [],
          })
          succeeded += 1
        } catch (err) {
          errors.push(err.message)
        }
      }

      setCheckedHandoverIds(new Set())
      if (errors.length === 0) {
        setActionFeedback({
          type: 'success',
          message: `Handover confirmed for ${succeeded} selected item(s). Remaining items stay ready for pickup.`,
        })
      } else {
        setActionFeedback({
          type: 'error',
          message: `Completed ${succeeded}/${ids.length} item(s). Errors: ${errors.join(' · ')}`,
        })
      }
      await loadData()
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Return Confirmation (UC-21)
  const handleConfirmReturn = async () => {
    const targetBarcode = returnBarcode.trim() || selectedItemBarcode
    if (!targetBarcode) {
      setActionFeedback({ type: 'error', message: 'Enter or scan the copy barcode for the book being returned.' })
      return
    }
    if (returnCondition === 'damaged' && returnMedia.length === 0) {
      setActionFeedback({ type: 'error', message: 'Upload at least one evidence image for a damaged book.' })
      return
    }
    if (requiresDamageDecision && returnDamageMode === 'tier' && returnDamageTier === null) {
      setActionFeedback({ type: 'error', message: 'Select a damage fee tier (or enter a custom amount) before confirming the return.' })
      return
    }
    if (requiresDamageDecision && returnDamageMode === 'custom' && (!returnConditionNotes.trim() || returnCustomDamage === '')) {
      setActionFeedback({ type: 'error', message: 'Custom damage fee requires both an amount and an explanatory condition note.' })
      return
    }
    if (returnMedia.length && selectedItem?.copies?.barcode !== targetBarcode) {
      setActionFeedback({ type: 'error', message: 'Select the matching loan record before uploading evidence.' })
      return
    }
    if (returnSettleNow && totalReturnDueNow > 0 && Number(returnAmountCollected || 0) < totalReturnDueNow) {
      setActionFeedback({
        type: 'error',
        message: `Collected amount (${Number(returnAmountCollected || 0).toLocaleString('vi-VN')}đ) cannot be less than total charges due (${totalReturnDueNow.toLocaleString('vi-VN')}đ).`,
      })
      return
    }

    setActionLoading(true)
    setActionFeedback(null)
    const uploadedPaths = []

    try {
      for (const media of returnMedia) {
        const extension = {
          'image/jpeg': 'jpg',
          'image/png': 'png',
          'image/webp': 'webp',
        }[media.file.type]
        const path = `return/${selectedItem.id}/${window.crypto.randomUUID()}.${extension}`
        const { error: uploadError } = await supabase.storage
          .from('evidence')
          .upload(path, media.file, { contentType: media.file.type, upsert: false })

        if (uploadError) throw new Error(`Unable to upload image ${media.file.name}: ${uploadError.message}`)
        uploadedPaths.push(path)
      }

      const res = await api.invoke('return-loan', {
        copy_barcode: targetBarcode,
        condition_in: returnCondition,
        damage_tier: returnDamageMode === 'tier' ? Number(returnDamageTier || 0) : 0,
        custom_damage_amount: returnDamageMode === 'custom' && requiresDamageDecision ? Number(returnCustomDamage || 0) : null,
        next_copy_status: returnNextStatus,
        condition_in_notes: returnConditionNotes.trim() || null,
        condition_in_media: uploadedPaths,
        settle_now: returnSettleNow && totalReturnDueNow > 0,
        amount_collected: returnSettleNow && totalReturnDueNow > 0 ? Number(returnAmountCollected || 0) : 0,
        allow_lost_recovery: isLostRecoveryItem,
      })

      const data = res.data
      let msg = res.message || `Return processed successfully. Copy status: ${data?.copy_status}.`
      if (data?.lost_recovery && data?.waived_loss_fee > 0) {
        msg += ` Waived loss fee: ${Number(data.waived_loss_fee).toLocaleString('vi-VN')}đ.`
      }
      if (data?.reversal_receipt) {
        msg += ` Reversal receipt issued: ${data.reversal_receipt}.`
      }
      if (data && data.total_fee > 0) {
        const receipts = Array.isArray(data.receipt_numbers) && data.receipt_numbers.length
          ? data.receipt_numbers.join(', ')
          : data.receipt_number
        msg += ` Total charge: ${Number(data.total_fee).toLocaleString('vi-VN')}đ (${data.settled ? `Collected at counter · Receipt: ${receipts}${data.change > 0 ? ` · Change: ${Number(data.change).toLocaleString('vi-VN')}đ` : ''}` : 'Deferred to student account (debt hold applied)'}).`
      }
      setActionFeedback({ type: 'success', message: msg })
      setReturnBarcode('')
      clearReturnMedia()
      resetReturnForm(null)
      await loadData()
    } catch (err) {
      if (uploadedPaths.length) {
        await supabase.storage.from('evidence').remove(uploadedPaths)
      }
      setActionFeedback({ type: 'error', message: err.message })
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Mark as Lost (FR-CIRC-05)
  const handleConfirmMarkLost = async () => {
    if (!selectedItem) return
    if (!lostReason.trim()) {
      setLostError('Please enter a mandatory reason explaining the loss declaration.')
      return
    }
    setActionLoading(true)
    setLostError(null)
    setActionFeedback(null)

    try {
      const res = await api.invoke('mark-loan-lost', {
        loan_item_id: selectedItem.id,
        reason: lostReason.trim(),
      })
      const feeText = res.data?.loss_fee > 0
        ? ` Replacement charge: ${Number(res.data.loss_fee).toLocaleString('vi-VN')}đ.`
        : ''
      setActionFeedback({
        type: 'success',
        message: `${res.message || 'Loan marked as lost.'}${feeText}`,
      })
      setShowLostModal(false)
      setLostReason('')
      await loadData()
    } catch (err) {
      setLostError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Settle Counter Payment (FR-CIRC-07)
  const handleSettlePayment = async () => {
    if (!selectedCharge) return
    const collected = Number(paymentAmountCollected)
    if (!collected || collected < selectedCharge.amount) {
      setActionFeedback({
        type: 'error',
        message: `Collected amount (${collected.toLocaleString('vi-VN')}đ) cannot be less than the amount due (${selectedCharge.amount.toLocaleString('vi-VN')}đ).`,
      })
      return
    }

    setActionLoading(true)
    setActionFeedback(null)

    try {
      const res = await api.invoke('record-counter-payment', {
        charge_id: selectedCharge.id,
        amount_collected: collected,
        notes: paymentNotes.trim() || 'Counter payment',
      })

      const data = res.data
      setActionFeedback({
        type: 'success',
        message: `${res.message || `Payment recorded. Receipt: ${data?.receipt_number}.`} Change: ${Number(data?.change || 0).toLocaleString('vi-VN')}đ.`,
      })
      setPaymentAmountCollected('')
      setPaymentNotes('')
      await loadData()
    } catch (err) {
      setActionFeedback({ type: 'error', message: err.message })
    } finally {
      setActionLoading(false)
    }
  }

  const returnSubmitDisabled = (
    actionLoading ||
    (!returnBarcode.trim() && !selectedItemBarcode) ||
    (returnCondition === 'damaged' && returnMedia.length === 0) ||
    (requiresDamageDecision && returnDamageMode === 'tier' && returnDamageTier === null) ||
    (requiresDamageDecision && returnDamageMode === 'custom' && (!returnConditionNotes.trim() || returnCustomDamage === '')) ||
    (returnSettleNow && totalReturnDueNow > 0 && Number(returnAmountCollected || 0) < totalReturnDueNow)
  )

  return (
    <div className="admin-circulation-page">
      {/* Top Header & Navigation Tabs */}
      <div className="admin-page-title-row">
        <div>
          <h1 className="admin-page-title">Circulation Desk</h1>
          <div className="admin-page-desc">
            Real-time loan checkout, pickup handovers (UC-20), returns &amp; loss handling (UC-21), and counter settlements
          </div>
        </div>

        <div className="admin-drawer-tabs" style={{ width: '340px' }}>
          <button
            type="button"
            className={`admin-drawer-tab-btn ${mainTab === 'handover-return' ? 'active' : ''}`}
            onClick={() => {
              setMainTab('handover-return')
              setActionFeedback(null)
            }}
          >
            <IconReturn size={13} /> Handover &amp; Return
          </button>
          <button
            type="button"
            className={`admin-drawer-tab-btn ${mainTab === 'counter-payments' ? 'active' : ''}`}
            onClick={() => {
              setMainTab('counter-payments')
              setActionFeedback(null)
            }}
          >
            <IconMoney size={13} /> Counter Payments ({unpaidChargesCount})
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <div>
            <div className="admin-kpi-label">Ready for Pickup</div>
            <div className="admin-kpi-value">{readyCount}</div>
          </div>
          <div className="admin-kpi-badge" style={{ backgroundColor: '#fde7d5', color: '#8a4b22' }}>
            <IconPackage size={15} />
          </div>
        </div>

        <div className="admin-kpi-card">
          <div>
            <div className="admin-kpi-label">Due Today</div>
            <div className="admin-kpi-value">{dueTodayCount}</div>
          </div>
          <div className="admin-kpi-badge" style={{ backgroundColor: '#f1ece8', color: '#72685e' }}>
            <IconCalendar size={15} />
          </div>
        </div>

        <div className="admin-kpi-card">
          <div>
            <div className="admin-kpi-label">Overdue Alerts</div>
            <div className="admin-kpi-value" style={{ color: '#dc2626' }}>
              {overdueCount}
            </div>
          </div>
          <div className="admin-kpi-badge" style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>
            <IconAlertTriangle size={15} />
          </div>
        </div>

        <div className="admin-kpi-card">
          <div>
            <div className="admin-kpi-label">Active Loans</div>
            <div className="admin-kpi-value">{onLoanCount}</div>
          </div>
          <div className="admin-kpi-badge" style={{ backgroundColor: '#d8efdf', color: '#467357' }}>
            <IconBookOpen size={15} />
          </div>
        </div>
      </div>

      {/* Context-Aware Search Bar (Single bar for active tab) */}
      <div className="admin-search-bar-wrap">
        <div className="admin-barcode-input">
          <span className="admin-barcode-icon"><IconBarcode size={15} color="#6e472a" /></span>
          <input
            type="text"
            placeholder={
              mainTab === 'counter-payments'
                ? 'Search student name, student ID, charge type, or book title...'
                : 'Scan or enter copy barcode, student ID, name, or pickup code...'
            }
            value={barcodeSearch}
            onChange={(e) => updateBarcodeSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') loadData()
            }}
          />
        </div>
        <button type="button" className="admin-btn-primary" onClick={loadData}>
          <IconSearch size={13} />
          Lookup
        </button>
        {barcodeSearch && (
          <button type="button" className="admin-btn-outline" onClick={() => updateBarcodeSearch('')}>
            Clear
          </button>
        )}
        <button type="button" className="admin-btn-outline" onClick={exportCurrentTab}>
          <IconDownload size={13} />
          Batch Export
        </button>
      </div>

      {/* Load error or Action feedback banner */}
      {(loadError || actionFeedback) && (
        <div
          role={loadError || actionFeedback?.type === 'error' ? 'alert' : 'status'}
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: (loadError || actionFeedback?.type === 'error') ? '#fee2e2' : '#dcfce7',
            color: (loadError || actionFeedback?.type === 'error') ? '#991b1b' : '#166534',
            fontWeight: 600,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <span>{loadError || actionFeedback?.message}</span>
          <button
            type="button"
            onClick={() => { setLoadError(null); setActionFeedback(null) }}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW 1: HANDOVER & RETURN                                             */}
      {/* ===================================================================== */}
      {mainTab === 'handover-return' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div className="admin-filter-tabs">
              {[
                ['all', 'All', loanItems.length],
                ['awaiting_payment', 'Awaiting payment', awaitingPaymentCount],
                ['ready', 'Ready for pickup', readyCount],
                ['on_loan', 'On loan', onLoanCount],
                ['overdue', 'Overdue', overdueCount],
                ['lost', 'Lost', lostCount],
                ['history', 'History', historyCount],
              ].map(([key, label, count]) => (
                <button
                  key={key}
                  type="button"
                  className={`admin-pill-btn ${filterPill === key ? 'active' : ''}`}
                  onClick={() => { setFilterPill(key); setHandoverPage(1) }}
                >
                  {label} <span className="admin-pill-count">{count}</span>
                </button>
              ))}
            </div>

            {checkedHandoverIds.size > 0 && (
              <button
                type="button"
                className="admin-btn-primary"
                disabled={actionLoading}
                onClick={handleBatchHandover}
              >
                <IconCheck size={14} />
                {actionLoading ? 'Processing...' : `Hand Over Selected Items (${checkedHandoverIds.size})`}
              </button>
            )}
          </div>

          <div className={`admin-work-layout ${selectedItem ? '' : 'admin-work-layout-single'}`}>
            {/* Left: Table */}
            <div className="admin-table-container">
              <div className="admin-table-toolbar admin-circulation-table-toolbar">
                <button type="button" className="admin-btn-outline admin-table-sort" onClick={() => setSortAscending((current) => !current)}>
                  <IconSort size={12} /> Sort: Deadline ({sortAscending ? 'Asc' : 'Desc'})
                </button>
                <button type="button" className="admin-btn-icon" aria-label="Refresh records" onClick={loadData}>
                  <IconRefresh size={13} />
                </button>
              </div>

              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: '32px' }} aria-label="Select for partial handover" />
                    <th>Borrower &amp; Student ID</th>
                    <th>Book Title &amp; Shelf</th>
                    <th>Barcode / Code</th>
                    <th>Deadline / Due</th>
                    <th>Fee / Fine</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {handoverPageItems.map((item) => {
                    const isSelected = selectedItem?.id === item.id
                    const canBatch = isEligibleForBatchHandover(item)
                    const itemDue = item.due_at || item.due_date
                    return (
                      <tr
                        key={item.id}
                        className={isSelected ? 'selected' : ''}
                        onClick={() => selectLoanItem(item)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          {item.status === 'ready_for_pickup' && (
                            <input
                              type="checkbox"
                              disabled={!canBatch}
                              checked={checkedHandoverIds.has(item.id)}
                              onChange={() => toggleHandoverCheckbox(item.id)}
                              title={canBatch ? 'Select for partial handover (UC-20 §2.2.5)' : 'Blocked by debt, status, or expiry'}
                              aria-label={`Select ${item.books?.title} for handover`}
                            />
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#241e19' }}>
                            {item.profiles?.full_name || 'Student'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#72685e' }}>
                            {item.profiles?.student_id || 'Not available'}
                            {item.profiles?.debt_outstanding > 0 && (
                              <span style={{ color: '#dc2626', marginLeft: '6px', fontWeight: 600 }}>
                                (Debt {item.profiles.debt_outstanding.toLocaleString('vi-VN')}đ)
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          <div style={{ fontWeight: 600 }}>{item.books?.title}</div>
                          <div style={{ fontSize: '12px', color: '#9d9388' }}>
                            {item.copies?.shelf_location || item.books?.shelf_location || 'Main shelf'}
                            {item.is_premium && (
                              <span style={{ color: '#92400e', fontWeight: 600, marginLeft: '6px' }}>(Premium)</span>
                            )}
                          </div>
                        </td>

                        <td>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 600,
                              background: '#f2ede5',
                              padding: '3px 6px',
                              borderRadius: '4px',
                              display: 'inline-block',
                            }}
                          >
                            {item.copies?.barcode || 'N/A'}
                          </span>
                          {item.loan_requests?.pickup_code && (
                            <div style={{ fontSize: '11px', color: '#6e472a', fontFamily: 'monospace', marginTop: '2px' }}>
                              {item.loan_requests.pickup_code}
                            </div>
                          )}
                        </td>

                        <td>
                          {['ready_for_pickup', 'awaiting_payment'].includes(item.status) && (
                            <span style={{ color: '#92400e', fontSize: '12px' }}>
                              Pickup: {item.pickup_deadline ? new Date(item.pickup_deadline).toLocaleDateString('vi-VN') : '48h'}
                            </span>
                          )}
                          {item.status === 'borrowed' && (
                            <span style={{ color: '#166534', fontSize: '12px' }}>
                              Due: {itemDue ? new Date(itemDue).toLocaleDateString('vi-VN') : '14 days'}
                            </span>
                          )}
                          {item.status === 'overdue' && (
                            <span style={{ color: '#dc2626', fontSize: '12px', fontWeight: 600 }}>
                              Late: {itemDue ? new Date(itemDue).toLocaleDateString('vi-VN') : 'Overdue'}
                            </span>
                          )}
                          {item.status === 'lost' && (
                            <span style={{ color: '#dc2626', fontSize: '12px', fontWeight: 600 }}>
                              Lost: {item.lost_at ? new Date(item.lost_at).toLocaleDateString('vi-VN') : 'Declared'}
                            </span>
                          )}
                          {item.status === 'returned' && (
                            <span style={{ color: '#72685e', fontSize: '12px' }}>
                              Returned: {item.returned_at ? new Date(item.returned_at).toLocaleDateString('vi-VN') : 'Completed'}
                            </span>
                          )}
                          {['cancelled', 'expired', 'payment_failed'].includes(item.status) && (
                            <span style={{ color: '#72685e', fontSize: '12px' }}>
                              {new Date(item.created_at).toLocaleDateString('vi-VN')}
                            </span>
                          )}
                        </td>

                        <td>
                          <span style={{ color: getItemOutstanding(item) > 0 ? '#dc2626' : '#72685e', fontWeight: 600 }}>
                            {getItemOutstanding(item).toLocaleString('vi-VN')}đ
                          </span>
                        </td>

                        <td>{renderStatusBadge(item.status)}</td>

                        <td>
                          <button
                            type="button"
                            className="admin-btn-outline"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={(e) => {
                              e.stopPropagation()
                              selectLoanItem(item)
                            }}
                          >
                            {['ready_for_pickup', 'awaiting_payment'].includes(item.status) ? 'Handover' : 'Inspect'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}

                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: '#72685e' }}>
                        No requests match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="admin-pagination-footer">
                <span>Showing {handoverRangeStart}–{handoverRangeEnd} of {filteredItems.length} records · {pageSize} per page</span>
                <div className="admin-pagination-controls">
                  <button
                    type="button"
                    aria-label="Previous page"
                    disabled={activeHandoverPage === 1}
                    onClick={() => setHandoverPage((page) => Math.max(1, page - 1))}
                  >
                    ‹
                  </button>
                  {Array.from({ length: handoverPageCount }, (_, index) => index + 1).map((page) => (
                    <button
                      type="button"
                      key={page}
                      className={page === activeHandoverPage ? 'active' : ''}
                      aria-current={page === activeHandoverPage ? 'page' : undefined}
                      onClick={() => setHandoverPage(page)}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-label="Next page"
                    disabled={activeHandoverPage === handoverPageCount}
                    onClick={() => setHandoverPage((page) => Math.min(handoverPageCount, page + 1))}
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Inspection Side Drawer */}
            {selectedItem && (
              <div className="admin-drawer">
                <div className="admin-drawer-tabs">
                  <button
                    type="button"
                    className={`admin-drawer-tab-btn ${drawerMode === 'handover' ? 'active' : ''}`}
                    onClick={() => setDrawerMode('handover')}
                  >
                    <IconCheck size={13} /> Handover
                  </button>
                  <button
                    type="button"
                    className={`admin-drawer-tab-btn ${drawerMode === 'return' ? 'active' : ''}`}
                    onClick={() => {
                      setDrawerMode('return')
                      setReturnBarcode(
                        ['borrowed', 'overdue', 'lost'].includes(selectedItem?.status)
                          ? selectedItem.copies?.barcode || ''
                          : ''
                      )
                    }}
                  >
                    <IconReturn size={13} /> Return
                  </button>
                </div>

                {/* ----------------------------------------------------------- */}
                {/* DRAWER VIEW A: HANDOVER (UC-20)                             */}
                {/* ----------------------------------------------------------- */}
                {drawerMode === 'handover' && (
                  <>
                    <div className="admin-patron-heading">
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#241e19' }}>
                        {selectedItem.profiles?.full_name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#72685e' }}>
                        {selectedItem.profiles?.student_id || 'No student ID'} ·{' '}
                        <span style={{ fontWeight: 600, color: selectedItem.profiles?.status === 'active' ? '#166534' : '#dc2626' }}>
                          {selectedItem.profiles?.status?.toUpperCase() || 'UNKNOWN'}
                        </span>
                        {selectedItem.loan_requests?.pickup_code && (
                          <> · Code: <strong>{selectedItem.loan_requests.pickup_code}</strong></>
                        )}
                      </div>
                    </div>

                    {/* UC-20 §2.2.1 & §2.2.2 Blocking Warnings */}
                    {handoverPatronBlockedDebt && (
                      <div style={{ padding: '10px', borderRadius: '6px', background: '#fee2e2', color: '#991b1b', fontSize: '12px', fontWeight: 600 }}>
                        <div>
                          Outstanding debt: {Number(selectedItem.profiles.debt_outstanding).toLocaleString('vi-VN')}đ. Settle outstanding charges first.
                        </div>
                        <button
                          type="button"
                          className="admin-btn-outline"
                          style={{ marginTop: '6px', fontSize: '11px', padding: '4px 8px' }}
                          onClick={() => {
                            setMainTab('counter-payments')
                            updateBarcodeSearch(selectedItem.profiles?.student_id || selectedItem.profiles?.full_name || '')
                          }}
                        >
                          Open Counter Payments for Student →
                        </button>
                      </div>
                    )}
                    {handoverPatronInactive && (
                      <div style={{ padding: '10px', borderRadius: '6px', background: '#fee2e2', color: '#991b1b', fontSize: '12px', fontWeight: 600 }}>
                        Account status is {selectedItem.profiles.status}. Handover is blocked until account is restored to active.
                      </div>
                    )}
                    {isPickupExpired && (
                      <div style={{ padding: '10px', borderRadius: '6px', background: '#fee2e2', color: '#991b1b', fontSize: '12px', fontWeight: 600 }}>
                        Pickup deadline passed ({new Date(selectedItem.pickup_deadline).toLocaleString('vi-VN')}). Request has expired.
                      </div>
                    )}

                    {/* Patron Standing */}
                    <div className="admin-drawer-box">
                      <div className="admin-drawer-box-title">Patron Standing</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                        <span style={{ color: '#72685e' }}>Outstanding Debt:</span>
                        <span
                          style={{
                            fontWeight: 700,
                            color: handoverPatronBlockedDebt ? '#dc2626' : '#166534',
                          }}
                        >
                          {handoverPatronBlockedDebt
                            ? `${selectedItem.profiles.debt_outstanding.toLocaleString('vi-VN')}đ (Blocked)`
                            : '0đ (Clean)'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ color: '#72685e' }}>Active Items on Loan:</span>
                        <span style={{ fontWeight: 600 }}>
                          {selectedItem.profiles?.active_items || 0} book(s)
                        </span>
                      </div>
                      <div className="admin-loan-quota-track">
                        <span style={{ width: `${Math.min(100, ((selectedItem.profiles?.active_items || 0) / 5) * 100)}%` }} />
                      </div>
                    </div>

                    {/* Physical Copy Verification (UC-20 §2.2.3) */}
                    <div className="admin-drawer-box">
                      <div className="admin-drawer-box-title">Physical Copy Verification</div>
                      <div className="admin-copy-summary">
                        <div className="admin-copy-thumbnail"><IconBooks size={22} /></div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '14px' }}>{selectedItem.books?.title}</div>
                          <div style={{ fontSize: '12px', color: '#72685e' }}>
                            {selectedItem.books?.authors?.join(', ')}
                          </div>
                          <div style={{ fontSize: '11px', color: '#72685e' }}>
                            Allocated Barcode: <strong>{selectedItem.copies?.barcode || 'N/A'}</strong>
                          </div>
                        </div>
                      </div>

                      {['ready_for_pickup', 'awaiting_payment'].includes(selectedItem.status) && (
                        <div style={{ marginTop: '8px' }}>
                          <label className="admin-condition-label" htmlFor="handover-verify-barcode">
                            Scan / Verify Copy Barcode (optional check)
                          </label>
                          <input
                            id="handover-verify-barcode"
                            type="text"
                            value={handoverScanBarcode}
                            onChange={(e) => setHandoverScanBarcode(e.target.value)}
                            placeholder={`Scan ${selectedItem.copies?.barcode || 'barcode'} to verify...`}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: `1px solid ${handoverBarcodeMismatch ? '#dc2626' : handoverBarcodeVerified ? '#16a34a' : '#dcd3c5'}`,
                              fontFamily: 'monospace',
                              fontSize: '12px',
                              boxSizing: 'border-box',
                            }}
                          />
                          {handoverBarcodeMismatch && (
                            <div style={{ marginTop: '4px', color: '#dc2626', fontSize: '11px', fontWeight: 600 }}>
                              Scanned copy {handoverScanBarcode.trim()} does not match staged copy {selectedItem.copies?.barcode} for this title.
                            </div>
                          )}
                          {handoverBarcodeVerified && (
                            <div style={{ marginTop: '4px', color: '#166534', fontSize: '11px', fontWeight: 600 }}>
                              ✓ Physical copy barcode verified.
                            </div>
                          )}
                        </div>
                      )}

                      <div className="admin-loan-period">
                        <span>Loan period ({selectedItem.duration_days || 14} days · due 23:59:59 VN time)</span>
                        <strong>
                          {effectiveDue
                            ? `Return due ${new Date(effectiveDue).toLocaleDateString('vi-VN', { month: 'short', day: '2-digit', year: 'numeric' })}`
                            : 'Due date set at handover'}
                        </strong>
                      </div>
                    </div>

                    {/* UC-20 §2.2.4 Counter Fee Settlement for awaiting_payment */}
                    {isAwaitingCounterFee && (
                      <div className="admin-drawer-box" style={{ borderColor: '#f59e0b', background: '#fffbeb' }}>
                        <div className="admin-drawer-box-title" style={{ color: '#92400e' }}>
                          Counter Fee Settlement Required
                        </div>
                        <div style={{ fontSize: '12px', color: '#78350f', marginBottom: '6px' }}>
                          Required Premium checkout fee: <strong>{handoverFeeRequired.toLocaleString('vi-VN')}đ</strong>
                        </div>
                        <label className="admin-condition-label" htmlFor="handover-fee-collected">
                          Amount Collected (VND)
                        </label>
                        <input
                          id="handover-fee-collected"
                          type="text"
                          inputMode="numeric"
                          value={handoverFeeCollected}
                          onChange={(e) => setHandoverFeeCollected(e.target.value.replace(/\D/g, ''))}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: '1px solid #dcd3c5',
                            fontWeight: 600,
                            boxSizing: 'border-box',
                          }}
                        />
                        {Number(handoverFeeCollected || 0) >= handoverFeeRequired ? (
                          <div style={{ marginTop: '4px', fontSize: '12px', color: '#166534', fontWeight: 600 }}>
                            Change: {(Number(handoverFeeCollected || 0) - handoverFeeRequired).toLocaleString('vi-VN')}đ
                          </div>
                        ) : (
                          <div style={{ marginTop: '4px', fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>
                            Collected amount must be at least {handoverFeeRequired.toLocaleString('vi-VN')}đ.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Condition Assessment (Out) */}
                    <div className="admin-condition-section">
                      <div className="admin-condition-heading">
                        <div className="admin-drawer-box-title">Condition Assessment (OUT)</div>
                        <span>Inspector: {profile?.full_name || 'Staff'}</span>
                      </div>
                      <div className="admin-segmented-controls">
                        {['good', 'fair', 'poor', 'damaged'].map((cond) => (
                          <button
                            key={cond}
                            type="button"
                            className={`admin-segment-btn ${cond === 'damaged' ? 'danger' : ''} ${handoverCondition === cond ? 'active' : ''}`}
                            onClick={() => setHandoverCondition(cond)}
                          >
                            {cond[0].toUpperCase() + cond.slice(1)}
                          </button>
                        ))}
                      </div>
                      <label className="admin-condition-label" htmlFor="handover-condition-notes">
                        Archivist Condition Annotation
                      </label>
                      <textarea
                        id="handover-condition-notes"
                        rows="2"
                        style={{
                          width: '100%',
                          marginTop: '6px',
                          borderRadius: '6px',
                          border: '1px solid #dcd3c5',
                          padding: '8px',
                          fontSize: '13px',
                          boxSizing: 'border-box',
                          fontFamily: 'inherit',
                        }}
                        placeholder="Optional notes about the book's outgoing condition..."
                        value={handoverNotes}
                        onChange={(e) => setHandoverNotes(e.target.value)}
                      />
                      {['ready_for_pickup', 'awaiting_payment'].includes(selectedItem.status) && (
                        <div className="admin-condition-media">
                          <div className="admin-condition-media-heading">
                            <span>Handover Condition Media</span>
                            <span>({handoverMedia.length} of 3 uploaded)</span>
                          </div>
                          <div className="admin-condition-media-slots">
                            {[0, 1, 2].map((slot) => {
                              const media = handoverMedia[slot]
                              return media ? (
                                <div className="admin-condition-media-preview" key={media.id}>
                                  <img src={media.preview} alt={`Handover evidence ${slot + 1}`} />
                                  <button
                                    type="button"
                                    aria-label={`Remove image ${slot + 1}`}
                                    onClick={() => removeHandoverMedia(media.id)}
                                  >
                                    ×
                                  </button>
                                </div>
                              ) : (
                                <label
                                  className="admin-condition-media-upload"
                                  key={`empty-${slot}`}
                                  aria-label={`Upload handover image ${slot + 1}`}
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M4 7h3l1.5-2h7L17 7h3v12H4z" />
                                    <circle cx="12" cy="13" r="3.5" />
                                    <path d="M12 11.5v3M10.5 13h3" />
                                  </svg>
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    multiple
                                    onChange={addHandoverMedia}
                                  />
                                </label>
                              )
                            })}
                          </div>
                          {handoverMediaError && (
                            <div className="admin-condition-media-error">{handoverMediaError}</div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Submit Handover */}
                    <div className="admin-drawer-submit">
                      <div className="admin-collection-fee">
                        <span>Collection Fee</span>
                        <strong>{(Number(selectedItem.fee) || 0).toLocaleString('vi-VN')}đ</strong>
                      </div>
                      {!['ready_for_pickup', 'awaiting_payment'].includes(selectedItem.status) && (
                        <div style={{ fontSize: '12px', color: '#92400e', marginBottom: '8px', fontWeight: 600 }}>
                          Status mismatch: {selectedItem.status}. Handover requires Ready for Pickup (or Awaiting Payment).
                        </div>
                      )}
                      <button
                        type="button"
                        className="admin-btn-primary"
                        style={{ width: '100%', justifyContent: 'center', height: '40px' }}
                        disabled={actionLoading || !handoverCanSubmit}
                        onClick={handleConfirmHandover}
                      >
                        <IconCheck size={16} />
                        {actionLoading
                          ? 'Processing...'
                          : isAwaitingCounterFee
                            ? 'Record Counter Payment & Handover'
                            : 'Confirm Handover & Issue Loan'}
                      </button>
                    </div>
                  </>
                )}

                {/* ----------------------------------------------------------- */}
                {/* DRAWER VIEW B: RETURN & LOST FLOW (UC-21 / FR-CIRC-05)      */}
                {/* ----------------------------------------------------------- */}
                {drawerMode === 'return' && (
                  <>
                    <div className="admin-return-title">
                      <div className="admin-return-title-icon"><IconReturn size={16} /></div>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#241e19' }}>
                          {isLostRecoveryItem ? 'Recover Lost Book (Path A)' : 'Process Book Return'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#72685e' }}>
                          Loan ref: {selectedItem?.id?.slice(0, 10) || 'Scan barcode'}
                        </div>
                      </div>
                      {selectedItem?.status === 'overdue' && (
                        <span className="admin-overdue-chip">OVERDUE · {returnOverdueDays}D</span>
                      )}
                      {isLostRecoveryItem && (
                        <span className="admin-overdue-chip">LOST RECOVERY</span>
                      )}
                    </div>

                    {isLostRecoveryItem && (
                      <div style={{ padding: '9px 10px', borderRadius: '6px', background: '#fef3c7', color: '#92400e', fontSize: '12px' }}>
                        <strong>Path A Lost Recovery (UC-21 §2.2.4):</strong> Returning this lost copy automatically waives any unpaid replacement charge
                        {existingUnpaidLossFee > 0 ? ` (${existingUnpaidLossFee.toLocaleString('vi-VN')}đ)` : ''} or issues a reversal receipt if paid within 90 days.
                      </div>
                    )}

                    <div className="admin-drawer-box">
                      <div className="admin-drawer-box-title">Patron &amp; Loan Context</div>
                      <div className="admin-context-grid">
                        <div>
                          <span>Patron</span>
                          <strong>{selectedItem?.profiles?.full_name || 'Scan a copy'}</strong>
                          <small>{selectedItem?.profiles?.student_id || 'No student ID'}</small>
                        </div>
                        <div>
                          <span>Item Barcode</span>
                          <strong>{selectedItem?.copies?.barcode || returnBarcode || 'Not scanned'}</strong>
                          <small>{selectedItem?.books?.title || 'Book title'}</small>
                        </div>
                      </div>
                      <div className="admin-context-dates">
                        <span>Borrowed: {selectedItem?.handover_at ? new Date(selectedItem.handover_at).toLocaleDateString('vi-VN') : '—'}</span>
                        <span>Due: {effectiveDue ? new Date(effectiveDue).toLocaleDateString('vi-VN') : '—'}</span>
                      </div>
                    </div>

                    {returnOverdueDays > 0 && (
                      <div className="admin-drawer-box">
                        <div className="admin-drawer-box-title">Overdue Fine Computation (Capped &amp; Reconciled)</div>
                        <div className="admin-overdue-computation">
                          <div>
                            <strong>{returnOverdueDays} Day(s) Past Due</strong>
                            <span>
                              {DAILY_FINE_RATE.toLocaleString('vi-VN')}đ/day
                              {replacementPrice > 0 ? ` · Cap ${replacementPrice.toLocaleString('vi-VN')}đ` : ''}
                              {existingPaidFine > 0 ? ` · Paid ${existingPaidFine.toLocaleString('vi-VN')}đ` : ''}
                            </span>
                          </div>
                          <strong>{returnFineSubtotal.toLocaleString('vi-VN')}đ</strong>
                        </div>
                      </div>
                    )}

                    {/* Barcode input for return */}
                    <div>
                      <label className="admin-condition-label" htmlFor="return-copy-barcode">
                        Copy Barcode
                      </label>
                      <input
                        id="return-copy-barcode"
                        type="text"
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          border: '1px solid #dcd3c5',
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          boxSizing: 'border-box',
                          marginTop: '3px',
                        }}
                        placeholder="Scan or type barcode (e.g. 9786040000002-01)"
                        value={returnBarcode}
                        onChange={(e) => {
                          const value = e.target.value
                          setReturnBarcode(value)
                          const needle = value.trim().toLowerCase()
                          if (!needle) return
                          const matchedActive = loanItems.find(
                            (item) =>
                              ['borrowed', 'overdue', 'lost'].includes(item.status) &&
                              item.copies?.barcode?.toLowerCase() === needle,
                          )
                          if (matchedActive) selectLoanItem(matchedActive)
                        }}
                        className="admin-return-barcode"
                      />
                      {selectedItem && !['borrowed', 'overdue', 'lost'].includes(selectedItem.status) && !returnBarcode.trim() && (
                        <div className="admin-inline-hint">
                          Select an on-loan, overdue, or lost record, or scan a barcode.
                        </div>
                      )}
                    </div>

                    {/* Condition Verification (In) */}
                    <div className="admin-drawer-box">
                      <div className="admin-condition-heading">
                        <div className="admin-drawer-box-title">Condition Assessment</div>
                        <span className="admin-required-mark">Required</span>
                      </div>
                      <div className="admin-return-condition-out">
                        <span>Condition Out (Baseline)</span>
                        <strong>{selectedItem?.condition_out?.replace(/^\w/, (letter) => letter.toUpperCase()) || 'Not recorded'}</strong>
                        <small>
                          {selectedItem?.handover_at
                            ? `Checked out ${new Date(selectedItem.handover_at).toLocaleDateString('vi-VN')}`
                            : 'Checkout date unavailable'}
                          {selectedItem?.notes ? ` · ${selectedItem.notes}` : ''}
                        </small>
                        {Array.isArray(selectedItem?.condition_out_media) && selectedItem.condition_out_media.length > 0 && (
                          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                            {selectedItem.condition_out_media.map((path) => (
                              <EvidenceThumb key={path} path={path} size={40} alt="Handover condition baseline" />
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="admin-condition-label">Select verified in-condition</div>
                      <div className="admin-return-condition-grid">
                        {[
                          ['good', 'No flaws'],
                          ['fair', 'Light scuff'],
                          ['poor', 'Heavy wear'],
                          ['damaged', 'Requires repair'],
                        ].map(([cond, description]) => (
                          <button
                            key={cond}
                            type="button"
                            className={`admin-return-condition-option ${cond === 'damaged' ? 'danger' : ''} ${returnCondition === cond ? 'active' : ''}`}
                            onClick={() => {
                              setReturnCondition(cond)
                              const worsened = selectedItem?.condition_out
                                ? getConditionRank(cond) > getConditionRank(selectedItem.condition_out)
                                : false
                              const needsDecision = worsened || ['poor', 'damaged'].includes(cond)
                              setReturnDamageTier(needsDecision ? null : 0)
                              if (cond === 'damaged') setReturnNextStatus('damaged')
                              else if (returnNextStatus === 'damaged') setReturnNextStatus('available')
                            }}
                          >
                            <strong>{cond[0].toUpperCase() + cond.slice(1)}</strong>
                            <span>{description}</span>
                          </button>
                        ))}
                      </div>

                      {requiresDamageDecision && (
                        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className={`admin-pill-btn ${returnDamageMode === 'tier' ? 'active' : ''}`}
                              style={{ fontSize: '11px', padding: '3px 8px' }}
                              onClick={() => setReturnDamageMode('tier')}
                            >
                              Standard Tier
                            </button>
                            <button
                              type="button"
                              className={`admin-pill-btn ${returnDamageMode === 'custom' ? 'active' : ''}`}
                              style={{ fontSize: '11px', padding: '3px 8px' }}
                              onClick={() => setReturnDamageMode('custom')}
                            >
                              Custom Amount
                            </button>
                          </div>

                          {returnDamageMode === 'tier' ? (
                            <label className="admin-damage-tier-control">
                              <span>Damage fee tier (required)</span>
                              <select
                                value={returnDamageTier ?? ''}
                                onChange={(e) => {
                                  const nextTier = e.target.value === '' ? null : Number(e.target.value)
                                  setReturnDamageTier(nextTier)
                                  if (nextTier !== null && nextTier >= 30 && returnNextStatus === 'available') {
                                    setReturnNextStatus('damaged')
                                  }
                                }}
                              >
                                <option value="">Select damage tier</option>
                                {!['damaged'].includes(returnCondition) && <option value="0">No fee (0%)</option>}
                                <option value="10">Minor (10% · {Math.round(replacementPrice * 0.1).toLocaleString('vi-VN')}đ)</option>
                                <option value="30">Major (30% · {Math.round(replacementPrice * 0.3).toLocaleString('vi-VN')}đ)</option>
                                <option value="100">Unusable (100% · {replacementPrice.toLocaleString('vi-VN')}đ)</option>
                              </select>
                            </label>
                          ) : (
                            <label className="admin-damage-tier-control">
                              <span>Custom damage fee (VND{replacementPrice > 0 ? `, max ${replacementPrice.toLocaleString('vi-VN')}đ` : ''})</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder="Enter custom fee amount..."
                                value={returnCustomDamage}
                                onChange={(e) => setReturnCustomDamage(e.target.value.replace(/\D/g, ''))}
                                style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #dcd3c5' }}
                              />
                            </label>
                          )}
                        </div>
                      )}

                      {/* Destination Copy Status (UC-21 §2.1 & §2.2.2) */}
                      <label className="admin-damage-tier-control" style={{ marginTop: '8px' }}>
                        <span>Post-return copy routing</span>
                        <select
                          value={returnNextStatus}
                          onChange={(e) => setReturnNextStatus(e.target.value)}
                        >
                          <option value="available" disabled={returnCondition === 'damaged'}>
                            Available (return to shelf / promote waitlist)
                          </option>
                          <option value="damaged">Damaged (quarantine for archival review)</option>
                          <option value="under_repair">Under Repair (send to bindery)</option>
                        </select>
                      </label>

                      <label className="admin-condition-label" htmlFor="return-condition-notes">
                        Condition In Notes {returnDamageMode === 'custom' && requiresDamageDecision ? '(Required for custom fee)' : ''}
                      </label>
                      <textarea
                        id="return-condition-notes"
                        rows="2"
                        className="admin-return-condition-notes"
                        placeholder="Describe the book's condition at return..."
                        value={returnConditionNotes}
                        onChange={(e) => setReturnConditionNotes(e.target.value)}
                      />

                      <div className="admin-return-evidence">
                        <div className="admin-return-evidence-heading">
                          <span>Upload photo evidence</span>
                          <span>
                            {returnCondition === 'damaged' ? 'Required for Damaged' : 'Optional (up to 3)'}
                          </span>
                        </div>
                        <div className="admin-condition-media-slots">
                          {[0, 1, 2].map((slot) => {
                            const media = returnMedia[slot]
                            return media ? (
                              <div className="admin-condition-media-preview" key={media.id}>
                                <img src={media.preview} alt={`Return evidence ${slot + 1}`} />
                                <button
                                  type="button"
                                  aria-label={`Remove return image ${slot + 1}`}
                                  onClick={() => removeReturnMedia(media.id)}
                                >
                                  ×
                                </button>
                              </div>
                            ) : (
                              <label
                                className="admin-condition-media-upload"
                                key={`return-empty-${slot}`}
                                aria-label={`Upload return image ${slot + 1}`}
                              >
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                  <path d="M4 7h3l1.5-2h7L17 7h3v12H4z" />
                                  <circle cx="12" cy="13" r="3.5" />
                                  <path d="M12 11.5v3M10.5 13h3" />
                                </svg>
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  multiple
                                  onChange={addReturnMedia}
                                />
                              </label>
                            )
                          })}
                        </div>
                        {returnCondition === 'damaged' && returnMedia.length === 0 && (
                          <div className="admin-return-evidence-hint">At least one photo is required for damaged items.</div>
                        )}
                        {returnMediaError && <div className="admin-condition-media-error">{returnMediaError}</div>}
                      </div>
                    </div>

                    {/* Settlement Option (UC-21 §2.2.5) */}
                    <div className="admin-drawer-box">
                      <div className="admin-drawer-box-title">Charges &amp; Settlement Decision</div>
                      <div className="admin-fee-summary-row">
                        <span>Overdue Fine Balance{returnOverdueDays ? ` (${returnOverdueDays}d)` : ''}</span>
                        <strong>{returnFineSubtotal.toLocaleString('vi-VN')}đ</strong>
                      </div>
                      <div className="admin-fee-summary-row">
                        <span>Damage Fee ({returnCondition[0].toUpperCase() + returnCondition.slice(1)})</span>
                        <strong>{projectedDamageAmount.toLocaleString('vi-VN')}đ</strong>
                      </div>
                      <div className="admin-fee-summary-row admin-fee-total">
                        <span>Total Due Now</span>
                        <strong>{totalReturnDueNow.toLocaleString('vi-VN')}đ</strong>
                      </div>

                      {totalReturnDueNow > 0 && (
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #ede6db', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className={`admin-pill-btn ${!returnSettleNow ? 'active' : ''}`}
                              style={{ flex: 1, justifyContent: 'center', fontSize: '11px' }}
                              onClick={() => setReturnSettleNow(false)}
                            >
                              Defer Payment (Debt Hold)
                            </button>
                            <button
                              type="button"
                              className={`admin-pill-btn ${returnSettleNow ? 'active' : ''}`}
                              style={{ flex: 1, justifyContent: 'center', fontSize: '11px' }}
                              onClick={() => {
                                setReturnSettleNow(true)
                                if (!returnAmountCollected) setReturnAmountCollected(String(totalReturnDueNow))
                              }}
                            >
                              Pay Now at Counter
                            </button>
                          </div>

                          {returnSettleNow && (
                            <div style={{ marginTop: '4px' }}>
                              <label className="admin-condition-label" htmlFor="return-amount-collected">
                                Amount Collected at Counter (VND)
                              </label>
                              <input
                                id="return-amount-collected"
                                type="text"
                                inputMode="numeric"
                                value={returnAmountCollected}
                                onChange={(e) => setReturnAmountCollected(e.target.value.replace(/\D/g, ''))}
                                placeholder={String(totalReturnDueNow)}
                                style={{
                                  width: '100%',
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #dcd3c5',
                                  fontWeight: 600,
                                  boxSizing: 'border-box',
                                }}
                              />
                              {Number(returnAmountCollected || 0) >= totalReturnDueNow ? (
                                <div style={{ marginTop: '4px', fontSize: '12px', color: '#166534', fontWeight: 600 }}>
                                  Change: {(Number(returnAmountCollected || 0) - totalReturnDueNow).toLocaleString('vi-VN')}đ
                                </div>
                              ) : (
                                <div style={{ marginTop: '4px', fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>
                                  Enter at least {totalReturnDueNow.toLocaleString('vi-VN')}đ to settle now.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Submit Return & Mark as Lost (FR-CIRC-05) */}
                    <div style={{ borderTop: '1px solid #ede6db', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button
                        type="button"
                        className="admin-btn-primary"
                        style={{ width: '100%', justifyContent: 'center', height: '40px' }}
                        disabled={returnSubmitDisabled}
                        onClick={handleConfirmReturn}
                      >
                        <IconCheck size={16} />
                        {actionLoading
                          ? 'Processing...'
                          : isLostRecoveryItem
                            ? 'Confirm Path A Lost Recovery'
                            : returnSettleNow && totalReturnDueNow > 0
                              ? 'Confirm Settlement & Return'
                              : 'Confirm Return & Check-In'}
                      </button>

                      {['borrowed', 'overdue'].includes(selectedItem?.status) && (
                        <button
                          type="button"
                          className="admin-btn-outline"
                          disabled={actionLoading}
                          style={{
                            width: '100%',
                            justifyContent: 'center',
                            borderColor: '#dc2626',
                            color: '#dc2626',
                            background: '#fff5f5',
                          }}
                          onClick={() => {
                            setLostReason('')
                            setLostError(null)
                            setShowLostModal(true)
                          }}
                        >
                          <IconAlertTriangle size={14} /> Mark Loan as Lost (FR-CIRC-05)
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ===================================================================== */}
      {/* VIEW 2: COUNTER PAYMENTS (FR-CIRC-07)                                 */}
      {/* ===================================================================== */}
      {mainTab === 'counter-payments' && (
        <>
          <div className="admin-filter-tabs admin-payment-filters">
            {[
              ['all', 'All', unpaidChargesCount],
              ['overdue', 'Overdue Fines', charges.filter((c) => c.status === 'unpaid' && c.type === 'overdue_fine').length],
              ['damage', 'Damage & Loss Fees', charges.filter((c) => c.status === 'unpaid' && ['damage_fee', 'loss_fee'].includes(c.type)).length],
              ['checkout', 'Loan Checkout', charges.filter((c) => c.status === 'unpaid' && c.type === 'borrow_fee').length],
              ['others', 'Others', charges.filter((c) => c.status === 'unpaid' && !['overdue_fine', 'damage_fee', 'loss_fee', 'borrow_fee'].includes(c.type)).length],
            ].map(([filter, label, count]) => (
              <button
                key={filter}
                type="button"
                className={`admin-pill-btn ${paymentFilter === filter ? 'active' : ''}`}
                onClick={() => { setPaymentFilter(filter); setPaymentPage(1) }}
              >
                {label}<span className="admin-pill-count">{count}</span>
              </button>
            ))}
          </div>

          <div className={`admin-work-layout ${selectedCharge ? '' : 'admin-work-layout-single'}`}>
            <div className="admin-table-container">
              <div className="admin-table-toolbar">
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#72685e' }}>
                  Outstanding charges ({visibleCharges.length})
                </span>
                <button type="button" className="admin-btn-icon" aria-label="Refresh charges" onClick={loadData}>
                  <IconRefresh size={13} />
                </button>
              </div>

              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Student Name &amp; ID</th>
                    <th>Transaction Reason</th>
                    <th>Associated Item / Code</th>
                    <th>Amount</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentPageItems.map((chg) => {
                    const isSelected = selectedCharge?.id === chg.id
                    return (
                      <tr
                        key={chg.id}
                        className={isSelected ? 'selected' : ''}
                        onClick={() => {
                          if (selectedCharge?.id !== chg.id) {
                            setPaymentAmountCollected('')
                            setPaymentNotes('')
                          }
                          setSelectedCharge(chg)
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <div style={{ fontWeight: 600 }}>{chg.profiles?.full_name || 'Student'}</div>
                          <div style={{ fontSize: '12px', color: '#72685e' }}>
                            ID: {chg.profiles?.student_id || 'N/A'}
                          </div>
                        </td>

                        <td>
                          <div style={{ fontWeight: 600, color: chg.type === 'overdue_fine' ? '#dc2626' : '#241e19', textTransform: 'capitalize' }}>
                            {chg.type.replaceAll('_', ' ')}
                          </div>
                          <div style={{ fontSize: '12px', color: '#72685e' }}>{chg.notes || 'Counter charge'}</div>
                        </td>

                        <td>
                          <div style={{ fontWeight: 600 }}>{chg.loan_items?.books?.title || '—'}</div>
                          <div style={{ fontSize: '11px', color: '#72685e' }}>{chg.loan_items?.id?.slice(0, 8) || 'Counter charge'}</div>
                        </td>

                        <td>
                          <span style={{ fontWeight: 700, color: chg.type === 'overdue_fine' ? '#dc2626' : '#241e19' }}>
                            {Number(chg.amount).toLocaleString('vi-VN')}đ
                          </span>
                        </td>

                        <td>
                          <div>{new Date(chg.created_at).toLocaleDateString('vi-VN')}</div>
                          <div style={{ fontSize: '11px', color: '#dc2626' }}>{chg.status === 'unpaid' ? 'Outstanding' : 'Paid'}</div>
                        </td>
                      </tr>
                    )
                  })}

                  {visibleCharges.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: '#72685e' }}>
                        No unpaid charges match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="admin-pagination-footer">
                <span>Showing {paymentRangeStart}–{paymentRangeEnd} of {visibleCharges.length} records · {pageSize} per page</span>
                <div className="admin-pagination-controls">
                  <button
                    type="button"
                    aria-label="Previous page"
                    disabled={activePaymentPage === 1}
                    onClick={() => setPaymentPage((page) => Math.max(1, page - 1))}
                  >
                    ‹
                  </button>
                  {Array.from({ length: paymentPageCount }, (_, index) => index + 1).map((page) => (
                    <button
                      type="button"
                      key={page}
                      className={page === activePaymentPage ? 'active' : ''}
                      aria-current={page === activePaymentPage ? 'page' : undefined}
                      onClick={() => setPaymentPage(page)}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-label="Next page"
                    disabled={activePaymentPage === paymentPageCount}
                    onClick={() => setPaymentPage((page) => Math.min(paymentPageCount, page + 1))}
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>

            {selectedCharge && (
              <div className="admin-drawer admin-counter-inspector">
                <div className="admin-counter-inspector-title">Desk Settlement Inspector</div>

                <div className="admin-payment-patron">
                  <div className="admin-payment-avatar">
                    {selectedCharge.profiles?.full_name?.slice(0, 2).toUpperCase() || 'ST'}
                  </div>
                  <div>
                    <strong>{selectedCharge.profiles?.full_name || 'Student'}</strong>
                    <span>ID: {selectedCharge.profiles?.student_id || 'N/A'}</span>
                  </div>
                </div>

                <div className="admin-drawer-box admin-counter-section">
                  <div className="admin-counter-section-title">Transaction Summary</div>
                  <div className="admin-transaction-summary admin-counter-transaction">
                    <div>
                      <strong style={{ textTransform: 'capitalize' }}>
                        {selectedCharge.type.replaceAll('_', ' ')}
                      </strong>
                      <span>{selectedCharge.notes || selectedCharge.loan_items?.books?.title || 'Counter charge'}</span>
                    </div>
                    <strong>{Number(selectedCharge.amount).toLocaleString('vi-VN')}đ</strong>
                  </div>
                </div>

                {selectedCharge.status === 'paid' ? (
                  <div
                    style={{
                      padding: '16px',
                      background: '#dcfce7',
                      color: '#166534',
                      borderRadius: '8px',
                      fontWeight: 600,
                      textAlign: 'center',
                    }}
                  >
                    ✓ This charge has been paid in full.
                  </div>
                ) : (
                  <>
                    <div className="admin-drawer-box admin-counter-section">
                      <div className="admin-counter-section-title">Payment Amount</div>
                      <label className="admin-counter-label" htmlFor="counter-payment-amount">Amount Collected (VND)</label>
                      <div className="admin-counter-amount-field">
                        <input
                          id="counter-payment-amount"
                          type="text"
                          inputMode="numeric"
                          placeholder="Enter amount collected"
                          value={
                            paymentAmountFocused || !paymentAmountCollected
                              ? paymentAmountCollected
                              : Number(paymentAmountCollected).toLocaleString('vi-VN')
                          }
                          onFocus={() => setPaymentAmountFocused(true)}
                          onBlur={() => setPaymentAmountFocused(false)}
                          onChange={(e) => setPaymentAmountCollected(e.target.value.replace(/\D/g, ''))}
                        />
                        <span>đ</span>
                      </div>
                    </div>

                    {Number(paymentAmountCollected) >= selectedCharge.amount && (
                      <div className="admin-change-box admin-counter-change">
                        <div className="admin-counter-label">Change (VND)</div>
                        <div className="admin-counter-change-value">
                          <span>{(Number(paymentAmountCollected) - selectedCharge.amount).toLocaleString('vi-VN')}</span>
                          <span>đ</span>
                        </div>
                      </div>
                    )}

                    <div className="admin-counter-note">
                      <label className="admin-counter-label" htmlFor="counter-payment-note">Optional Note</label>
                      <textarea
                        id="counter-payment-note"
                        rows="2"
                        placeholder="Add a note for this settlement..."
                        value={paymentNotes}
                        onChange={(e) => setPaymentNotes(e.target.value)}
                      />
                    </div>

                    <button
                      type="button"
                      className="admin-btn-primary admin-counter-confirm"
                      disabled={actionLoading}
                      onClick={handleSettlePayment}
                    >
                      {actionLoading ? 'Processing...' : 'Confirm Settlement'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Mark as Lost Confirmation Modal (FR-CIRC-05) */}
      {showLostModal && selectedItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Mark Loan as Lost"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => !actionLoading && setShowLostModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '22px',
              width: '460px',
              maxWidth: '92vw',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', color: '#dc2626' }}>
              Mark Loan &amp; Copy as Lost
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#52473f' }}>
              Declaring <strong>{selectedItem.books?.title}</strong> ({selectedItem.copies?.barcode}) as lost for{' '}
              <strong>{selectedItem.profiles?.full_name}</strong> will apply these consequences:
            </p>
            <ul style={{ margin: '0 0 14px', paddingLeft: '18px', fontSize: '13px', color: '#7f1d1d', lineHeight: 1.5 }}>
              <li>Loan item &amp; physical copy status will transition to <strong>Lost</strong>.</li>
              <li>Student account will be set to <strong>Restricted</strong>.</li>
              <li>
                An unpaid <code>loss_fee</code> charge of{' '}
                <strong>{replacementPrice.toLocaleString('vi-VN')}đ</strong> will be added to the student&apos;s balance.
              </li>
            </ul>

            {lostError && (
              <div style={{ marginBottom: '10px', padding: '8px 10px', borderRadius: '6px', background: '#fee2e2', color: '#991b1b', fontSize: '12px', fontWeight: 600 }}>
                {lostError}
              </div>
            )}

            <label htmlFor="mark-lost-reason" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
              Mandatory reason *
            </label>
            <textarea
              id="mark-lost-reason"
              rows="3"
              placeholder="e.g. Patron reported book lost during transit..."
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid #dcd3c5',
                fontSize: '13px',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                marginBottom: '14px',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="admin-btn-outline"
                disabled={actionLoading}
                onClick={() => setShowLostModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmMarkLost}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 14px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                {actionLoading ? 'Recording...' : 'Confirm Mark as Lost'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
