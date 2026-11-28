import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { api } from '../../../lib/api'

export function ReservationsPage() {
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)

  const loadReservations = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id,
          queue_position,
          status,
          hold_until,
          created_at,
          books (
            id,
            title,
            authors,
            cover_url,
            collection
          )
        `)
        .eq('uid', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setReservations(data || [])
    } catch (err) {
      console.error('Error loading reservations:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReservations()
  }, [])

  const handleCancelReservation = async (reservationId) => {
    if (!window.confirm('Are you sure you want to cancel this reservation?')) return

    setCancellingId(reservationId)
    setMessage(null)

    try {
      const response = await api.invoke('cancel-reservation', {
        reservation_id: reservationId,
        reason: 'Student cancelled the request',
      })

      if (!response?.success) throw new Error(response?.message || 'Unable to cancel the reservation.')

      setMessage({ type: 'success', text: 'Reservation cancelled successfully.' })
      await loadReservations()
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Unable to cancel the reservation.' })
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', color: '#241e19' }}>Reservations</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6e665e' }}>
            Track your queue position and books ready for pickup at the counter.
          </p>
        </div>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', background: message.type === 'success' ? '#e8f5e9' : '#ffebee', color: message.type === 'success' ? '#2e7d32' : '#c62828', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
          {message.text}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#6e665e' }}>Loading reservations...</p>
      ) : (
        <div className="reader-card">
          {reservations.length === 0 ? (
            <p style={{ margin: 0, color: '#6e665e', textAlign: 'center', padding: '24px 0' }}>
              You have no reserved books.
            </p>
          ) : (
            <div>
              {reservations.map((res) => {
                const book = res.books
                const isReady = res.status === 'ready_for_pickup'
                const isWaiting = res.status === 'waiting'
                const canCancel = isReady || isWaiting

                return (
                  <div key={res.id} className="loan-item-card">
                    <div className="loan-item-info">
                      <h4>
                        {book?.title || 'Book'}
                        {book?.collection === 'premium' && (
                          <span style={{ marginLeft: '8px', fontSize: '11px', color: '#6e472a', fontWeight: 600 }}>
                            (Premium)
                          </span>
                        )}
                      </h4>
                      <div className="loan-item-sub">
                        <span>Author: {book?.authors?.join(', ') || 'N/A'}</span>
                        <span>Reserved: {new Date(res.created_at).toLocaleDateString('vi-VN')}</span>
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '13px' }}>
                        {isWaiting && (
                          <span style={{ color: '#6e472a', fontWeight: 600 }}>
                            Queue position: #{res.queue_position || 1}
                          </span>
                        )}
                        {isReady && (
                          <span style={{ color: '#2e7d32', fontWeight: 600 }}>
                            🎉 Your book is ready at the counter! Hold until:{' '}
                            {res.hold_until ? new Date(res.hold_until).toLocaleString('vi-VN') : '48 hours'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                      <span
                        className={`badge-status ${
                          isReady
                            ? 'badge-borrowed'
                            : isWaiting
                            ? 'badge-pending'
                            : 'badge-returned'
                        }`}
                      >
                        {isReady ? 'Ready for pickup' : isWaiting ? 'Waiting' : res.status}
                      </span>
                      {canCancel && (
                        <button
                          type="button"
                          className="auth-btn-primary"
                          style={{
                            width: 'auto',
                            padding: '0 12px',
                            height: '30px',
                            fontSize: '12px',
                            marginTop: 0,
                            backgroundColor: '#ffffff',
                            color: '#b3261e',
                            border: '1px solid #e0c8b6'
                          }}
                          disabled={cancellingId === res.id}
                          onClick={() => handleCancelReservation(res.id)}
                        >
                          {cancellingId === res.id ? 'Cancelling...' : 'Cancel Reservation'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
