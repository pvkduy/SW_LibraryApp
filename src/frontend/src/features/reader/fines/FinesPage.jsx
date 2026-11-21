import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { FineCheckoutModal } from './FineCheckoutModal.jsx'

export function FinesPage({ onProfileRefresh }) {
  const [charges, setCharges] = useState([])
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedChargeIds, setSelectedChargeIds] = useState([])
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
    const { data, error } = await supabase.rpc('rpc_pay_reader_charges', {
      p_charge_ids: chargeIds,
      p_method: method
    })

    if (error) throw error
    if (data?.error) throw new Error(data.message || data.error)

    setMessage({ type: 'success', text: data.message || 'Thanh toán thành công!' })
    setSelectedChargeIds([])
    await loadData()
    if (onProfileRefresh) onProfileRefresh()
  }

  const selectedChargesToPay = unpaidCharges.filter((c) => selectedChargeIds.includes(c.id))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', color: '#241e19' }}>Khoản phí & Tiền phạt</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6e665e' }}>
            Quản lý các khoản phí mượn quá hạn, bồi thường sách và lịch sử biên lai.
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
            Nộp tiền ({selectedChargeIds.length} mục)
          </button>
        )}
      </div>

      {message && (
        <div style={{ padding: '12px 16px', background: message.type === 'success' ? '#e8f5e9' : '#ffebee', color: message.type === 'success' ? '#2e7d32' : '#c62828', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
          {message.text}
        </div>
      )}

      {totalUnpaid > 0 && (
        <div className="debt-hold-banner">
          <div>
            <strong>Nợ phí thư viện hiện tại: {totalUnpaid.toLocaleString('vi-VN')} đ</strong>
            <div style={{ fontSize: '12px', marginTop: '2px' }}>
              Vui lòng thanh toán để duy trì quyền hạn mượn và đặt trước sách.
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
            Thanh toán tất cả
          </button>
        </div>
      )}

      <div className="reader-tabs">
        <button
          type="button"
          className={`reader-tab-btn ${activeTab === 'unpaid' ? 'active' : ''}`}
          onClick={() => setActiveTab('unpaid')}
        >
          Chưa thanh toán ({unpaidCharges.length})
        </button>
        <button
          type="button"
          className={`reader-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Lịch sử biên lai ({receipts.length})
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#6e665e' }}>Đang tải dữ liệu...</p>
      ) : activeTab === 'unpaid' ? (
        <div className="reader-card">
          {unpaidCharges.length === 0 ? (
            <p style={{ margin: 0, color: '#6e665e', textAlign: 'center', padding: '24px 0' }}>
              🎉 Tuyệt vời! Bạn không có khoản phí phạt nào chưa thanh toán.
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
                  Chọn tất cả
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
                        {c.notes || (c.type === 'overdue_fine' ? 'Phí quá hạn trả sách' : 'Phí bồi thường')}
                      </h4>
                      <div style={{ fontSize: '12px', color: '#8c827a' }}>
                        Ngày phát sinh: {new Date(c.created_at).toLocaleDateString('vi-VN')}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: '#b3261e', display: 'block' }}>
                      {Number(c.amount).toLocaleString('vi-VN')} đ
                    </span>
                    <span className="badge-status badge-overdue">Chưa thanh toán</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="reader-card">
          {receipts.length === 0 ? (
            <p style={{ margin: 0, color: '#6e665e', textAlign: 'center', padding: '24px 0' }}>
              Chưa có biên lai thanh toán nào được ghi nhận.
            </p>
          ) : (
            <div>
              {receipts.map((rc) => (
                <div key={rc.id} className="loan-item-card">
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#241e19' }}>
                      Biên lai: {rc.number}
                    </h4>
                    <div className="loan-item-sub">
                      <span>Loại: {rc.type}</span>
                      <span>Hình thức: {rc.method === 'online' ? 'Trực tuyến' : rc.method}</span>
                      <span>Ngày: {new Date(rc.created_at).toLocaleString('vi-VN')}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: '#2e7d32', display: 'block' }}>
                      +{Number(rc.amount).toLocaleString('vi-VN')} đ
                    </span>
                    <span className="badge-status badge-borrowed">Đã thu</span>
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
