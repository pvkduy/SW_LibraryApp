import { useState } from 'react'

export function FineCheckoutModal({ charges, onClose, onSuccess }) {
  const [method, setMethod] = useState('online')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const totalAmount = charges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0)

  const handlePay = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const chargeIds = charges.map((c) => c.id)
      await onSuccess(chargeIds, method)
      onClose()
    } catch (err) {
      setError(err.message || 'Thanh toán thất bại, vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="reader-modal-overlay" onClick={onClose}>
      <div className="reader-modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#241e19' }}>Thanh toán phí phạt</h3>
          <button
            type="button"
            style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#8c827a' }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {error && (
          <div style={{ padding: '10px', background: '#ffebee', color: '#c62828', borderRadius: '6px', fontSize: '13px', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#6e665e' }}>
            Bạn đang thanh toán cho <strong>{charges.length}</strong> khoản phí:
          </p>
          <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #ede6db', borderRadius: '8px', padding: '10px' }}>
            {charges.map((c) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', borderBottom: '1px dashed #f0eae1' }}>
                <span>{c.notes || c.type}</span>
                <strong style={{ color: '#c62828' }}>{Number(c.amount).toLocaleString('vi-VN')} đ</strong>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid #ede6db', borderBottom: '1px solid #ede6db', marginBottom: '16px' }}>
          <span style={{ fontSize: '15px', fontWeight: 600, color: '#241e19' }}>Tổng số tiền cần thanh toán:</span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: '#b3261e' }}>{totalAmount.toLocaleString('vi-VN')} đ</span>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#241e19', marginBottom: '8px' }}>
            Phương thức thanh toán:
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="payMethod"
                value="online"
                checked={method === 'online'}
                onChange={() => setMethod('online')}
              />
              Cổng thanh toán sinh viên / Thẻ ATM (Mô phỏng)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="payMethod"
                value="ewallet"
                checked={method === 'ewallet'}
                onChange={() => setMethod('ewallet')}
              />
              Ví điện tử MoMo / ZaloPay (Mô phỏng)
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="reader-nav-item"
            onClick={onClose}
            disabled={submitting}
          >
            Hủy
          </button>
          <button
            type="button"
            className="auth-btn-primary"
            style={{ width: 'auto', padding: '0 20px', marginTop: 0, height: '38px', fontSize: '14px', backgroundColor: '#b3261e' }}
            onClick={handlePay}
            disabled={submitting}
          >
            {submitting ? 'Đang xử lý...' : `Xác nhận nộp ${totalAmount.toLocaleString('vi-VN')} đ`}
          </button>
        </div>
      </div>
    </div>
  )
}
