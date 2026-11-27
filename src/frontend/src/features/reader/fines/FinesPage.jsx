import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { api } from '../../../lib/api'
import { PickupQrSvg, ReceiptIcon } from '../catalog/CatalogIcons.jsx'
import { FineCheckoutModal } from './FineCheckoutModal.jsx'

const RECEIPT_LABELS = {
  fine: 'Fine payment',
  overdue_fine: 'Overdue fine payment',
  damage: 'Damage fee payment',
  damage_fee: 'Damage fee payment',
  loss: 'Lost item payment',
  borrow_fee: 'Borrowing fee',
  membership: 'Membership payment',
}

function formatReceiptDate(value, includeTime = false) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('vi-VN', includeTime
    ? { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric', year: 'numeric' })
}

function receiptLabel(receipt) {
  return RECEIPT_LABELS[receipt.type] || 'Library transaction'
}

function receiptMethod(method) {
  const methods = {
    cash: 'Cash',
    card: 'Card',
    transfer: 'Bank transfer',
    counter: 'At the circulation desk',
    online: 'Online payment',
    ewallet: 'E-wallet',
  }
  return methods[method] || method || '—'
}

function chargeTitle(charge) {
  const titles = {
    overdue_fine: 'Overdue fine',
    damage_fee: 'Damage fee',
    loss_fee: 'Lost book fee',
  }
  return titles[charge.type] || 'Library charge'
}

export function FinesPage({ onProfileRefresh, embedded = false, profile }) {
  const [charges, setCharges] = useState([])
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedChargeIds, setSelectedChargeIds] = useState([])
  const [selectedReceipt, setSelectedReceipt] = useState(null)
  const [showCheckout, setShowCheckout] = useState(false)
  const [activeTab, setActiveTab] = useState('unpaid') // unpaid | history
  const [message, setMessage] = useState(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load charges
      const { data: chData } = await supabase
        .from('charges')
        .select('*')
        .eq('uid', user.id)
        .order('created_at', { ascending: false })

      setCharges(chData || [])

      // Load receipts
      const { data: rcData } = await supabase
        .from('receipts')
        .select('*')
        .eq('uid', user.id)
        .order('created_at', { ascending: false })

      setReceipts(rcData || [])
    } catch (err) {
      console.error('Error loading fines:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const unpaidCharges = charges.filter((c) => c.status === 'unpaid')
  const totalUnpaid = unpaidCharges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0)

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedChargeIds(unpaidCharges.map((c) => c.id))
    } else {
      setSelectedChargeIds([])
    }
  }

  const handleToggleSelect = (id) => {
    setSelectedChargeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handlePaySuccess = async (chargeIds, method) => {
    const data = await api.invoke('pay-reader-charges', {
      charge_ids: chargeIds,
      method,
    })

    if (!data?.success) throw new Error(data?.message || 'Payment could not be completed. Please try again.')

    setMessage({ type: 'success', text: 'Payment completed successfully.' })
    setSelectedChargeIds([])
    await loadData()
    if (onProfileRefresh) onProfileRefresh()
  }

  const selectedChargesToPay = unpaidCharges.filter((c) => selectedChargeIds.includes(c.id))

  return (
    <div>
      {!embedded && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '22px', color: '#241e19' }}>Fines & Fees</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6e665e' }}>
              Manage overdue, damage, and other library charges.
            </p>
          </div>
          {unpaidCharges.length > 0 && (
            <button
              type="button"
              className="auth-btn-primary"
              style={{ width: 'auto', padding: '0 20px', height: '40px', marginTop: 0, backgroundColor: '#b3261e' }}
              disabled={selectedChargeIds.length === 0}
              onClick={() => setShowCheckout(true)}
            >
              Pay selected ({selectedChargeIds.length})
            </button>
          )}
        </div>
      )}

      {message && (
        <div style={{ padding: '12px 16px', background: message.type === 'success' ? '#e8f5e9' : '#ffebee', color: message.type === 'success' ? '#2e7d32' : '#c62828', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
          {message.text}
        </div>
      )}

      {totalUnpaid > 0 && (
        <div className="debt-hold-banner">
          <div>
            <strong>Outstanding library balance: {totalUnpaid.toLocaleString('vi-VN')} VND</strong>
            <div style={{ fontSize: '12px', marginTop: '2px' }}>
              Please pay your balance to restore borrowing and reservation access.
            </div>
          </div>
          <button
            type="button"
            className="debt-hold-btn"
            onClick={() => {
              setSelectedChargeIds(unpaidCharges.map((c) => c.id))
              setShowCheckout(true)
            }}
          >
            Pay all
          </button>
        </div>
      )}

      <div className="reader-tabs">
        <button
          type="button"
          className={`reader-tab-btn ${activeTab === 'unpaid' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('unpaid')
            setSelectedReceipt(null)
          }}
        >
          Unpaid ({unpaidCharges.length})
        </button>
        <button
          type="button"
          className={`reader-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Payment History ({receipts.length})
        </button>
        {embedded && activeTab === 'unpaid' && unpaidCharges.length > 0 && (
          <button
            type="button"
            className="my-loans-fines-pay"
            disabled={selectedChargeIds.length === 0}
            onClick={() => setShowCheckout(true)}
          >
            Pay selected
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ color: '#6e665e' }}>Loading charges…</p>
      ) : activeTab === 'history' ? (
        selectedReceipt ? (
          <div className="receipt-inline-view">
            <button
              type="button"
              className="receipt-return-button"
              onClick={() => setSelectedReceipt(null)}
            >
              Return
            </button>
            <div className="receipt-details">
              <p className="receipt-eyebrow">RECEIPT DETAILS</p>
              <div className="receipt-complete-icon" aria-hidden="true">
                <span>✓</span>
              </div>
              <h2>Transaction Completed</h2>
              <p className="receipt-complete-copy">
                {selectedReceipt.type === 'borrow_fee'
                  ? 'Show your pickup QR at the circulation desk. You can find this receipt anytime in My Loans > Payment History.'
                  : 'Keep this payment receipt for your records. You can find it anytime in My Loans > Payment History.'}
              </p>

              <div className="receipt-qr-wrap">
                <PickupQrSvg value={selectedReceipt.number || selectedReceipt.id} size={152} />
                <span>{selectedReceipt.number || 'RECEIPT'}</span>
              </div>

              <section className="receipt-detail-card" aria-label="Receipt information">
                <h3><ReceiptIcon size={17} color="#6e472a" /> Receipt</h3>
                <div className="receipt-detail-row">
                  <span>Reference ID</span>
                  <strong>#{selectedReceipt.number || selectedReceipt.id?.slice(0, 8).toUpperCase()}</strong>
                </div>
                <div className="receipt-detail-row">
                  <span>Timestamp</span>
                  <strong>{formatReceiptDate(selectedReceipt.created_at, true)}</strong>
                </div>
                <div className="receipt-detail-row">
                  <span>Patron</span>
                  <strong>{profile?.full_name || 'Library patron'}</strong>
                </div>
                {selectedReceipt.type === 'borrow_fee' && (
                  <div className="receipt-detail-row">
                    <span>Pickup Location</span>
                    <strong>Main Library Circulation Desk</strong>
                  </div>
                )}
                <div className="receipt-detail-row">
                  <span>Transaction</span>
                  <strong>{receiptLabel(selectedReceipt)}</strong>
                </div>
                <div className="receipt-detail-row">
                  <span>Payment Method</span>
                  <strong>{receiptMethod(selectedReceipt.method)}</strong>
                </div>
                <div className="receipt-detail-row">
                  <span>Amount Paid</span>
                  <strong>{Number(selectedReceipt.amount || 0).toLocaleString('vi-VN')} VND</strong>
                </div>
              </section>

              <button type="button" className="receipt-print-button" onClick={() => window.print()}>
                Print Receipt
              </button>
            </div>
          </div>
        ) : receipts.length === 0 ? (
          <div className="reader-card">
            <p className="receipt-history-empty">No receipts have been recorded yet.</p>
          </div>
        ) : (
          <div className="receipt-history-list">
            {receipts.map((receipt) => (
              <button
                type="button"
                key={receipt.id}
                className="receipt-history-card"
                onClick={() => setSelectedReceipt(receipt)}
              >
                <strong>{receiptLabel(receipt).toUpperCase()}</strong>
                <span className="receipt-history-meta">
                  <time>{formatReceiptDate(receipt.created_at)}</time>
                  <span className="receipt-number-badge">{receipt.number}</span>
                </span>
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="reader-card">
          {unpaidCharges.length === 0 ? (
            <p style={{ margin: 0, color: '#6e665e', textAlign: 'center', padding: '24px 0' }}>
              🎉 You have no unpaid library charges.
            </p>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '12px', borderBottom: '1px solid #ede6db', marginBottom: '12px' }}>
                <input
                  type="checkbox"
                  id="select-all"
                  checked={selectedChargeIds.length === unpaidCharges.length}
                  onChange={handleSelectAll}
                />
                <label htmlFor="select-all" style={{ fontSize: '13px', fontWeight: 600, color: '#52473f', cursor: 'pointer' }}>
                  Select all
                </label>
              </div>

              {unpaidCharges.map((c) => (
                <div key={c.id} className="loan-item-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="checkbox"
                      checked={selectedChargeIds.includes(c.id)}
                      onChange={() => handleToggleSelect(c.id)}
                    />
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#241e19' }}>
                        {chargeTitle(c)}
                      </h4>
                      <div style={{ fontSize: '12px', color: '#8c827a' }}>
                        Date issued: {formatReceiptDate(c.created_at)}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: '#b3261e', display: 'block' }}>
                      {Number(c.amount).toLocaleString('vi-VN')} VND
                    </span>
                    <span className="badge-status badge-overdue">Unpaid</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showCheckout && (
        <FineCheckoutModal
          charges={selectedChargesToPay}
          onClose={() => setShowCheckout(false)}
          onSuccess={handlePaySuccess}
        />
      )}
    </div>
  )
}
