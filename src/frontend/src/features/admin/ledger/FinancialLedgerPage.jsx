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
    <div className="circ-page">
      <div className="circ-header">
        <div>
          <h2>Sổ cái tài chính (Financial Ledger)</h2>
          <p>Báo cáo doanh thu, biên lai thanh toán và theo dõi nợ phí phạt sinh viên.</p>
        </div>
        <button
          type="button"
          className="circ-btn circ-btn-secondary"
          onClick={loadFinancialData}
        >
          🔄 Làm mới dữ liệu
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #ede6db', borderRadius: '12px', padding: '18px' }}>
          <div style={{ fontSize: '13px', color: '#6e665e', marginBottom: '4px' }}>Tổng doanh thu đã thu</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#2e7d32' }}>
            {totalRevenue.toLocaleString('vi-VN')} đ
          </div>
          <div style={{ fontSize: '12px', color: '#8c827a', marginTop: '4px' }}>
            Từ {receipts.length} giao dịch biên lai
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #ede6db', borderRadius: '12px', padding: '18px' }}>
          <div style={{ fontSize: '13px', color: '#6e665e', marginBottom: '4px' }}>Nợ phạt chưa thu (Outstanding)</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#b3261e' }}>
            {totalOutstanding.toLocaleString('vi-VN')} đ
          </div>
          <div style={{ fontSize: '12px', color: '#8c827a', marginTop: '4px' }}>
            Từ {charges.length} khoản phí quá hạn & bồi thường
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #ede6db', marginBottom: '18px' }}>
        <button
          type="button"
          style={{
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'receipts' ? '2px solid #6e472a' : '2px solid transparent',
            color: activeTab === 'receipts' ? '#6e472a' : '#6e665e',
            cursor: 'pointer'
          }}
          onClick={() => setActiveTab('receipts')}
        >
          Biên lai đã thu ({receipts.length})
        </button>
        <button
          type="button"
          style={{
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'outstanding' ? '2px solid #6e472a' : '2px solid transparent',
            color: activeTab === 'outstanding' ? '#6e472a' : '#6e665e',
            cursor: 'pointer'
          }}
          onClick={() => setActiveTab('outstanding')}
        >
          Khoản nợ chưa thanh toán ({charges.length})
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#6e665e' }}>Đang tải sổ cái...</p>
      ) : activeTab === 'receipts' ? (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <input
              type="text"
              placeholder="Tìm theo số biên lai, tên sinh viên hoặc MSSV..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #dcd3c6',
                fontSize: '14px'
              }}
            />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #dcd3c6',
                fontSize: '14px'
              }}
            >
              <option value="all">Tất cả loại phí</option>
              <option value="fine">Phí phạt (Fine)</option>
              <option value="membership">Hội viên (Membership)</option>
              <option value="damage">Bồi thường hư hại</option>
            </select>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #ede6db', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#faf6f0', borderBottom: '1px solid #ede6db', color: '#52473f', fontSize: '13px' }}>
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
                        <div style={{ fontSize: '12px', color: '#8c827a' }}>{rc.profiles?.student_id || rc.profiles?.email}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ textTransform: 'capitalize' }}>{rc.type}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: '13px', color: '#6e665e' }}>{rc.method}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#2e7d32' }}>
                        +{Number(rc.amount).toLocaleString('vi-VN')} đ
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6e665e' }}>
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
        <div style={{ background: '#ffffff', border: '1px solid #ede6db', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#faf6f0', borderBottom: '1px solid #ede6db', color: '#52473f', fontSize: '13px' }}>
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
                      <div style={{ fontSize: '12px', color: '#8c827a' }}>{ch.profiles?.student_id || ch.profiles?.email}</div>
                    </td>
                    <td style={{ padding: '12px 16px', textTransform: 'capitalize' }}>
                      {ch.type}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#52473f' }}>
                      {ch.notes || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#b3261e' }}>
                      {Number(ch.amount).toLocaleString('vi-VN')} đ
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6e665e' }}>
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
