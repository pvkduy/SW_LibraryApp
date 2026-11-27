import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { api } from '../../../lib/api'
import { FinesPage } from '../fines/FinesPage.jsx'
import { BookReviewPage } from './BookReviewPage.jsx'

const ACTIVE_STATUSES = ['borrowed', 'overdue']
const QUOTA_STATUSES = ['awaiting_payment', 'payment_failed', 'ready_for_pickup', 'borrowed', 'overdue']
const HISTORY_STATUSES = ['returned', 'lost']
const STATUS_LABELS = {
  awaiting_payment: 'Payment due',
  payment_failed: 'Payment failed',
  ready_for_pickup: 'Ready for pickup',
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getDaysRemaining(dueDate, now) {
  if (!dueDate) return null
  const due = new Date(dueDate)
  const today = new Date(now)
  if (Number.isNaN(due.getTime())) return null
  due.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - today.getTime()) / 86400000)
}

export function LoansPage({ maxItems = 5, onProfileRefresh, profile }) {
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('active')
  const [reviewLoan, setReviewLoan] = useState(null)
  const [message, setMessage] = useState(null)
  const [renewingId, setRenewingId] = useState(null)
  const [now] = useState(() => new Date())

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
          handover_at,
          due_at,
          due_date,
          returned_at,
          renew_count,
          payment_deadline,
          pickup_deadline,
          copies (
            id,
            barcode,
            books (
              id,
              title,
              authors,
              collection,
              cover_path
            )
          )
        `)
        .eq('uid', user.id)
        .order('handover_at', { ascending: false })

      if (error) throw error

      const { data: reviewRows, error: reviewError } = await supabase
        .from('book_reviews')
        .select('loan_item_id, rating, headline, comment')
        .eq('uid', user.id)

      if (reviewError) throw reviewError

      const reviewsByLoan = Object.fromEntries(
        (reviewRows || []).filter((review) => review.loan_item_id).map((review) => [review.loan_item_id, review]),
      )

      setLoans((data || []).map((item) => ({
        ...item,
        due_date: item.due_date || item.due_at,
        review: reviewsByLoan[item.id] || null,
      })))
    } catch (err) {
      console.error('Error loading loans:', err)
      setMessage({ type: 'error', text: 'Could not load your loans. Please try again.' })
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
      const data = await api.invoke('renew-loan', { loan_item_id: loanItemId })
      if (!data?.success) throw new Error(data?.message || 'Renewal failed.')

      setMessage({ type: 'success', text: data.message || 'Renewal successful.' })
      await loadLoans()
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Renewal failed.' })
    } finally {
      setRenewingId(null)
    }
  }

  const handleReviewSubmit = async (loanItemId, rating, headline, comment) => {
    const data = await api.invoke('submit-book-review', {
      loan_item_id: loanItemId,
      rating,
      comment,
      headline,
    })
    if (!data?.success) throw new Error(data?.message || 'Review could not be submitted.')

    await loadLoans()
  }

  const activeLoans = loans.filter((loan) => ACTIVE_STATUSES.includes(loan.status))
  const pendingLoans = loans.filter((loan) =>
    ['awaiting_payment', 'payment_failed', 'ready_for_pickup'].includes(loan.status),
  )
  const quotaUsed = loans.filter((loan) => QUOTA_STATUSES.includes(loan.status)).length
  const historyLoans = loans.filter((loan) => HISTORY_STATUSES.includes(loan.status))
  const dueSoonCount = activeLoans.filter((loan) => {
    const daysRemaining = getDaysRemaining(loan.due_date, now)
    return daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 3
  }).length

  if (reviewLoan) {
    return (
      <BookReviewPage
        loan={reviewLoan}
        onBack={() => setReviewLoan(null)}
        onSubmit={handleReviewSubmit}
      />
    )
  }

  return (
    <div className="my-loans-page">
      {message && (
        <div className={`my-loans-message ${message.type}`} role="status">
          {message.text}
        </div>
      )}

      <div className="my-loans-tabs" role="tablist" aria-label="My loans sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'active'}
          className={activeTab === 'active' ? 'active' : ''}
          onClick={() => setActiveTab('active')}
        >
          Active Loans <span>{activeLoans.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'history'}
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
        >
          History <span>{historyLoans.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'fines'}
          className={activeTab === 'fines' ? 'active' : ''}
          onClick={() => setActiveTab('fines')}
        >
          Fines
        </button>
      </div>

      {activeTab === 'fines' ? (
        <FinesPage embedded profile={profile} onProfileRefresh={onProfileRefresh} />
      ) : loading ? (
        <p className="my-loans-empty">Loading your loans…</p>
      ) : activeTab === 'active' ? (
        <>
          <section className="my-loans-quota" aria-label="Borrowing quota">
            <div className="my-loans-quota-icon" aria-hidden="true">▤</div>
            <div className="my-loans-quota-copy">
              <span>Borrowing Quota</span>
              <strong>{quotaUsed} of {maxItems} items in use</strong>
              <small>
                {activeLoans.length} currently on loan
                {pendingLoans.length > 0 && ` · ${pendingLoans.length} pending payment or pickup`}
              </small>
            </div>
            <div className="my-loans-quota-meter" aria-hidden="true">
              <span style={{ width: `${Math.min(100, maxItems > 0 ? (quotaUsed / maxItems) * 100 : 0)}%` }} />
            </div>
          </section>

          {dueSoonCount > 0 && (
            <div className="my-loans-due-alert" role="status">
              <span aria-hidden="true">!</span>
              <div><strong>Due soon</strong><small>{dueSoonCount} {dueSoonCount === 1 ? 'book is' : 'books are'} due within 3 days. Renew now to avoid fines.</small></div>
            </div>
          )}

          {activeLoans.length === 0 ? (
            <div className="my-loans-empty">You don’t have any active loans right now.</div>
          ) : (
            <div className="my-loans-list">
              {activeLoans.map((loan) => {
                const book = loan.copies?.books
                const daysRemaining = getDaysRemaining(loan.due_date, now)
                const isOverdue = loan.status === 'overdue' || (daysRemaining !== null && daysRemaining < 0)
                const renewCount = loan.renew_count || 0
                const canRenew = renewCount < 2 && !isOverdue && loan.status === 'borrowed'
                const totalDays = loan.handover_at && loan.due_date
                  ? Math.max(1, Math.ceil((new Date(loan.due_date) - new Date(loan.handover_at)) / 86400000))
                  : 14
                const elapsedDays = loan.handover_at
                  ? Math.max(0, Math.floor((now.getTime() - new Date(loan.handover_at).getTime()) / 86400000))
                  : 0
                const progress = Math.min(100, Math.round((elapsedDays / totalDays) * 100))

                return (
                  <article key={loan.id} className={`my-loan-card ${isOverdue ? 'overdue' : ''}`}>
                    <div className="my-loan-cover">
                      {book?.cover_path
                        ? <img src={book.cover_path} alt="" />
                        : <span aria-hidden="true">{book?.title?.slice(0, 1) || 'B'}</span>}
                    </div>
                    <div className="my-loan-main">
                      <div className="my-loan-heading">
                        <div>
                          <h2>{book?.title || 'Library book'}</h2>
                          <p>{book?.authors?.join(', ') || 'Unknown author'}</p>
                        </div>
                        <span className={`my-loan-status ${isOverdue ? 'overdue' : loan.status === 'borrowed' ? 'borrowed' : 'pending'}`}>
                          {isOverdue ? 'Overdue' : STATUS_LABELS[loan.status] || 'Borrowed'}
                        </span>
                      </div>
                      <div className="my-loan-due-row">
                        <span>Due date <strong>{formatDate(loan.due_date)}</strong></span>
                        <span className={isOverdue || (daysRemaining !== null && daysRemaining <= 3) ? 'urgent' : ''}>
                          {isOverdue
                            ? daysRemaining === null ? 'Overdue' : `${Math.abs(daysRemaining)} days overdue`
                            : daysRemaining === null ? '—' : `${daysRemaining} days left`}
                        </span>
                      </div>
                      <div className="my-loan-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                        <span style={{ width: `${progress}%` }} />
                      </div>
                      <div className="my-loan-card-footer">
                        {['borrowed', 'overdue'].includes(loan.status) && (
                          <>
                            <span>Renewals: {renewCount}/2</span>
                            <button
                              type="button"
                              disabled={!canRenew || renewingId === loan.id}
                              onClick={() => handleRenew(loan.id)}
                            >
                              {renewingId === loan.id ? 'Renewing…' : 'Renew loan'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {pendingLoans.length > 0 && (
            <section className="my-loans-pending">
              <h2>Pending checkout</h2>
              <p>These items are not on loan yet, but they count toward your borrowing limit.</p>
              {pendingLoans.map((loan) => {
                const book = loan.copies?.books
                const pendingUntil = loan.status === 'ready_for_pickup'
                  ? loan.pickup_deadline
                  : loan.payment_deadline

                return (
                  <div key={loan.id} className="my-loans-pending-item">
                    <div>
                      <strong>{book?.title || 'Library book'}</strong>
                      <span>{book?.authors?.join(', ') || 'Unknown author'}</span>
                    </div>
                    <div className="my-loans-pending-status">
                      <span>{STATUS_LABELS[loan.status]}</span>
                      {pendingUntil && <small>Until {formatDate(pendingUntil)}</small>}
                    </div>
                  </div>
                )
              })}
            </section>
          )}
        </>
      ) : historyLoans.length === 0 ? (
        <div className="my-loans-empty">Your returned books and reviews will appear here.</div>
      ) : (
        <div className="my-loans-list">
          {historyLoans.map((loan) => {
            const book = loan.copies?.books
            return (
              <article key={loan.id} className="my-loan-card history">
                <div className="my-loan-cover">
                  {book?.cover_path
                    ? <img src={book.cover_path} alt="" />
                    : <span aria-hidden="true">{book?.title?.slice(0, 1) || 'B'}</span>}
                </div>
                <div className="my-loan-main">
                  <div className="my-loan-heading">
                    <div>
                      <h2>{book?.title || 'Library book'}</h2>
                      <p>{book?.authors?.join(', ') || 'Unknown author'}</p>
                    </div>
                    <span className={`my-loan-status ${loan.status === 'lost' ? 'overdue' : 'returned'}`}>
                      {loan.status === 'lost' ? 'Lost' : 'Returned'}
                    </span>
                  </div>
                  <div className="my-loan-due-row">
                    <span>Returned <strong>{formatDate(loan.returned_at)}</strong></span>
                    <span>{loan.copies?.barcode || ''}</span>
                  </div>
                  <div className="my-loan-card-footer">
                    {loan.review ? (
                      <span className="my-loan-review-submitted">
                        ★ Review submitted · {loan.review.rating}/5
                      </span>
                    ) : (
                      <span className="my-loan-review-prompt">Enjoyed this book? Share your thoughts.</span>
                    )}
                    {!loan.review && loan.status === 'returned' && (
                      <button type="button" onClick={() => setReviewLoan(loan)}>
                        Write a review
                      </button>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
