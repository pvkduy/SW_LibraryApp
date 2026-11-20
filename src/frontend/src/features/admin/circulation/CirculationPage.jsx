import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { api } from '../../../lib/api'
import { IconBarcode, IconRefresh, IconCheck } from '../components/AdminIcons'

export function CirculationPage() {
  const [mainTab, setMainTab] = useState('handover-return') // 'handover-return' | 'counter-payments'
  const [drawerMode, setDrawerMode] = useState('handover') // 'handover' | 'return'
  const [filterPill, setFilterPill] = useState('all')

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
  const [actionLoading, setActionLoading] = useState(false)
  const [actionFeedback, setActionFeedback] = useState(null)

  // Inspection states (Return)
  const [returnBarcode, setReturnBarcode] = useState('')
  const [returnCondition, setReturnCondition] = useState('good')
  const [returnDamageTier, setReturnDamageTier] = useState(0) // 0, 10, 30, 100%
  const [returnSettleNow, setReturnSettleNow] = useState(false)
  const [returnAmountCollected, setReturnAmountCollected] = useState('')

  // Counter Payment state
  const [paymentAmountCollected, setPaymentAmountCollected] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')

  // Fetch loans and charges
  const loadData = useCallback(async () => {
    try {
      // 1. Fetch loan items with relations
      const { data: items, error: itemsErr } = await supabase
        .from('loan_items')
        .select(`
          id, status, is_premium, fee, duration_days, pickup_deadline, handover_at, due_at, returned_at,
          condition_out, condition_in, notes, created_at,
          books ( id, title, authors, replacement_price, shelf_location, isbn13 ),
          copies ( id, barcode, status, shelf_location, condition ),
          profiles ( id, full_name, student_id, email, debt_outstanding, active_items, status )
        `)
        .order('created_at', { ascending: false })

      if (itemsErr) console.error('Error fetching loan items:', itemsErr)
      else {
        setLoanItems(items || [])
        setSelectedItem((prev) => prev || (items && items[0]) || null)
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
        setSelectedCharge((prev) => prev || (chgData && chgData[0]) || null)
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
  const onLoanCount = loanItems.filter((i) => i.status === 'borrowed').length
  const overdueCount = loanItems.filter((i) => i.status === 'overdue').length
  const unpaidChargesCount = charges.filter((c) => c.status === 'unpaid').length

  // Filtered loan list
  const filteredItems = loanItems.filter((item) => {
    if (filterPill === 'ready') return item.status === 'ready_for_pickup'
    if (filterPill === 'on_loan') return item.status === 'borrowed'
    if (filterPill === 'overdue') return item.status === 'overdue'
    if (filterPill === 'lost') return item.status === 'lost'
    if (filterPill === 'history') return item.status === 'returned'

    // Text search if any
    if (barcodeSearch.trim()) {
      const q = barcodeSearch.trim().toLowerCase()
      const barcode = item.copies?.barcode?.toLowerCase() || ''
      const title = item.books?.title?.toLowerCase() || ''
      const studentId = item.profiles?.student_id?.toLowerCase() || ''
      const studentName = item.profiles?.full_name?.toLowerCase() || ''
      return barcode.includes(q) || title.includes(q) || studentId.includes(q) || studentName.includes(q)
    }

    return true
  })

  // Handle Handover Confirmation (Calls Edge Function handover-items)
  const handleConfirmHandover = async () => {
    if (!selectedItem) return
    setActionLoading(true)
    setActionFeedback(null)

    try {
      const res = await api.invoke('handover-items', {
        loan_item_id: selectedItem.id,
        condition_out: handoverCondition,
        notes: handoverNotes,
      })

      setActionFeedback({ type: 'success', message: res.message || 'Xuất mượn thành công! Đã chuyển sách sang trạng thái Borrowed.' })
      await loadData()
    } catch (err) {
      setActionFeedback({ type: 'error', message: err.message })
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Return Confirmation (Calls Edge Function return-loan)
  const handleConfirmReturn = async () => {
    const targetBarcode = returnBarcode.trim() || selectedItem?.copies?.barcode
    if (!targetBarcode) {
      setActionFeedback({ type: 'error', message: 'Vui lòng nhập hoặc quét mã barcode cuốn sách cần trả.' })
      return
    }

    setActionLoading(true)
    setActionFeedback(null)

    try {
      const res = await api.invoke('return-loan', {
        copy_barcode: targetBarcode,
        condition_in: returnCondition,
        damage_tier: Number(returnDamageTier),
        settle_now: returnSettleNow,
        amount_collected: Number(returnAmountCollected) || 0,
      })

      const data = res.data
      let msg = res.message || `Nhận trả sách thành công! Trạng thái bản sao: ${data?.copy_status}.`
      if (data && data.total_fee > 0) {
        msg += ` Tổng phí phạt: ${data.total_fee.toLocaleString()}đ (${data.settled ? 'Đã thu tiền tại quầy, Mã biên lai: ' + data.receipt_number : 'Đã ghi nợ vào tài khoản SV'}).`
      }
      setActionFeedback({ type: 'success', message: msg })
      setReturnBarcode('')
      await loadData()
    } catch (err) {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
            Handover & Return
          </button>
          <button
            type="button"
            className={`admin-drawer-tab-btn ${mainTab === 'counter-payments' ? 'active' : ''}`}
            onClick={() => {
              setMainTab('counter-payments')
              setActionFeedback(null)
            }}
          >
            Counter Payments ({unpaidChargesCount})
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
          <div className="admin-kpi-badge" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
            📦
          </div>
        </div>

        <div className="admin-kpi-card">
          <div>
            <div className="admin-kpi-label">Due Today</div>
            <div className="admin-kpi-value">1</div>
          </div>
          <div className="admin-kpi-badge" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
            📅
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
            ⚠️
          </div>
        </div>

        <div className="admin-kpi-card">
          <div>
            <div className="admin-kpi-label">Active Loans</div>
            <div className="admin-kpi-value">{onLoanCount}</div>
          </div>
          <div className="admin-kpi-badge" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
            📖
          </div>
        </div>
      </div>

      {/* Barcode Search Bar */}
      <div className="admin-search-bar-wrap">
        <div className="admin-barcode-input">
          <IconBarcode size={22} color="#72685e" />
          <input
            type="text"
            placeholder="Scan or input copy barcode / Student MSSV (e.g. 9780132350884-01)..."
            value={barcodeSearch}
            onChange={(e) => setBarcodeSearch(e.target.value)}
          />
        </div>
        <button type="button" className="admin-btn-primary" onClick={() => loadData()}>
          Lookup
        </button>
        <button type="button" className="admin-btn-outline" onClick={() => setBarcodeSearch('')}>
          Clear
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
            fontSize: '13px',
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
              onClick={() => setFilterPill('all')}
            >
              All <span className="admin-pill-count">{loanItems.length}</span>
            </button>
            <button
              type="button"
              className={`admin-pill-btn ${filterPill === 'ready' ? 'active' : ''}`}
              onClick={() => setFilterPill('ready')}
            >
              Ready for pickup <span className="admin-pill-count">{readyCount}</span>
            </button>
            <button
              type="button"
              className={`admin-pill-btn ${filterPill === 'on_loan' ? 'active' : ''}`}
              onClick={() => setFilterPill('on_loan')}
            >
              On loan <span className="admin-pill-count">{onLoanCount}</span>
            </button>
            <button
              type="button"
              className={`admin-pill-btn ${filterPill === 'overdue' ? 'active' : ''}`}
              onClick={() => setFilterPill('overdue')}
            >
              Overdue <span className="admin-pill-count">{overdueCount}</span>
            </button>
            <button
              type="button"
              className={`admin-pill-btn ${filterPill === 'history' ? 'active' : ''}`}
              onClick={() => setFilterPill('history')}
            >
              History
            </button>
          </div>

          {/* Work Layout: Table + Inspection Drawer */}
          <div className="admin-work-layout">
            {/* Left: Table */}
            <div className="admin-table-container">
              <div className="admin-table-toolbar">
                <button type="button" className="admin-btn-outline" style={{ fontSize: '12px' }} onClick={loadData}>
                  <IconRefresh size={14} /> Refresh
                </button>
              </div>

              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Borrower & Student ID</th>
                    <th>Book Title & Shelf</th>
                    <th>Barcode</th>
                    <th>Deadline / Due</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const isSelected = selectedItem?.id === item.id
                    return (
                      <tr
                        key={item.id}
                        className={isSelected ? 'selected' : ''}
                        onClick={() => setSelectedItem(item)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <div style={{ fontWeight: 600, color: '#241e19' }}>
                            {item.profiles?.full_name || 'Sinh viên'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#72685e' }}>
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
                          <div style={{ fontSize: '11px', color: '#9d9388' }}>
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
                            <span style={{ color: '#92400e', fontSize: '12px' }}>
                              Hạn nhận: {item.pickup_deadline ? new Date(item.pickup_deadline).toLocaleDateString() : '24h'}
                            </span>
                          )}
                          {item.status === 'borrowed' && (
                            <span style={{ color: '#166534', fontSize: '12px' }}>
                              Hạn trả: {item.due_at ? new Date(item.due_at).toLocaleDateString() : '14 ngày'}
                            </span>
                          )}
                          {item.status === 'overdue' && (
                            <span style={{ color: '#dc2626', fontSize: '12px', fontWeight: 600 }}>
                              Trễ: {item.due_at ? new Date(item.due_at).toLocaleDateString() : 'Quá hạn'}
                            </span>
                          )}
                          {item.status === 'returned' && (
                            <span style={{ color: '#72685e', fontSize: '12px' }}>
                              Đã trả: {item.returned_at ? new Date(item.returned_at).toLocaleDateString() : 'Hoàn tất'}
                            </span>
                          )}
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
                            style={{ padding: '4px 10px', fontSize: '11px' }}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedItem(item)
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
                      <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#72685e' }}>
                        Không có yêu cầu nào phù hợp bộ lọc.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Right: Inspection Side Drawer */}
            <div className="admin-drawer">
              {/* Drawer Mode Switcher: Handover vs Return */}
              <div className="admin-drawer-tabs">
                <button
                  type="button"
                  className={`admin-drawer-tab-btn ${drawerMode === 'handover' ? 'active' : ''}`}
                  onClick={() => setDrawerMode('handover')}
                >
                  ✓ Handover
                </button>
                <button
                  type="button"
                  className={`admin-drawer-tab-btn ${drawerMode === 'return' ? 'active' : ''}`}
                  onClick={() => {
                    setDrawerMode('return')
                    if (selectedItem?.copies?.barcode) {
                      setReturnBarcode(selectedItem.copies.barcode)
                    }
                  }}
                >
                  ↩ Return Flow
                </button>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* DRAWER VIEW A: HANDOVER (UC-20)                                */}
              {/* ------------------------------------------------------------- */}
              {drawerMode === 'handover' && (
                <>
                  {selectedItem ? (
                    <>
                      <div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#241e19' }}>
                          {selectedItem.profiles?.full_name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#72685e' }}>
                          MSSV: {selectedItem.profiles?.student_id || 'Chưa có'} · Trạng thái:{' '}
                          <span style={{ fontWeight: 600, color: selectedItem.profiles?.status === 'active' ? '#166534' : '#dc2626' }}>
                            {selectedItem.profiles?.status}
                          </span>
                        </div>
                      </div>

                      {/* Patron Standing */}
                      <div className="admin-drawer-box">
                        <div className="admin-drawer-box-title">Patron Standing</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                          <span style={{ color: '#72685e' }}>Loan Quota:</span>
                          <span style={{ fontWeight: 600 }}>
                            {selectedItem.profiles?.active_items || 0} / 5 sách đang mượn
                          </span>
                        </div>
                      </div>

                      {/* Physical Copy Verification */}
                      <div className="admin-drawer-box">
                        <div className="admin-drawer-box-title">Physical Copy Verification</div>
                        <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '2px' }}>
                          {selectedItem.books?.title}
                        </div>
                        <div style={{ fontSize: '12px', color: '#72685e', marginBottom: '8px' }}>
                          {selectedItem.books?.authors?.join(', ')}
                        </div>
                        <div
                          style={{
                            background: '#ffffff',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid #ede6db',
                            fontFamily: 'monospace',
                            fontSize: '13px',
                            fontWeight: 700,
                          }}
                        >
                          Mã vạch: {selectedItem.copies?.barcode || 'N/A'}
                        </div>
                      </div>

                      {/* Condition Assessment (Out) */}
                      <div>
                        <div className="admin-drawer-box-title">Condition Assessment (OUT)</div>
                        <div className="admin-segmented-controls">
                          {['good', 'fair', 'poor', 'damaged'].map((cond) => (
                            <button
                              key={cond}
                              type="button"
                              className={`admin-segment-btn ${handoverCondition === cond ? 'active' : ''}`}
                              onClick={() => setHandoverCondition(cond)}
                            >
                              {cond.toUpperCase()}
                            </button>
                          ))}
                        </div>
                        <textarea
                          rows="2"
                          style={{
                            width: '100%',
                            marginTop: '8px',
                            borderRadius: '6px',
                            border: '1px solid #dcd3c5',
                            padding: '8px',
                            fontSize: '12px',
                            boxSizing: 'border-box',
                            fontFamily: 'inherit',
                          }}
                          placeholder="Archivist condition notes..."
                          value={handoverNotes}
                          onChange={(e) => setHandoverNotes(e.target.value)}
                        />
                      </div>

                      {/* Submit Handover */}
                      <div style={{ borderTop: '1px solid #ede6db', paddingTop: '12px' }}>
                        {selectedItem.status !== 'ready_for_pickup' && (
                          <div style={{ fontSize: '12px', color: '#92400e', marginBottom: '8px', fontWeight: 600 }}>
                            ⚠️ Yêu cầu này hiện có trạng thái "{selectedItem.status}". Chỉ bàn giao khi trạng thái là Ready for Pickup.
                          </div>
                        )}
                        <button
                          type="button"
                          className="admin-btn-primary"
                          style={{ width: '100%', justifyContent: 'center', height: '42px', fontSize: '14px' }}
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
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#241e19' }}>Process Book Return</div>
                    <div style={{ fontSize: '12px', color: '#72685e' }}>Quét mã barcode để nhận trả sách và kiểm tra hư hỏng</div>
                  </div>

                  {/* Barcode input for return */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#72685e' }}>
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
                      onChange={(e) => setReturnBarcode(e.target.value)}
                    />
                  </div>

                  {/* Condition Verification (In) */}
                  <div>
                    <div className="admin-drawer-box-title">Verified In-Condition</div>
                    <div className="admin-segmented-controls">
                      {['good', 'fair', 'poor', 'damaged'].map((cond) => (
                        <button
                          key={cond}
                          type="button"
                          className={`admin-segment-btn ${returnCondition === cond ? 'active' : ''}`}
                          onClick={() => setReturnCondition(cond)}
                        >
                          {cond.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Damage Tier Assessment */}
                  <div className="admin-drawer-box">
                    <div className="admin-drawer-box-title">Đánh giá bồi thường hư hỏng</div>
                    <select
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid #dcd3c5',
                        fontSize: '13px',
                      }}
                      value={returnDamageTier}
                      onChange={(e) => setReturnDamageTier(Number(e.target.value))}
                    >
                      <option value="0">Không hư hại (0%)</option>
                      <option value="10">Nhẹ - Trầy xước/gấp góc (10% giá trị)</option>
                      <option value="30">Vừa - Rách trang/viết bẩn (30% giá trị)</option>
                      <option value="100">Nặng/Hủy sách - Mất trang/rách nát (100% giá trị)</option>
                    </select>
                  </div>

                  {/* Settlement Option */}
                  <div className="admin-drawer-box">
                    <div className="admin-drawer-box-title">Hình thức thanh toán phí phạt</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={returnSettleNow}
                        onChange={(e) => setReturnSettleNow(e.target.checked)}
                      />
                      <span>Thu tiền mặt ngay tại quầy</span>
                    </label>

                    {returnSettleNow && (
                      <div style={{ marginTop: '8px' }}>
                        <input
                          type="number"
                          placeholder="Số tiền khách đưa (VND)..."
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid #dcd3c5',
                            fontSize: '13px',
                            boxSizing: 'border-box',
                          }}
                          value={returnAmountCollected}
                          onChange={(e) => setReturnAmountCollected(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Submit Return */}
                  <div style={{ borderTop: '1px solid #ede6db', paddingTop: '12px' }}>
                    <button
                      type="button"
                      className="admin-btn-primary"
                      style={{ width: '100%', justifyContent: 'center', height: '42px', fontSize: '14px' }}
                      disabled={actionLoading}
                      onClick={handleConfirmReturn}
                    >
                      <IconCheck size={18} />
                      {actionLoading ? 'Đang xử lý...' : 'Confirm Return & Check-In'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ===================================================================== */}
      {/* VIEW 2: COUNTER PAYMENTS (FR-CIRC-07)                                 */}
      {/* ===================================================================== */}
      {mainTab === 'counter-payments' && (
        <div className="admin-work-layout">
          {/* Left Table: Charges */}
          <div className="admin-table-container">
            <div className="admin-table-toolbar">
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#72685e' }}>
                Danh sách khoản phí / tiền phạt chờ thanh toán ({charges.filter((c) => c.status === 'unpaid').length})
              </span>
            </div>

            <table className="admin-table">
              <thead>
                <tr>
                  <th>Student Name & ID</th>
                  <th>Transaction Reason</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {charges.map((chg) => {
                  const isSelected = selectedCharge?.id === chg.id
                  return (
                    <tr
                      key={chg.id}
                      className={isSelected ? 'selected' : ''}
                      onClick={() => setSelectedCharge(chg)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div style={{ fontWeight: 600 }}>{chg.profiles?.full_name || 'Sinh viên'}</div>
                        <div style={{ fontSize: '11px', color: '#72685e' }}>
                          MSSV: {chg.profiles?.student_id || 'N/A'}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, color: chg.type === 'overdue_fine' ? '#dc2626' : '#241e19' }}>
                          {chg.type === 'overdue_fine' ? 'Overdue Fine (Phạt trễ hạn)' : chg.type}
                        </div>
                        <div style={{ fontSize: '11px', color: '#72685e' }}>{chg.notes || 'Khoản thu tại quầy'}</div>
                      </td>

                      <td>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: '#241e19' }}>
                          {chg.amount.toLocaleString()}đ
                        </span>
                      </td>

                      <td>
                        {chg.status === 'unpaid' ? (
                          <span className="admin-badge admin-badge-overdue">Unpaid</span>
                        ) : (
                          <span className="admin-badge admin-badge-borrowed">Paid</span>
                        )}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="admin-btn-outline"
                          style={{ padding: '4px 10px', fontSize: '11px' }}
                          onClick={() => setSelectedCharge(chg)}
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  )
                })}

                {charges.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: '#72685e' }}>
                      Chưa có khoản phí nào phát sinh.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Right Drawer: Desk Settlement Inspector */}
          <div className="admin-drawer">
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#241e19' }}>Desk Settlement Inspector</div>

            {selectedCharge ? (
              <>
                <div className="admin-drawer-box">
                  <div style={{ fontSize: '15px', fontWeight: 700 }}>{selectedCharge.profiles?.full_name}</div>
                  <div style={{ fontSize: '12px', color: '#72685e' }}>
                    MSSV: {selectedCharge.profiles?.student_id} · Khoản thu: {selectedCharge.type}
                  </div>
                  <div
                    style={{
                      fontSize: '22px',
                      fontWeight: 800,
                      color: '#dc2626',
                      marginTop: '8px',
                    }}
                  >
                    {selectedCharge.amount.toLocaleString()}đ
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
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#72685e' }}>
                        Amount Collected (VND):
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 50000"
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '6px',
                          border: '1px solid #dcd3c5',
                          fontSize: '16px',
                          fontWeight: 700,
                          boxSizing: 'border-box',
                          marginTop: '4px',
                        }}
                        value={paymentAmountCollected}
                        onChange={(e) => setPaymentAmountCollected(e.target.value)}
                      />
                    </div>

                    {/* Change Calculation Box */}
                    {Number(paymentAmountCollected) >= selectedCharge.amount && (
                      <div
                        style={{
                          background: '#dcfce7',
                          border: '1px solid #86efac',
                          borderRadius: '8px',
                          padding: '12px',
                        }}
                      >
                        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#166534' }}>
                          Change to return (Tiền thối lại):
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: '#15803d' }}>
                          {(Number(paymentAmountCollected) - selectedCharge.amount).toLocaleString()}đ
                        </div>
                      </div>
                    )}

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#72685e' }}>
                        Optional Settlement Note:
                      </label>
                      <textarea
                        rows="2"
                        placeholder="Ghi chú thu tiền tại quầy..."
                        style={{
                          width: '100%',
                          padding: '8px',
                          borderRadius: '6px',
                          border: '1px solid #dcd3c5',
                          fontSize: '12px',
                          boxSizing: 'border-box',
                          fontFamily: 'inherit',
                          marginTop: '4px',
                        }}
                        value={paymentNotes}
                        onChange={(e) => setPaymentNotes(e.target.value)}
                      />
                    </div>

                    <button
                      type="button"
                      className="admin-btn-primary"
                      style={{ width: '100%', justifyContent: 'center', height: '42px', fontSize: '14px' }}
                      disabled={actionLoading}
                      onClick={handleSettlePayment}
                    >
                      <IconCheck size={18} />
                      {actionLoading ? 'Đang xử lý...' : 'Confirm Settlement & Issue Receipt'}
                    </button>
                  </>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', color: '#72685e', padding: '40px 0' }}>
                Chọn một khoản phí cần thu ở bảng bên trái.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
