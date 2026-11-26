import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { api } from '../../../lib/api'
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

export function CirculationPage() {
  const [mainTab, setMainTab] = useState('handover-return') // 'handover-return' | 'counter-payments'
  const [drawerMode, setDrawerMode] = useState('handover') // 'handover' | 'return'
  const [filterPill, setFilterPill] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [sortAscending, setSortAscending] = useState(true)
  const [handoverPage, setHandoverPage] = useState(1)
  const [paymentPage, setPaymentPage] = useState(1)
  const [today] = useState(() => new Date())
  const pageSize = 6

  // Search input
  const [barcodeSearch, setBarcodeSearch] = useState('')

  // Data states
  const [loanItems, setLoanItems] = useState([])
  const [charges, setCharges] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [selectedCharge, setSelectedCharge] = useState(null)

  // Inspection states (Handover)
  const [handoverCondition, setHandoverCondition] = useState('good')
  const [handoverNotes, setHandoverNotes] = useState('Pages clean and binding solid.')
  const [handoverMedia, setHandoverMedia] = useState([])
  const [handoverMediaError, setHandoverMediaError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionFeedback, setActionFeedback] = useState(null)

  // Inspection states (Return)
  const [returnBarcode, setReturnBarcode] = useState('')
  const [returnCondition, setReturnCondition] = useState('good')
  const [returnDamageTier, setReturnDamageTier] = useState(0) // 0, 10, 30, 100%
  const [returnConditionNotes, setReturnConditionNotes] = useState('')
  const [returnMedia, setReturnMedia] = useState([])
  const [returnMediaError, setReturnMediaError] = useState('')

  // Counter Payment state
  const [paymentAmountCollected, setPaymentAmountCollected] = useState('')
  const [paymentAmountFocused, setPaymentAmountFocused] = useState(false)
  const [paymentNotes, setPaymentNotes] = useState('')

  // Fetch loans and charges
  const loadData = useCallback(async () => {
    try {
      // 1. Fetch loan items with relations
      const { data: items, error: itemsErr } = await supabase
        .from('loan_items')
        .select(`
          id, status, is_premium, fee, duration_days, pickup_deadline, handover_at, due_at, returned_at,
          condition_out, condition_out_media, condition_in, condition_in_notes, condition_in_media, notes, created_at,
          books ( id, title, authors, replacement_price, shelf_location, isbn13 ),
          copies ( id, barcode, status, shelf_location, condition ),
          profiles ( id, full_name, student_id, email, debt_outstanding, active_items, status )
        `)
        .order('created_at', { ascending: false })

      if (itemsErr) console.error('Error fetching loan items:', itemsErr)
      else {
        setLoanItems(items || [])
        setSelectedItem((prev) => items?.find((item) => item.id === prev?.id) || null)
      }

      // 2. Fetch charges
      const { data: chgData, error: chgErr } = await supabase
        .from('charges')
        .select(`
          id, type, amount, status, rate, frozen, paid_at, notes, created_at,
          profiles ( id, full_name, student_id, email, debt_outstanding ),
          loan_items ( id, due_at, books ( title ) )
        `)
        .order('created_at', { ascending: false })

      if (chgErr) console.error('Error fetching charges:', chgErr)
      else {
        setCharges(chgData || [])
        setSelectedCharge((prev) => chgData?.find((charge) => charge.id === prev?.id) || null)
      }
    } catch (err) {
      console.error(err)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // KPI Calculations
  const readyCount = loanItems.filter((i) => i.status === 'ready_for_pickup').length
  const awaitingPaymentCount = loanItems.filter((i) => i.status === 'awaiting_payment').length
  const onLoanCount = loanItems.filter((i) => i.status === 'borrowed').length
  const overdueCount = loanItems.filter((i) => i.status === 'overdue').length
  const dueTodayCount = loanItems.filter((i) => {
    if (i.status !== 'borrowed' || !i.due_at) return false
    return new Date(i.due_at).toDateString() === today.toDateString()
  }).length
  const unpaidChargesCount = charges.filter((c) => c.status === 'unpaid').length

  // Filtered loan list
  const filteredItems = loanItems.filter((item) => {
    const matchesStatus = {
      all: () => true,
      ready: () => item.status === 'ready_for_pickup',
      awaiting_payment: () => item.status === 'awaiting_payment',
      on_loan: () => item.status === 'borrowed',
      overdue: () => item.status === 'overdue',
      lost: () => item.status === 'lost',
      history: () => item.status === 'returned',
    }[filterPill]?.() ?? true
    if (!matchesStatus) return false

    const query = barcodeSearch.trim().toLowerCase()
    if (!query) return true
    const searchableFields = [
      item.copies?.barcode,
      item.books?.title,
      item.profiles?.student_id,
      item.profiles?.full_name,
    ]
    return searchableFields.some((value) => value?.toLowerCase().includes(query))
  }).sort((a, b) => {
    const deadlineA = new Date(a.due_at || a.pickup_deadline || a.created_at).getTime()
    const deadlineB = new Date(b.due_at || b.pickup_deadline || b.created_at).getTime()
    return sortAscending ? deadlineA - deadlineB : deadlineB - deadlineA
  })

  const filteredCharges = charges.filter((charge) => {
    if (charge.status !== 'unpaid') return false
    if (paymentFilter === 'all') return true
    if (paymentFilter === 'overdue') return charge.type === 'overdue_fine'
    if (paymentFilter === 'damage') return ['damage_fee', 'loss_fee'].includes(charge.type)
    if (paymentFilter === 'membership') return charge.type === 'membership_fee'
    if (paymentFilter === 'checkout') return charge.type === 'borrow_fee'
    return !['overdue_fine', 'damage_fee', 'loss_fee', 'membership_fee', 'borrow_fee'].includes(charge.type)
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
    return (Number(item.fee) || 0) + chargeTotal
  }

  const selectedItemCharges = charges.filter((charge) => charge.loan_items?.id === selectedItem?.id)
  const returnFineAmount = selectedItemCharges
    .filter((charge) => charge.type === 'overdue_fine')
    .reduce((sum, charge) => sum + (Number(charge.amount) || 0), 0)
  const returnDamageAmount = selectedItemCharges
    .filter((charge) => ['damage_fee', 'loss_fee'].includes(charge.type))
    .reduce((sum, charge) => sum + (Number(charge.amount) || 0), 0)
  const returnOverdueDays = selectedItem?.due_at && selectedItem.status === 'overdue'
    ? Math.max(1, Math.ceil((today.getTime() - new Date(selectedItem.due_at).getTime()) / 86400000))
    : 0
  const calculatedReturnFine = returnOverdueDays * 5000
  const returnFineSubtotal = Math.max(returnFineAmount, calculatedReturnFine)
  const projectedDamageAmount = Math.round(
    ((Number(selectedItem?.books?.replacement_price) || 0) * Number(returnDamageTier)) / 100
  )
  const selectedItemBarcode = ['borrowed', 'overdue'].includes(selectedItem?.status)
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

  const selectLoanItem = (item) => {
    if (selectedItem?.id !== item.id) {
      clearHandoverMedia()
      clearReturnMedia()
    }
    setSelectedItem(item)
    if (item.status === 'borrowed' || item.status === 'overdue') {
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

    if (rejectedCount > 0) {
      setHandoverMediaError('Chọn tối đa 3 ảnh JPG, PNG hoặc WebP; mỗi ảnh không quá 10 MB.')
    } else {
      setHandoverMediaError('')
    }

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
        ? 'Chọn tối đa 3 ảnh JPG, PNG hoặc WebP; mỗi ảnh không quá 10 MB.'
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

  const exportRows = (rows) => {
    const columns = ['Borrower', 'Student ID', 'Book', 'Barcode', 'Status', 'Amount', 'Due']
    const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const csv = [
      columns,
      ...rows.map((item) => [
        item.profiles?.full_name,
        item.profiles?.student_id,
        item.books?.title,
        item.copies?.barcode,
        item.status,
        getItemOutstanding(item),
        item.due_at || item.pickup_deadline,
      ]),
    ].map((row) => row.map(csvCell).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'circulation-records.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  // Handle Handover Confirmation (Calls Edge Function handover-items)
  const handleConfirmHandover = async () => {
    if (!selectedItem) return
    setActionLoading(true)
    setActionFeedback(null)
    const uploadedPaths = []
    let uploadsComplete = false

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

        if (uploadError) throw new Error(`Không thể tải ảnh ${media.file.name}: ${uploadError.message}`)
        uploadedPaths.push(path)
      }
      uploadsComplete = true

      const res = await api.invoke('handover-items', {
        loan_item_id: selectedItem.id,
        condition_out: handoverCondition,
        notes: handoverNotes,
        condition_out_media: uploadedPaths,
      })

      setActionFeedback({ type: 'success', message: res.message || 'Xuất mượn thành công! Đã chuyển sách sang trạng thái Borrowed.' })
      clearHandoverMedia()
      await loadData()
    } catch (err) {
      if (!uploadsComplete && uploadedPaths.length) {
        const { error: cleanupError } = await supabase.storage.from('evidence').remove(uploadedPaths)
        if (cleanupError) console.error('Could not remove partial handover media uploads:', cleanupError)
      }
      setActionFeedback({ type: 'error', message: err.message })
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Return Confirmation (Calls Edge Function return-loan)
  const handleConfirmReturn = async () => {
    const targetBarcode = returnBarcode.trim() || selectedItemBarcode
    if (!targetBarcode) {
      setActionFeedback({ type: 'error', message: 'Vui lòng nhập hoặc quét mã barcode cuốn sách cần trả.' })
      return
    }
    if (returnCondition === 'damaged' && returnMedia.length === 0) {
      setActionFeedback({ type: 'error', message: 'Vui lòng tải lên ít nhất một ảnh chứng cứ cho sách bị hư hỏng.' })
      return
    }
    if (['poor', 'damaged'].includes(returnCondition) && returnDamageTier === null) {
      setActionFeedback({ type: 'error', message: 'Vui lòng chọn mức phí hư hỏng trước khi xác nhận trả sách.' })
      return
    }
    if (returnMedia.length && selectedItem?.copies?.barcode !== targetBarcode) {
      setActionFeedback({ type: 'error', message: 'Chọn hồ sơ khoản mượn tương ứng trước khi tải ảnh chứng cứ lên.' })
      return
    }

    setActionLoading(true)
    setActionFeedback(null)
    const uploadedPaths = []
    let uploadsComplete = false

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

        if (uploadError) throw new Error(`Không thể tải ảnh ${media.file.name}: ${uploadError.message}`)
        uploadedPaths.push(path)
      }
      uploadsComplete = true

      const res = await api.invoke('return-loan', {
        copy_barcode: targetBarcode,
        condition_in: returnCondition,
        damage_tier: Number(returnDamageTier),
        condition_in_notes: returnConditionNotes,
        condition_in_media: uploadedPaths,
        settle_now: false,
        amount_collected: 0,
      })

      const data = res.data
      let msg = res.message || `Nhận trả sách thành công! Trạng thái bản sao: ${data?.copy_status}.`
      if (data && data.total_fee > 0) {
        msg += ` Tổng phí phạt: ${data.total_fee.toLocaleString()}đ (${data.settled ? 'Đã thu tiền tại quầy, Mã biên lai: ' + data.receipt_number : 'Đã ghi nợ vào tài khoản SV'}).`
      }
      setActionFeedback({ type: 'success', message: msg })
      setReturnBarcode('')
      setReturnConditionNotes('')
      clearReturnMedia()
      await loadData()
    } catch (err) {
      if (!uploadsComplete && uploadedPaths.length) {
        const { error: cleanupError } = await supabase.storage.from('evidence').remove(uploadedPaths)
        if (cleanupError) console.error('Could not remove partial return media uploads:', cleanupError)
      }
      setActionFeedback({ type: 'error', message: err.message })
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Settle Counter Payment (Calls Edge Function record-counter-payment)
  const handleSettlePayment = async () => {
    if (!selectedCharge) return
    const collected = Number(paymentAmountCollected)
    if (!collected || collected < selectedCharge.amount) {
      setActionFeedback({
        type: 'error',
        message: `Số tiền thu (${collected.toLocaleString()}đ) không được nhỏ hơn khoản phải trả (${selectedCharge.amount.toLocaleString()}đ).`,
      })
      return
    }

    setActionLoading(true)
    setActionFeedback(null)

    try {
      const res = await api.invoke('record-counter-payment', {
        charge_id: selectedCharge.id,
        amount_collected: collected,
        notes: paymentNotes || 'Thu tiền tại quầy lưu thông',
      })

      const data = res.data
      setActionFeedback({
        type: 'success',
        message: res.message || `Thu tiền thành công! Biên lai: ${data?.receipt_number}. Tiền thối lại: ${data?.change?.toLocaleString()}đ.`,
      })
      setPaymentAmountCollected('')
      await loadData()
    } catch (err) {
      setActionFeedback({ type: 'error', message: err.message })
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="admin-circulation-page">
      {/* Top Header & Navigation Tabs */}
      <div className="admin-page-title-row">
        <div>
          <h1 className="admin-page-title">Circulation Desk</h1>
          <div className="admin-page-desc">
            Real-time loan checkout, pickup handovers, returns verification, and condition auditing
          </div>
        </div>

        {/* Tab Selector */}
        <div className="admin-drawer-tabs" style={{ width: '320px' }}>
          <button
            type="button"
            className={`admin-drawer-tab-btn ${mainTab === 'handover-return' ? 'active' : ''}`}
            onClick={() => {
              setMainTab('handover-return')
              setActionFeedback(null)
            }}
          >
            <IconReturn size={13} /> Handover & Return
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

      {/* Barcode Search Bar */}
      <div className="admin-search-bar-wrap">
        <div className="admin-barcode-input">
          <span className="admin-barcode-icon"><IconBarcode size={15} color="#6e472a" /></span>
          <input
            type="text"
            placeholder="Scan or enter copy barcode / student ID..."
            value={barcodeSearch}
            onChange={(e) => updateBarcodeSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') loadData()
            }}
          />
        </div>
        <button type="button" className="admin-btn-primary" onClick={() => loadData()}>
          <IconSearch size={13} />
          Lookup
        </button>
        <button type="button" className="admin-btn-outline" onClick={() => exportRows(filteredItems)}>
          <IconDownload size={13} />
          Batch Export
        </button>
      </div>

      {/* Alert banner if feedback */}
      {actionFeedback && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: actionFeedback.type === 'error' ? '#fee2e2' : '#dcfce7',
            color: actionFeedback.type === 'error' ? '#991b1b' : '#166534',
            fontWeight: 600,
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{actionFeedback.message}</span>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 700 }}
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
          {/* Filter Pills */}
          <div className="admin-filter-tabs">
            <button
              type="button"
              className={`admin-pill-btn ${filterPill === 'all' ? 'active' : ''}`}
              onClick={() => { setFilterPill('all'); setHandoverPage(1) }}
            >
              All <span className="admin-pill-count">{loanItems.length}</span>
            </button>
            <button
              type="button"
              className={`admin-pill-btn ${filterPill === 'awaiting_payment' ? 'active' : ''}`}
              onClick={() => { setFilterPill('awaiting_payment'); setHandoverPage(1) }}
            >
              Awaiting payment <span className="admin-pill-count">{awaitingPaymentCount}</span>
            </button>
            <button
              type="button"
              className={`admin-pill-btn ${filterPill === 'ready' ? 'active' : ''}`}
              onClick={() => { setFilterPill('ready'); setHandoverPage(1) }}
            >
              Ready for pickup <span className="admin-pill-count">{readyCount}</span>
            </button>
            <button
              type="button"
              className={`admin-pill-btn ${filterPill === 'on_loan' ? 'active' : ''}`}
              onClick={() => { setFilterPill('on_loan'); setHandoverPage(1) }}
            >
              On loan <span className="admin-pill-count">{onLoanCount}</span>
            </button>
            <button
              type="button"
              className={`admin-pill-btn ${filterPill === 'overdue' ? 'active' : ''}`}
              onClick={() => { setFilterPill('overdue'); setHandoverPage(1) }}
            >
              Overdue <span className="admin-pill-count">{overdueCount}</span>
            </button>
            <button
              type="button"
              className={`admin-pill-btn ${filterPill === 'lost' ? 'active' : ''}`}
              onClick={() => { setFilterPill('lost'); setHandoverPage(1) }}
            >
              Lost <span className="admin-pill-count">{loanItems.filter((i) => i.status === 'lost').length}</span>
            </button>
            <button
              type="button"
              className={`admin-pill-btn ${filterPill === 'history' ? 'active' : ''}`}
              onClick={() => { setFilterPill('history'); setHandoverPage(1) }}
            >
              History <span className="admin-pill-count">{loanItems.filter((i) => i.status === 'returned').length}</span>
            </button>
          </div>

          {/* Work Layout: Table + Inspection Drawer */}
          <div className={`admin-work-layout ${selectedItem ? '' : 'admin-work-layout-single'}`}>
            {/* Left: Table */}
            <div className="admin-table-container">
              <div className="admin-table-toolbar admin-circulation-table-toolbar">
                <button type="button" className="admin-btn-outline admin-table-sort" onClick={() => setSortAscending((current) => !current)}>
                  <IconSort size={12} /> Sort: Deadline
                </button>
                <button type="button" className="admin-btn-icon" aria-label="Refresh records" onClick={loadData}>
                  <IconRefresh size={13} />
                </button>
              </div>

              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Borrower & Student ID</th>
                    <th>Book Title & Shelf</th>
                    <th>Barcode</th>
                    <th>Deadline / Due</th>
                    <th>Fee / Fine</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {handoverPageItems.map((item) => {
                    const isSelected = selectedItem?.id === item.id
                    return (
                      <tr
                        key={item.id}
                        className={isSelected ? 'selected' : ''}
                        onClick={() => selectLoanItem(item)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <div style={{ fontWeight: 600, color: '#241e19' }}>
                            {item.profiles?.full_name || 'Sinh viên'}
                          </div>
                          <div style={{ fontSize: '13px', color: '#72685e' }}>
                            {item.profiles?.student_id || 'Chưa cập nhật'}
                            {item.profiles?.debt_outstanding > 0 && (
                              <span style={{ color: '#dc2626', marginLeft: '6px', fontWeight: 600 }}>
                                (Nợ {item.profiles.debt_outstanding.toLocaleString()}đ)
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          <div style={{ fontWeight: 600 }}>{item.books?.title}</div>
                          <div style={{ fontSize: '13px', color: '#9d9388' }}>
                            {item.copies?.shelf_location || item.books?.shelf_location || 'Kệ chính'}
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
                            }}
                          >
                            {item.copies?.barcode || 'N/A'}
                          </span>
                        </td>

                        <td>
                          {item.status === 'ready_for_pickup' && (
                            <span style={{ color: '#92400e', fontSize: '14px' }}>
                              Hạn nhận: {item.pickup_deadline ? new Date(item.pickup_deadline).toLocaleDateString() : '24h'}
                            </span>
                          )}
                          {item.status === 'borrowed' && (
                            <span style={{ color: '#166534', fontSize: '14px' }}>
                              Hạn trả: {item.due_at ? new Date(item.due_at).toLocaleDateString() : '14 ngày'}
                            </span>
                          )}
                          {item.status === 'overdue' && (
                            <span style={{ color: '#dc2626', fontSize: '14px', fontWeight: 600 }}>
                              Trễ: {item.due_at ? new Date(item.due_at).toLocaleDateString() : 'Quá hạn'}
                            </span>
                          )}
                          {item.status === 'returned' && (
                            <span style={{ color: '#72685e', fontSize: '14px' }}>
                              Đã trả: {item.returned_at ? new Date(item.returned_at).toLocaleDateString() : 'Hoàn tất'}
                            </span>
                          )}
                        </td>

                        <td>
                          <span style={{ color: getItemOutstanding(item) > 0 ? '#dc2626' : '#72685e', fontWeight: 600 }}>
                            {getItemOutstanding(item).toLocaleString('vi-VN')}đ
                          </span>
                        </td>

                        <td>
                          {item.status === 'ready_for_pickup' && (
                            <span className="admin-badge admin-badge-ready">Ready for Pickup</span>
                          )}
                          {item.status === 'borrowed' && (
                            <span className="admin-badge admin-badge-borrowed">On Loan</span>
                          )}
                          {item.status === 'overdue' && (
                            <span className="admin-badge admin-badge-overdue">Overdue</span>
                          )}
                          {item.status === 'returned' && (
                            <span className="admin-badge admin-badge-gray">Returned</span>
                          )}
                        </td>

                        <td>
                          <button
                            type="button"
                            className="admin-btn-outline"
                            style={{ padding: '4px 10px', fontSize: '13px' }}
                            onClick={(e) => {
                              e.stopPropagation()
                              selectLoanItem(item)
                              if (item.status === 'borrowed' || item.status === 'overdue') {
                                setDrawerMode('return')
                                setReturnBarcode(item.copies?.barcode || '')
                              } else {
                                setDrawerMode('handover')
                              }
                            }}
                          >
                            {item.status === 'ready_for_pickup' ? 'Inspect Handover' : 'Inspect'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}

                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#72685e' }}>
                        Không có yêu cầu nào phù hợp bộ lọc.
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
              {/* Drawer Mode Switcher: Handover vs Return */}
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
                      ['borrowed', 'overdue'].includes(selectedItem?.status)
                        ? selectedItem.copies?.barcode || ''
                        : ''
                    )
                  }}
                >
                  <IconReturn size={13} /> Return
                </button>
                </div>

              {/* ------------------------------------------------------------- */}
              {/* DRAWER VIEW A: HANDOVER (UC-20)                                */}
              {/* ------------------------------------------------------------- */}
              {drawerMode === 'handover' && (
                <>
                  {selectedItem ? (
                    <>
                      <div className="admin-patron-heading">
                        <div style={{ fontSize: '19px', fontWeight: 700, color: '#241e19' }}>
                          {selectedItem.profiles?.full_name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#72685e' }}>
                          {selectedItem.profiles?.student_id || 'No student ID'} ·{' '}
                          <span style={{ fontWeight: 600, color: selectedItem.profiles?.status === 'active' ? '#166534' : '#dc2626' }}>
                            {selectedItem.profiles?.status === 'active' ? 'ACTIVE' : selectedItem.profiles?.status?.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Patron Standing */}
                      <div className="admin-drawer-box">
                        <div className="admin-drawer-box-title">Patron Standing</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                          <span style={{ color: '#72685e' }}>Outstanding Debt:</span>
                          <span
                            style={{
                              fontWeight: 700,
                              color: selectedItem.profiles?.debt_outstanding > 0 ? '#dc2626' : '#166534',
                            }}
                          >
                            {selectedItem.profiles?.debt_outstanding > 0
                              ? `${selectedItem.profiles.debt_outstanding.toLocaleString()}đ (Blocked)`
                              : '0đ (Clean)'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: '#72685e' }}>Loan Quota:</span>
                          <span style={{ fontWeight: 600 }}>
                            {selectedItem.profiles?.active_items || 0} of 5 books on loan
                          </span>
                        </div>
                        <div className="admin-loan-quota-track">
                          <span style={{ width: `${Math.min(100, ((selectedItem.profiles?.active_items || 0) / 5) * 100)}%` }} />
                        </div>
                      </div>

                      {/* Physical Copy Verification */}
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
                              Barcode: {selectedItem.copies?.barcode || 'N/A'}
                            </div>
                          </div>
                        </div>
                        <div className="admin-loan-period">
                          <span>Loan period ({selectedItem.duration_days || 14} days)</span>
                          <strong>{selectedItem.due_at ? `Return due ${new Date(selectedItem.due_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}` : 'Due date set at handover'}</strong>
                        </div>
                      </div>

                      {/* Condition Assessment (Out) */}
                      <div className="admin-condition-section">
                        <div className="admin-condition-heading">
                          <div className="admin-drawer-box-title">Condition Assessment (OUT)</div>
                          <span>Audit stamp: JH-ID-01</span>
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
                            marginTop: '8px',
                            borderRadius: '6px',
                            border: '1px solid #dcd3c5',
                            padding: '8px',
                            fontSize: '14px',
                            boxSizing: 'border-box',
                            fontFamily: 'inherit',
                          }}
                          placeholder="Add notes about the book's condition..."
                          value={handoverNotes}
                          onChange={(e) => setHandoverNotes(e.target.value)}
                        />
                        {selectedItem.status === 'ready_for_pickup' && (
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
                        {selectedItem.status !== 'ready_for_pickup' && (
                          <div style={{ fontSize: '14px', color: '#92400e', marginBottom: '8px', fontWeight: 600 }}>
                            Status mismatch: {selectedItem.status}. Handover requires Ready for Pickup.
                          </div>
                        )}
                        <button
                          type="button"
                          className="admin-btn-primary"
                          style={{ width: '100%', justifyContent: 'center', height: '42px', fontSize: '17px' }}
                          disabled={actionLoading || selectedItem.status !== 'ready_for_pickup'}
                          onClick={handleConfirmHandover}
                        >
                          <IconCheck size={18} />
                          {actionLoading ? 'Đang xử lý...' : 'Confirm Handover & Issue Loan'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div style={{ color: '#72685e', textAlign: 'center', padding: '40px 0' }}>
                      Chọn một yêu cầu mượn bên bảng để kiểm tra.
                    </div>
                  )}
                </>
              )}

              {/* ------------------------------------------------------------- */}
              {/* DRAWER VIEW B: RETURN FLOW (UC-21)                             */}
              {/* ------------------------------------------------------------- */}
              {drawerMode === 'return' && (
                <>
                  <div className="admin-return-title">
                    <div className="admin-return-title-icon"><IconReturn size={16} /></div>
                    <div>
                      <div style={{ fontSize: '17px', fontWeight: 700, color: '#241e19' }}>Process Book Return</div>
                      <div style={{ fontSize: '11px', color: '#72685e' }}>
                        Loan reference: {selectedItem?.id?.slice(0, 10) || 'Scan barcode'}
                      </div>
                    </div>
                    {selectedItem?.status === 'overdue' && (
                      <span className="admin-overdue-chip">OVERDUE · {returnOverdueDays} DAYS</span>
                    )}
                  </div>

                  <div className="admin-drawer-box">
                    <div className="admin-drawer-box-title">Patron &amp; Loan Context</div>
                    <div className="admin-context-grid">
                      <div>
                        <span>Patron</span>
                        <strong>{selectedItem?.profiles?.full_name || 'Scan a copy to identify patron'}</strong>
                        <small>{selectedItem?.profiles?.student_id || 'No student ID'}</small>
                      </div>
                      <div>
                        <span>Item Barcode</span>
                        <strong>{selectedItem?.copies?.barcode || returnBarcode || 'Not scanned'}</strong>
                        <small>{selectedItem?.books?.title || 'Book title'}</small>
                      </div>
                    </div>
                    <div className="admin-context-dates">
                      <span>Borrowed: {selectedItem?.handover_at ? new Date(selectedItem.handover_at).toLocaleDateString('en-US') : '—'}</span>
                      <span>Due: {selectedItem?.due_at ? new Date(selectedItem.due_at).toLocaleDateString('en-US') : '—'}</span>
                    </div>
                  </div>

                  {selectedItem?.status === 'overdue' && (
                    <div className="admin-drawer-box">
                      <div className="admin-drawer-box-title">Overdue Fine Computation</div>
                      <div className="admin-overdue-computation">
                        <div>
                          <strong>{returnOverdueDays} Days Past Due</strong>
                          <span>Fixed rate: 5,000đ / day</span>
                        </div>
                        <strong>{returnFineSubtotal.toLocaleString('vi-VN')}đ</strong>
                      </div>
                    </div>
                  )}

                  {/* Barcode input for return */}
                  <div>
                    <label className="admin-condition-label">
                      Copy Barcode:
                    </label>
                    <input
                      type="text"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #dcd3c5',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        boxSizing: 'border-box',
                        marginTop: '4px',
                      }}
                      placeholder="e.g. 978604000002-01"
                      value={returnBarcode}
                      onChange={(e) => {
                        const value = e.target.value
                        setReturnBarcode(value)
                        const matchedItem = loanItems.find((item) => item.copies?.barcode === value.trim())
                        if (matchedItem) selectLoanItem(matchedItem)
                      }}
                      className="admin-return-barcode"
                    />
                    {selectedItem && !['borrowed', 'overdue'].includes(selectedItem.status) && !returnBarcode.trim() && (
                      <div className="admin-inline-hint">
                        Select an on-loan or overdue record, or scan a barcode.
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
                      <span>Condition Out (At Checkout)</span>
                      <strong>{selectedItem?.condition_out?.replace(/^\w/, (letter) => letter.toUpperCase()) || 'Not recorded'}</strong>
                      <small>
                        {selectedItem?.handover_at
                          ? `Checked out ${new Date(selectedItem.handover_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`
                          : 'Checkout date unavailable'}
                      </small>
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
                            setReturnDamageTier(['poor', 'damaged'].includes(cond) ? null : 0)
                          }}
                        >
                          <strong>{cond[0].toUpperCase() + cond.slice(1)}</strong>
                          <span>{description}</span>
                        </button>
                      ))}
                    </div>
                    {['poor', 'damaged'].includes(returnCondition) && (
                      <label className="admin-damage-tier-control">
                        <span>Damage fee tier (required)</span>
                        <select
                          value={returnDamageTier ?? ''}
                          onChange={(e) => setReturnDamageTier(e.target.value === '' ? null : Number(e.target.value))}
                        >
                          <option value="">Select damage tier</option>
                          <option value="10">Minor (10%)</option>
                          <option value="30">Major (30%)</option>
                          <option value="100">Unusable (100%)</option>
                        </select>
                      </label>
                    )}
                    <label className="admin-condition-label" htmlFor="return-condition-notes">
                      Condition In Notes
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
                          {returnCondition === 'damaged' ? 'Required for Damaged' : 'Optional for Good / Fair / Poor'}
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

                  {/* Settlement Option */}
                  <div className="admin-drawer-box">
                    <div className="admin-drawer-box-title">Charges &amp; Settlement Decision</div>
                    <div className="admin-fee-summary-row">
                      <span>Fine Subtotal{returnOverdueDays ? ` (${returnOverdueDays} days)` : ''}</span>
                      <strong>{returnFineSubtotal.toLocaleString('vi-VN')}đ</strong>
                    </div>
                    <div className="admin-fee-summary-row">
                      <span>Damage Fee ({returnCondition[0].toUpperCase() + returnCondition.slice(1)} Condition)</span>
                      <strong>{(returnDamageAmount + projectedDamageAmount).toLocaleString('vi-VN')}đ</strong>
                    </div>
                    <div className="admin-fee-summary-row admin-fee-total">
                      <span>Total Due Now</span>
                      <strong>{(returnFineSubtotal + returnDamageAmount + projectedDamageAmount).toLocaleString('vi-VN')}đ</strong>
                    </div>
                  </div>

                  {/* Submit Return */}
                  <div style={{ borderTop: '1px solid #ede6db', paddingTop: '12px' }}>
                    <button
                      type="button"
                      className="admin-btn-primary"
                      style={{ width: '100%', justifyContent: 'center', height: '42px', fontSize: '17px' }}
                      disabled={
                        actionLoading ||
                        (!returnBarcode.trim() && !selectedItemBarcode) ||
                        (returnCondition === 'damaged' && returnMedia.length === 0) ||
                        (['poor', 'damaged'].includes(returnCondition) && returnDamageTier === null)
                      }
                      onClick={handleConfirmReturn}
                    >
                      <IconCheck size={18} />
                      {actionLoading ? 'Đang xử lý...' : 'Confirm Return & Check-In'}
                    </button>
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
            ['damage', 'Damage Fees', charges.filter((c) => c.status === 'unpaid' && ['damage_fee', 'loss_fee'].includes(c.type)).length],
            ['membership', 'Membership', charges.filter((c) => c.status === 'unpaid' && c.type === 'membership_fee').length],
            ['checkout', 'Loan Checkout', charges.filter((c) => c.status === 'unpaid' && c.type === 'borrow_fee').length],
            ['others', 'Others', charges.filter((c) => c.status === 'unpaid' && !['overdue_fine', 'damage_fee', 'loss_fee', 'membership_fee', 'borrow_fee'].includes(c.type)).length],
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

        <div className="admin-search-bar-wrap">
          <div className="admin-barcode-input">
            <span className="admin-barcode-icon"><IconBarcode size={15} color="#6e472a" /></span>
            <input
              type="text"
              placeholder="Search student, charge, or item..."
              value={barcodeSearch}
              onChange={(e) => updateBarcodeSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') loadData()
              }}
            />
          </div>
          <button type="button" className="admin-btn-primary" onClick={loadData}><IconSearch size={13} />Lookup</button>
          <button type="button" className="admin-btn-outline" onClick={() => updateBarcodeSearch('')}>Clear</button>
        </div>

        <div className={`admin-work-layout ${selectedCharge ? '' : 'admin-work-layout-single'}`}>
          {/* Left Table: Charges */}
          <div className="admin-table-container">
            <div className="admin-table-toolbar">
              <span style={{ fontSize: '16px', fontWeight: 600, color: '#72685e' }}>
                Outstanding charges ({unpaidChargesCount})
              </span>
              <button type="button" className="admin-btn-icon" aria-label="Refresh charges" onClick={loadData}>
                <IconRefresh size={13} />
              </button>
            </div>

            <table className="admin-table">
              <thead>
                <tr>
                  <th>Student Name & ID</th>
                  <th>Transaction Reason</th>
                  <th>Associated Item / Code</th>
                  <th>Amount</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {paymentPageItems.map((chg) => {
                  const isSelected = selectedCharge?.id === chg.id
                  return (
                    <tr
                      key={chg.id}
                      className={isSelected ? 'selected' : ''}
                      onClick={() => setSelectedCharge(chg)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div style={{ fontWeight: 600 }}>{chg.profiles?.full_name || 'Student'}</div>
                        <div style={{ fontSize: '13px', color: '#72685e' }}>
                          ID: {chg.profiles?.student_id || 'N/A'}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, color: chg.type === 'overdue_fine' ? '#dc2626' : '#241e19' }}>
                          {chg.type === 'overdue_fine' ? 'Overdue Fine' : chg.type.replaceAll('_', ' ')}
                        </div>
                        <div style={{ fontSize: '13px', color: '#72685e' }}>{chg.notes || 'Counter charge'}</div>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600 }}>{chg.loan_items?.books?.title || '—'}</div>
                        <div style={{ fontSize: '12px', color: '#72685e' }}>{chg.loan_items?.id?.slice(0, 8) || 'Counter charge'}</div>
                      </td>

                      <td>
                        <span style={{ fontWeight: 700, color: chg.type === 'overdue_fine' ? '#dc2626' : '#241e19' }}>
                          {Number(chg.amount).toLocaleString('vi-VN')}đ
                        </span>
                      </td>

                      <td>
                        <div>{new Date(chg.created_at).toLocaleDateString('vi-VN')}</div>
                        <div style={{ fontSize: '12px', color: '#dc2626' }}>{chg.status === 'unpaid' ? 'Outstanding' : 'Paid'}</div>
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

          {/* Right Drawer: Desk Settlement Inspector */}
          {selectedCharge && (
          <div className="admin-drawer admin-counter-inspector">
            <div className="admin-counter-inspector-title">Desk Settlement Inspector</div>

            <>
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
                    <strong>
                      {selectedCharge.type === 'overdue_fine'
                        ? 'Overdue Daily Accrual Fine'
                        : selectedCharge.type.replaceAll('_', ' ')}
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
                    ✓ Khoản phí này đã được thanh toán hoàn tất.
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

                    {/* Change Calculation Box */}
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
            </>
          </div>
          )}
        </div>
        </>
      )}
    </div>
  )
}
