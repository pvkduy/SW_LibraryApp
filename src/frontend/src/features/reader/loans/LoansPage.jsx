import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { BookReviewModal } from './BookReviewModal.jsx'

export function LoansPage() {
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('ongoing') // ongoing | history
  const [reviewModalData, setReviewModalData] = useState(null)
  const [message, setMessage] = useState(null)
  const [renewingId, setRenewingId] = useState(null)

  const loadLoans = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('loan_items')
        .select(`
          id,
          status,
          borrowed_at,
          due_date,
          returned_at,
          renew_count,
          copies (
            id,
            barcode,
            books (
              id,
              title,
              authors,
              cover_url,
              collection
            )
          )
        `)
        .eq('uid', user.id)
        .order('borrowed_at', { ascending: false })

      if (error) throw error

      // Also fetch existing reviews for user to mark which returned items are reviewed
      const { data: revData } = await supabase
        .from('book_reviews')
        .select('loan_item_id, rating')
        .eq('uid', user.id)

      const reviewedMap = {}
      ;(revData || []).forEach((r) => {
        if (r.loan_item_id) reviewedMap[r.loan_item_id] = r.rating
      })

      const enriched = (data || []).map((item) => ({
        ...item,
        isReviewed: !!reviewedMap[item.id],
        userRating: reviewedMap[item.id] || null
      }))

      setLoans(enriched)
    } catch (err) {
      console.error('Error loading loans:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLoans()
  }, [])

  const handleRenew = async (loanItemId) => {
    setRenewingId(loanItemId)
    setMessage(null)

    try {
      const { data, error } = await supabase.rpc('rpc_renew_loan', {
        p_loan_item_id: loanItemId
      })

      if (error) throw error
      if (data?.error) throw new Error(data.message || data.error)

      setMessage({ type: 'success', text: data.message || 'Gia hạn thành công!' })
      await loadLoans()
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Gia hạn thất bại.' })
    } finally {
      setRenewingId(null)
    }
  }

  const handleReviewSubmit = async (loanItemId, rating, comment) => {
    const { data, error } = await supabase.rpc('rpc_submit_book_review', {
      p_loan_item_id: loanItemId,
      p_rating: rating,
      p_comment: comment
    })

    if (error) throw error
    if (data?.error) throw new Error(data.message || data.error)

    setMessage({ type: 'success', text: data.message || 'Cảm ơn đánh giá của bạn!' })
    await loadLoans()
  }

  const ongoingLoans = loans.filter((l) => ['borrowed', 'overdue', 'pending'].includes(l.status))
  const historyLoans = loans.filter((l) => ['returned', 'lost'].includes(l.status))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', color: '#241e19' }}>Sách của tôi (My Loans)</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6e665e' }}>
            Theo dõi sách đang mượn, hạn trả, gia hạn thời gian và viết đánh giá sau khi hoàn thành.
          </p>
        </div>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', background: message.type === 'success' ? '#e8f5e9' : '#ffebee', color: message.type === 'success' ? '#2e7d32' : '#c62828', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
          {message.text}
        </div>
      )}

      <div className="reader-tabs">
        <button
          type="button"
          className={`reader-tab-btn ${activeTab === 'ongoing' ? 'active' : ''}`}
          onClick={() => setActiveTab('ongoing')}
        >
          Đang mượn ({ongoingLoans.length})
        </button>
        <button
          type="button"
          className={`reader-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Lịch sử mượn trả ({historyLoans.length})
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#6e665e' }}>Đang tải danh sách sách...</p>
      ) : activeTab === 'ongoing' ? (
        <div className="reader-card">
          {ongoingLoans.length === 0 ? (
            <p style={{ margin: 0, color: '#6e665e', textAlign: 'center', padding: '24px 0' }}>
              Bạn hiện không mượn cuốn sách nào.
            </p>
          ) : (
            <div>
              {ongoingLoans.map((loan) => {
                const book = loan.copies?.books
                const isOverdue = loan.status === 'overdue' || (loan.due_date && new Date(loan.due_date) < new Date())
                const renewCount = loan.renew_count || 0
                const canRenew = renewCount < 2 && !isOverdue && loan.status === 'borrowed'

                return (
                  <div key={loan.id} className="loan-item-card">
                    <div className="loan-item-info">
                      <h4>
                        {book?.title || 'Sách thư viện'}
                        {book?.collection === 'premium' && (
                          <span style={{ marginLeft: '8px', fontSize: '11px', color: '#6e472a', fontWeight: 600 }}>
                            (Premium)
                          </span>
                        )}
                      </h4>
                      <div className="loan-item-sub">
                        <span>Tác giả: {book?.authors?.join(', ') || 'N/A'}</span>
                        <span>Mã bản in: {loan.copies?.barcode}</span>
                        <span>Ngày mượn: {new Date(loan.borrowed_at).toLocaleDateString('vi-VN')}</span>
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '13px' }}>
                        Hạn trả:{' '}
                        <strong style={{ color: isOverdue ? '#b3261e' : '#241e19' }}>
                          {loan.due_date ? new Date(loan.due_date).toLocaleDateString('vi-VN') : 'N/A'}
                        </strong>
                        <span style={{ marginLeft: '12px', color: '#8c827a' }}>
                          (Đã gia hạn: {renewCount}/2 lần)
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                      <span className={`badge-status ${isOverdue ? 'badge-overdue' : 'badge-borrowed'}`}>
                        {isOverdue ? 'Quá hạn' : 'Đang mượn'}
                      </span>
                      <button
                        type="button"
                        className="auth-btn-primary"
                        style={{
                          width: 'auto',
                          padding: '0 14px',
                          height: '32px',
                          fontSize: '12px',
                          marginTop: 0,
                          backgroundColor: canRenew ? '#6e472a' : '#dcd3c6',
                          cursor: canRenew ? 'pointer' : 'not-allowed'
                        }}
                        disabled={!canRenew || renewingId === loan.id}
                        onClick={() => handleRenew(loan.id)}
                        title={
                          renewCount >= 2
                            ? 'Đã đạt tối đa 2 lần gia hạn'
                            : isOverdue
                            ? 'Sách quá hạn không thể gia hạn'
                            : 'Gia hạn thêm 14 ngày'
                        }
                      >
                        {renewingId === loan.id ? 'Đang gia hạn...' : 'Gia hạn (+14 ngày)'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="reader-card">
          {historyLoans.length === 0 ? (
            <p style={{ margin: 0, color: '#6e665e', textAlign: 'center', padding: '24px 0' }}>
              Chưa có lịch sử mượn trả nào.
            </p>
          ) : (
            <div>
              {historyLoans.map((loan) => {
                const book = loan.copies?.books
                return (
                  <div key={loan.id} className="loan-item-card">
                    <div className="loan-item-info">
                      <h4>{book?.title || 'Sách thư viện'}</h4>
                      <div className="loan-item-sub">
                        <span>Tác giả: {book?.authors?.join(', ') || 'N/A'}</span>
                        <span>Ngày trả: {loan.returned_at ? new Date(loan.returned_at).toLocaleDateString('vi-VN') : 'Đã hoàn tất'}</span>
                      </div>
                      {loan.isReviewed && (
                        <div style={{ marginTop: '6px', fontSize: '13px', color: '#f59e0b' }}>
                          ★ Bạn đã đánh giá: {loan.userRating}/5 sao
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                      <span className="badge-status badge-returned">Đã trả</span>
                      <button
                        type="button"
                        className="auth-btn-primary"
                        style={{
                          width: 'auto',
                          padding: '0 14px',
                          height: '32px',
                          fontSize: '12px',
                          marginTop: 0,
                          backgroundColor: loan.isReviewed ? '#8c827a' : '#f59e0b',
                          color: '#ffffff'
                        }}
                        onClick={() =>
                          setReviewModalData({
                            loanItemId: loan.id,
                            bookTitle: book?.title || 'Sách'
                          })
                        }
                      >
                        {loan.isReviewed ? 'Sửa đánh giá' : '★ Viết đánh giá'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {reviewModalData && (
        <BookReviewModal
          loanItemId={reviewModalData.loanItemId}
          bookTitle={reviewModalData.bookTitle}
          onClose={() => setReviewModalData(null)}
          onSuccess={handleReviewSubmit}
        />
      )}
    </div>
  )
}
