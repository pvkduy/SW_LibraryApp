import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

const PAGE_SIZE = 15

function matchesReceiptType(receiptType, filterType) {
  if (filterType === 'all') return true
  if (filterType === 'fine') return ['fine', 'overdue_fine'].includes(receiptType)
  if (filterType === 'damage') return ['damage', 'damage_fee'].includes(receiptType)
  if (filterType === 'loss') return ['loss', 'loss_fee'].includes(receiptType)
  if (filterType === 'borrow_fee') return ['borrow_fee', 'premium_fee'].includes(receiptType)
  return receiptType === filterType
}

function formatChargeType(type) {
  const labels = {
    fine: 'Overdue Fine',
    overdue_fine: 'Overdue Fine',
    damage: 'Damage Fee',
    damage_fee: 'Damage Fee',
    loss: 'Loss Replacement',
    loss_fee: 'Loss Replacement',
    borrow_fee: 'Borrow Fee',
    premium_fee: 'Premium Fee',
    membership: 'Membership',
    reversal: 'Reversal / Refund',
    manual: 'Manual Receipt',
  }
  return labels[type] || String(type || '').replaceAll('_', ' ')
}

export function FinancialLedgerPage() {
  const [receipts, setReceipts] = useState([])
  const [charges, setCharges] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState(null)
  const [activeTab, setActiveTab] = useState('receipts') // receipts | outstanding
  const [filterType, setFilterType] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [chargeFilterType, setChargeFilterType] = useState('all')
  const [chargeSearch, setChargeSearch] = useState('')
  const [receiptPage, setReceiptPage] = useState(1)
  const [chargePage, setChargePage] = useState(1)

  const loadFinancialData = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const [{ data: rcData, error: rcErr }, { data: chData, error: chErr }] = await Promise.all([
        supabase
          .from('receipts')
          .select(`
            id, number, uid, amount, method, type, ref_type, ref_id, notes, created_at,
            profiles:uid ( full_name, email, student_id )
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('charges')
          .select(`
            id, uid, amount, type, status, notes, created_at,
            profiles:uid ( full_name, email, student_id )
          `)
          .eq('status', 'unpaid')
          .order('created_at', { ascending: false }),
      ])

      if (rcErr) throw rcErr
      if (chErr) throw chErr
      setReceipts(rcData || [])
      setCharges(chData || [])
    } catch (err) {
      setErrorMessage(err?.message || 'Unable to load financial ledger data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      if (active) await loadFinancialData()
    })()
    return () => { active = false }
  }, [loadFinancialData])

  const totalRevenue = receipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  const totalOutstanding = charges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0)

  const filteredReceipts = receipts.filter((r) => {
    const matchType = matchesReceiptType(r.type, filterType)
    const q = searchQuery.trim().toLowerCase()
    const matchSearch =
      !q ||
      r.number?.toLowerCase().includes(q) ||
      r.profiles?.full_name?.toLowerCase().includes(q) ||
      r.profiles?.student_id?.toLowerCase().includes(q) ||
      r.notes?.toLowerCase().includes(q)
    return matchType && matchSearch
  })

  const filteredCharges = charges.filter((ch) => {
    const matchType = chargeFilterType === 'all' || ch.type === chargeFilterType
    const q = chargeSearch.trim().toLowerCase()
    const matchSearch =
      !q ||
      ch.profiles?.full_name?.toLowerCase().includes(q) ||
      ch.profiles?.student_id?.toLowerCase().includes(q) ||
      ch.notes?.toLowerCase().includes(q) ||
      ch.type?.toLowerCase().includes(q)
    return matchType && matchSearch
  })

  const receiptTotalPages = Math.max(1, Math.ceil(filteredReceipts.length / PAGE_SIZE))
  const safeReceiptPage = Math.min(receiptPage, receiptTotalPages)
  const visibleReceipts = filteredReceipts.slice((safeReceiptPage - 1) * PAGE_SIZE, safeReceiptPage * PAGE_SIZE)

  const chargeTotalPages = Math.max(1, Math.ceil(filteredCharges.length / PAGE_SIZE))
  const safeChargePage = Math.min(chargePage, chargeTotalPages)
  const visibleCharges = filteredCharges.slice((safeChargePage - 1) * PAGE_SIZE, safeChargePage * PAGE_SIZE)

  return (
    <div className="admin-ledger-page">
      <div className="admin-page-title-row">
        <div>
          <h1 className="admin-page-title">Financial Ledger</h1>
          <div className="admin-page-desc">Revenue, payment receipts, reversals, and outstanding fines and fees.</div>
        </div>
        <button
          type="button"
          className="admin-btn-outline"
          onClick={loadFinancialData}
        >
          <span aria-hidden="true">↻</span> Refresh data
        </button>
      </div>

      {errorMessage && (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            fontWeight: 600,
            fontSize: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 700, color: '#991b1b' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="admin-ledger-summary">
        <div className="admin-ledger-card">
          <div className="admin-ledger-label">Net revenue collected</div>
          <div className="admin-ledger-value" style={{ color: totalRevenue < 0 ? '#b3261e' : '#2e7d32' }}>
            {totalRevenue.toLocaleString('vi-VN')} đ
          </div>
          <div className="admin-ledger-caption">{receipts.length} receipt transactions</div>
        </div>

        <div className="admin-ledger-card">
          <div className="admin-ledger-label">Outstanding charges</div>
          <div className="admin-ledger-value" style={{ color: '#b3261e' }}>
            {totalOutstanding.toLocaleString('vi-VN')} đ
          </div>
          <div className="admin-ledger-caption">{charges.length} unpaid fines and fees</div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="admin-ledger-tabs">
        <button
          type="button"
          className={`admin-ledger-tab ${activeTab === 'receipts' ? 'active' : ''}`}
          onClick={() => setActiveTab('receipts')}
        >
          Receipts ({receipts.length})
        </button>
        <button
          type="button"
          className={`admin-ledger-tab ${activeTab === 'outstanding' ? 'active' : ''}`}
          onClick={() => setActiveTab('outstanding')}
        >
          Outstanding ({charges.length})
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#6e665e' }}>Loading ledger...</p>
      ) : activeTab === 'receipts' ? (
        <div className="admin-ledger-receipts">
          <div className="admin-ledger-filters">
            <input
              type="text"
              placeholder="Search receipt number, student, ID, or notes..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setReceiptPage(1) }}
            />
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setReceiptPage(1) }}
              aria-label="Filter receipt type"
            >
              <option value="all">All receipt types</option>
              <option value="fine">Overdue Fine</option>
              <option value="damage">Damage Fee</option>
              <option value="loss">Loss Replacement</option>
              <option value="borrow_fee">Borrow / Premium Fee</option>
              <option value="membership">Membership</option>
              <option value="reversal">Reversal / Refund</option>
              <option value="manual">Manual</option>
            </select>
          </div>

          <div className="admin-ledger-table-wrap">
            <table className="admin-ledger-table">
              <thead>
                <tr style={{ background: '#faf6f0', borderBottom: '1px solid #ede6db', color: '#52473f', fontSize: '14px' }}>
                  <th style={{ padding: '12px 16px' }}>Receipt Number</th>
                  <th style={{ padding: '12px 16px' }}>Payer</th>
                  <th style={{ padding: '12px 16px' }}>Charge Type</th>
                  <th style={{ padding: '12px 16px' }}>Payment Method</th>
                  <th style={{ padding: '12px 16px' }}>Amount</th>
                  <th style={{ padding: '12px 16px' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {visibleReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#6e665e' }}>
                      No receipts match the selected filters.
                    </td>
                  </tr>
                ) : (
                  visibleReceipts.map((rc) => {
                    const amount = Number(rc.amount) || 0
                    const isNegative = amount < 0
                    return (
                      <tr key={rc.id} style={{ borderBottom: '1px solid #f3eee6' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#241e19' }}>
                          {rc.number}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div>{rc.profiles?.full_name || 'N/A'}</div>
                          <div style={{ fontSize: '13px', color: '#8c827a' }}>{rc.profiles?.student_id || rc.profiles?.email}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span>{formatChargeType(rc.type)}</span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: '14px', color: '#6e665e', textTransform: 'capitalize' }}>{rc.method}</span>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: isNegative ? '#b3261e' : '#2e7d32' }}>
                          {isNegative
                            ? `-${Math.abs(amount).toLocaleString('vi-VN')} đ`
                            : `+${amount.toLocaleString('vi-VN')} đ`}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6e665e' }}>
                          {new Date(rc.created_at).toLocaleString('vi-VN')}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
            <div className="admin-pagination-footer">
              <span>Showing {visibleReceipts.length} of {filteredReceipts.length} receipts</span>
              <div className="admin-pagination-controls">
                <button type="button" disabled={safeReceiptPage <= 1} onClick={() => setReceiptPage((p) => Math.max(1, p - 1))}>‹</button>
                <span style={{ padding: '0 8px' }}>Page {safeReceiptPage} / {receiptTotalPages}</span>
                <button type="button" disabled={safeReceiptPage >= receiptTotalPages} onClick={() => setReceiptPage((p) => Math.min(receiptTotalPages, p + 1))}>›</button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="admin-ledger-receipts">
          <div className="admin-ledger-filters">
            <input
              type="text"
              placeholder="Search student, ID, charge type, or notes..."
              value={chargeSearch}
              onChange={(e) => { setChargeSearch(e.target.value); setChargePage(1) }}
            />
            <select
              value={chargeFilterType}
              onChange={(e) => { setChargeFilterType(e.target.value); setChargePage(1) }}
              aria-label="Filter outstanding charge type"
            >
              <option value="all">All charge types</option>
              <option value="overdue_fine">Overdue Fine</option>
              <option value="damage_fee">Damage Fee</option>
              <option value="loss_fee">Loss Replacement</option>
              <option value="borrow_fee">Borrow Fee</option>
            </select>
          </div>

          <div className="admin-ledger-table-wrap">
            <table className="admin-ledger-table">
              <thead>
                <tr style={{ background: '#faf6f0', borderBottom: '1px solid #ede6db', color: '#52473f', fontSize: '14px' }}>
                  <th style={{ padding: '12px 16px' }}>Student</th>
                  <th style={{ padding: '12px 16px' }}>Debt Type</th>
                  <th style={{ padding: '12px 16px' }}>Notes</th>
                  <th style={{ padding: '12px 16px' }}>Amount</th>
                  <th style={{ padding: '12px 16px' }}>Created At</th>
                </tr>
              </thead>
              <tbody>
                {visibleCharges.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#6e665e' }}>
                      No outstanding charges match the selected filters.
                    </td>
                  </tr>
                ) : (
                  visibleCharges.map((ch) => (
                    <tr key={ch.id} style={{ borderBottom: '1px solid #f3eee6' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600 }}>{ch.profiles?.full_name || 'N/A'}</div>
                        <div style={{ fontSize: '13px', color: '#8c827a' }}>{ch.profiles?.student_id || ch.profiles?.email}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {formatChargeType(ch.type)}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#52473f' }}>
                        {ch.notes || '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#b3261e' }}>
                        {Number(ch.amount).toLocaleString('vi-VN')} đ
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6e665e' }}>
                        {new Date(ch.created_at).toLocaleDateString('vi-VN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="admin-pagination-footer">
              <span>Showing {visibleCharges.length} of {filteredCharges.length} unpaid charges</span>
              <div className="admin-pagination-controls">
                <button type="button" disabled={safeChargePage <= 1} onClick={() => setChargePage((p) => Math.max(1, p - 1))}>‹</button>
                <span style={{ padding: '0 8px' }}>Page {safeChargePage} / {chargeTotalPages}</span>
                <button type="button" disabled={safeChargePage >= chargeTotalPages} onClick={() => setChargePage((p) => Math.min(chargeTotalPages, p + 1))}>›</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
