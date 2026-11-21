import { useState } from 'react'

export function BookReviewModal({ bookTitle, loanItemId, onClose, onSuccess }) {
  const [rating, setRating] = useState(5)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await onSuccess(loanItemId, rating, comment)
      onClose()
    } catch (err) {
      setError(err.message || 'Không thể gửi đánh giá.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="reader-modal-overlay" onClick={onClose}>
      <div className="reader-modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#241e19' }}>Đánh giá sách</h3>
          <button
            type="button"
            style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#8c827a' }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#52473f' }}>
          Bạn cảm nhận thế nào về cuốn: <strong>{bookTitle}</strong>?
        </p>

        {error && (
          <div style={{ padding: '10px', background: '#ffebee', color: '#c62828', borderRadius: '6px', fontSize: '13px', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px', textAlign: 'center' }}>
            <div className="star-rating" style={{ justifyContent: 'center', marginBottom: '8px' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`star ${(hoverRating || rating) >= star ? 'active' : ''}`}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                >
                  ★
                </span>
              ))}
            </div>
            <span style={{ fontSize: '13px', color: '#6e665e' }}>
              {rating === 1 && 'Rất tệ'}
              {rating === 2 && 'Không hài lòng'}
              {rating === 3 && 'Bình thường'}
              {rating === 4 && 'Hài lòng'}
              {rating === 5 && 'Tuyệt vời'}
            </span>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#241e19', marginBottom: '6px' }}>
              Nhận xét của bạn (không bắt buộc)
            </label>
            <textarea
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Chia sẻ cảm nghĩ của bạn về nội dung, bài học từ cuốn sách này..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #dcd3c6',
                fontFamily: 'inherit',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
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
              type="submit"
              className="auth-btn-primary"
              style={{ width: 'auto', padding: '0 20px', marginTop: 0, height: '38px', fontSize: '14px' }}
              disabled={submitting}
            >
              {submitting ? 'Đang gửi...' : 'Gửi đánh giá'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
