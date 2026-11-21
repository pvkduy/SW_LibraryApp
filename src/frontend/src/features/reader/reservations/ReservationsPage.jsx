import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'

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
    if (!window.confirm('Bạn có chắc chắn muốn hủy đặt trước cuốn sách này không?')) return

    setCancellingId(reservationId)
    setMessage(null)

    try {
      const { data, error } = await supabase.rpc('rpc_cancel_reservation_staff', {
        p_reservation_id: reservationId,
        p_reason: 'Sinh viên tự hủy yêu cầu'
      })

      if (error) throw error
      if (data?.error) throw new Error(data.message || data.error)

      setMessage({ type: 'success', text: 'Đã hủy đặt trước sách thành công.' })
      await loadReservations()
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Không thể hủy đặt trước.' })
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', color: '#241e19' }}>Danh sách Đặt trước (Reservations)</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6e665e' }}>
            Theo dõi vị trí hàng đợi và các cuốn sách đã sẵn sàng nhận tại quầy.
          </p>
        </div>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', background: message.type === 'success' ? '#e8f5e9' : '#ffebee', color: message.type === 'success' ? '#2e7d32' : '#c62828', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
          {message.text}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#6e665e' }}>Đang tải danh sách đặt trước...</p>
      ) : (
        <div className="reader-card">
          {reservations.length === 0 ? (
            <p style={{ margin: 0, color: '#6e665e', textAlign: 'center', padding: '24px 0' }}>
              Bạn chưa đặt trước cuốn sách nào.
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
                        {book?.title || 'Sách'}
                        {book?.collection === 'premium' && (
                          <span style={{ marginLeft: '8px', fontSize: '11px', color: '#6e472a', fontWeight: 600 }}>
                            (Premium)
                          </span>
                        )}
                      </h4>
                      <div className="loan-item-sub">
                        <span>Tác giả: {book?.authors?.join(', ') || 'N/A'}</span>
                        <span>Ngày đặt: {new Date(res.created_at).toLocaleDateString('vi-VN')}</span>
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '13px' }}>
                        {isWaiting && (
                          <span style={{ color: '#6e472a', fontWeight: 600 }}>
                            Vị trí trong hàng đợi: #{res.queue_position || 1}
                          </span>
                        )}
                        {isReady && (
                          <span style={{ color: '#2e7d32', fontWeight: 600 }}>
                            🎉 Sách đã sẵn sàng tại quầy! Giữ đến:{' '}
                            {res.hold_until ? new Date(res.hold_until).toLocaleString('vi-VN') : '48 giờ'}
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
                        {isReady ? 'Sẵn sàng nhận' : isWaiting ? 'Đang chờ lượt' : res.status}
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
                          {cancellingId === res.id ? 'Đang hủy...' : 'Hủy đặt trước'}
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
