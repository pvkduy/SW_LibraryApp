import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'

export function FinancialLedgerPage() {
  const [receipts, setReceipts] = useState([])
  const [charges, setCharges] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('receipts') // receipts | outstanding
  const [filterType, setFilterType] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const loadFinancialData = async () => {
    setLoading(true)
    try {
      // 1. Fetch Receipts
      const { data: rcData, error: rcErr } = await supabase
        .from('receipts')
        .select(`
          id,
          number,
          uid,
          amount,
          method,
          type,
          ref_type,
          ref_id,
          notes,
          created_at,
          profiles (
            full_name,
            email,
            student_id
          )
        `)
        .order('created_at', { ascending: false })

      if (rcErr) throw rcErr
      setReceipts(rcData || [])

      // 2. Fetch Unpaid Charges
      const { data: chData, error: chErr } = await supabase
        .from('charges')
        .select(`
          id,
          uid,
          amount,
          type,
          status,
          notes,
          created_at,
          profiles (
            full_name,
            email,
            student_id
          )
        `)
        .eq('status', 'unpaid')
        .order('created_at', { ascending: false })

      if (chErr) throw chErr
      setCharges(chData || [])
    } catch (err) {
      console.error('Error loading ledger:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFinancialData()
  }, [])

  const totalRevenue = receipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  const totalOutstanding = charges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0)

  // Filter receipts
  const filteredReceipts = receipts.filter((r) => {
    const matchType = filterType === 'all' || r.type === filterType
    const q = searchQuery.toLowerCase()
    const matchSearch =
      !q ||
      r.number.toLowerCase().includes(q) ||
      r.profiles?.full_name?.toLowerCase().includes(q) ||
      r.profiles?.student_id?.toLowerCase().includes(q)
    return matchType && matchSearch
  })

  return (
    <div className="admin-ledger-page">
      <div className="admin-page-title-row">
        <div>
          <h1 className="admin-page-title">Financial Ledger</h1>
          <div className="admin-page-desc">Revenue, payment receipts, and outstanding fines and fees.</div>
        </div>
        <button
          type="button"
          className="admin-btn-outline"
          onClick={loadFinancialData}
        >
          <span aria-hidden="true">↻</span> Refresh data
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="admin-ledger-summary">
        <div className="admin-ledger-card">
          <div className="admin-ledger-label">Total revenue collected</div>
          <div className="admin-ledger-value" style={{ color: '#2e7d32' }}>
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
          {/* Filters */}
          <div className="admin-ledger-filters">
            <input
              type="text"
              placeholder="Search receipt number, student, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">Tất cả loại phí</option>
              <option value="fine">Phí phạt (Fine)</option>
              <option value="membership">Hội viên (Membership)</option>
              <option value="damage">Bồi thường hư hại</option>
            </select>
          </div>

          <div className="admin-ledger-table-wrap">
            <table className="admin-ledger-table">
              <thead>
                <tr style={{ background: '#faf6f0', borderBottom: '1px solid #ede6db', color: '#52473f', fontSize: '16px' }}>
                  <th style={{ padding: '12px 16px' }}>Số biên lai</th>
                  <th style={{ padding: '12px 16px' }}>Người nộp</th>
                  <th style={{ padding: '12px 16px' }}>Loại phí</th>
                  <th style={{ padding: '12px 16px' }}>Hình thức</th>
                  <th style={{ padding: '12px 16px' }}>Số tiền</th>
                  <th style={{ padding: '12px 16px' }}>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#6e665e' }}>
                      Không có biên lai nào phù hợp điều kiện lọc.
                    </td>
                  </tr>
                ) : (
                  filteredReceipts.map((rc) => (
                    <tr key={rc.id} style={{ borderBottom: '1px solid #f3eee6' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#241e19' }}>
                        {rc.number}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div>{rc.profiles?.full_name || 'N/A'}</div>
                        <div style={{ fontSize: '14px', color: '#8c827a' }}>{rc.profiles?.student_id || rc.profiles?.email}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ textTransform: 'capitalize' }}>{rc.type}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: '16px', color: '#6e665e' }}>{rc.method}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#2e7d32' }}>
                        +{Number(rc.amount).toLocaleString('vi-VN')} đ
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '16px', color: '#6e665e' }}>
                        {new Date(rc.created_at).toLocaleString('vi-VN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="admin-ledger-table-wrap">
        <table className="admin-ledger-table">
            <thead>
              <tr style={{ background: '#faf6f0', borderBottom: '1px solid #ede6db', color: '#52473f', fontSize: '16px' }}>
                <th style={{ padding: '12px 16px' }}>Sinh viên</th>
                <th style={{ padding: '12px 16px' }}>Loại nợ</th>
                <th style={{ padding: '12px 16px' }}>Ghi chú</th>
                <th style={{ padding: '12px 16px' }}>Số tiền</th>
                <th style={{ padding: '12px 16px' }}>Ngày phát sinh</th>
              </tr>
            </thead>
            <tbody>
              {charges.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#6e665e' }}>
                    Không có khoản nợ tồn đọng nào.
                  </td>
                </tr>
              ) : (
                charges.map((ch) => (
                  <tr key={ch.id} style={{ borderBottom: '1px solid #f3eee6' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{ch.profiles?.full_name || 'N/A'}</div>
                      <div style={{ fontSize: '14px', color: '#8c827a' }}>{ch.profiles?.student_id || ch.profiles?.email}</div>
                    </td>
                    <td style={{ padding: '12px 16px', textTransform: 'capitalize' }}>
                      {ch.type}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '16px', color: '#52473f' }}>
                      {ch.notes || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#b3261e' }}>
                      {Number(ch.amount).toLocaleString('vi-VN')} đ
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '16px', color: '#6e665e' }}>
                      {new Date(ch.created_at).toLocaleDateString('vi-VN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
