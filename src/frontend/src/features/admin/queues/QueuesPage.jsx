import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { api } from '../../../lib/api'
import { IconRefresh } from '../components/AdminIcons'

export function QueuesPage() {
  const [reservations, setReservations] = useState([])
  const [selectedRes, setSelectedRes] = useState(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('The student is unavailable and cannot collect the book.')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionFeedback, setActionFeedback] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const loadQueues = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id, status, queue_position, hold_until, pickup_code, cancellation_reason, created_at,
          books ( id, title, authors, replacement_price, shelf_location, isbn13, total_copies, available_copies ),
          copies ( id, barcode, status, shelf_location ),
          profiles ( id, full_name, student_id, email, debt_outstanding, status, reservation_ban_until )
        `)
        .order('created_at', { ascending: true })

      if (error) console.error('Error fetching reservations:', error)
      else {
        setReservations(data || [])
        setSelectedRes((prev) => prev || (data && data[0]) || null)
      }
    } catch (err) {
      console.error(err)
    }
  }, [])

  useEffect(() => {
    loadQueues()
  }, [loadQueues])

  const readyHoldsCount = reservations.filter((r) => r.status === 'ready_for_pickup').length
  const waitingBacklogCount = reservations.filter((r) => r.status === 'waiting').length

  const filteredReservations = reservations.filter((r) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    const title = r.books?.title?.toLowerCase() || ''
    const student = r.profiles?.full_name?.toLowerCase() || ''
    const studentId = r.profiles?.student_id?.toLowerCase() || ''
    return title.includes(q) || student.includes(q) || studentId.includes(q)
  })

  // Handle Staff Cancel Reservation (Calls Edge Function cancel-reservation, FR-RES-05 / UC-29)
  const handleCancelStaff = async () => {
    if (!selectedRes) return
    setActionLoading(true)
    setActionFeedback(null)

    try {
      const res = await api.invoke('cancel-reservation', {
        reservation_id: selectedRes.id,
        reason: cancelReason,
      })

      setActionFeedback({
        type: 'success',
        message: res.message || 'Reservation cancelled successfully. The book was offered to the next eligible reader in the queue when available.',
      })
      setShowCancelModal(false)
      await loadQueues()
    } catch (err) {
      setActionFeedback({ type: 'error', message: err.message })
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Title */}
      <div className="admin-page-title-row">
        <div>
          <h1 className="admin-page-title">Queues & Reminders</h1>
          <div className="admin-page-desc">
            Real-time reservation backlog oversight and patron overdue notification dispatch (UC-29)
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <div>
            <div className="admin-kpi-label">Active Backlog</div>
            <div className="admin-kpi-value">{waitingBacklogCount}</div>
          </div>
          <div className="admin-kpi-badge" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
            👥
          </div>
        </div>

        <div className="admin-kpi-card">
          <div>
            <div className="admin-kpi-label">Ready for Pickup</div>
            <div className="admin-kpi-value" style={{ color: '#d97706' }}>
              {readyHoldsCount}
            </div>
          </div>
          <div className="admin-kpi-badge" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
            📦
          </div>
        </div>

        <div className="admin-kpi-card">
          <div>
            <div className="admin-kpi-label">Hold Policy</div>
            <div className="admin-kpi-value" style={{ fontSize: '24px' }}>
              48h FIFO
            </div>
          </div>
          <div className="admin-kpi-badge" style={{ backgroundColor: '#e0e7ff', color: '#3730a3' }}>
            ⏱️
          </div>
        </div>

        <div className="admin-kpi-card">
          <div>
            <div className="admin-kpi-label">Strikes Threshold</div>
            <div className="admin-kpi-value" style={{ fontSize: '24px' }}>
              3 Strikes
            </div>
          </div>
          <div className="admin-kpi-badge" style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>
            🚫
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="admin-search-bar-wrap">
        <input
          type="text"
          placeholder="Filter by book title, student name, or student ID..."
          style={{ border: 'none', outline: 'none', width: '100%', fontSize: '17px', fontFamily: 'inherit' }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button type="button" className="admin-btn-outline" onClick={loadQueues}>
          <IconRefresh size={14} /> Refresh
        </button>
      </div>

      {/* Feedback banner */}
      {actionFeedback && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: actionFeedback.type === 'error' ? '#fee2e2' : '#dcfce7',
            color: actionFeedback.type === 'error' ? '#991b1b' : '#166534',
            fontWeight: 600,
            fontSize: '16px',
          }}
        >
          {actionFeedback.message}
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="admin-work-layout">
        {/* Left: Table of Queues */}
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Book Title & Details</th>
                <th>Queue Pos</th>
                <th>Top Patron in Line</th>
                <th>Hold State</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredReservations.map((res) => {
                const isSelected = selectedRes?.id === res.id
                return (
                  <tr
                    key={res.id}
                    className={isSelected ? 'selected' : ''}
                    onClick={() => setSelectedRes(res)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div style={{ fontWeight: 700, color: '#241e19' }}>{res.books?.title}</div>
                      <div style={{ fontSize: '13px', color: '#72685e' }}>
                        {res.books?.authors?.join(', ')} · ISBN: {res.books?.isbn13}
                      </div>
                    </td>

                    <td>
                      <div style={{ fontWeight: 700, color: '#6e472a', fontSize: '17px' }}>
                        {res.status === 'ready_for_pickup' ? 'Ready (Hold)' : `#${res.queue_position || 1}`}
                      </div>
                      <div style={{ fontSize: '13px', color: '#9d9388' }}>
                        {res.status === 'ready_for_pickup' ? 'Held for Pickup' : 'Waiting'}
                      </div>
                    </td>

                    <td>
                      <div style={{ fontWeight: 600 }}>{res.profiles?.full_name || 'Student'}</div>
                      <div style={{ fontSize: '13px', color: '#72685e' }}>
                        MSSV: {res.profiles?.student_id || 'N/A'}
                        {res.profiles?.debt_outstanding > 0 && (
                          <span style={{ color: '#dc2626', fontWeight: 600, marginLeft: '4px' }}>(Debt)</span>
                        )}
                      </div>
                    </td>

                    <td>
                      {res.status === 'ready_for_pickup' && (
                        <div>
                          <span className="admin-badge admin-badge-ready">Ready for Pickup</span>
                          <div style={{ fontSize: '13px', color: '#92400e', marginTop: '2px' }}>
                            Deadline: {res.hold_until ? new Date(res.hold_until).toLocaleDateString('vi-VN') : '48h'}
                          </div>
                        </div>
                      )}
                      {res.status === 'waiting' && (
                        <span className="admin-badge admin-badge-gray">Waiting Return</span>
                      )}
                      {res.status === 'cancelled' && (
                        <span className="admin-badge admin-badge-overdue">Cancelled</span>
                      )}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="admin-btn-outline"
                        style={{ padding: '4px 10px', fontSize: '13px' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedRes(res)
                        }}
                      >
                        Details →
                      </button>
                    </td>
                  </tr>
                )
              })}

              {filteredReservations.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: '#72685e' }}>
                    No reservation queue entries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Right Drawer: Queue Detail Allocation */}
        <div className="admin-drawer">
          <div style={{ fontSize: '19px', fontWeight: 700, color: '#241e19' }}>Queue Detail Allocation</div>

          {selectedRes ? (
            <>
              {/* Book Info */}
              <div className="admin-drawer-box">
                <div style={{ fontWeight: 700, fontSize: '18px' }}>{selectedRes.books?.title}</div>
                <div style={{ fontSize: '14px', color: '#72685e', marginBottom: '8px' }}>
                  {selectedRes.books?.authors?.join(', ')}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span className="admin-badge admin-badge-ready">
                    {selectedRes.status === 'ready_for_pickup' ? 'Held at Counter' : 'Waiting to Borrow'}
                  </span>
                  {selectedRes.copies?.barcode && (
                    <span style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 600 }}>
                      Copy: {selectedRes.copies.barcode}
                    </span>
                  )}
                </div>
              </div>

              {/* Patron Info */}
              <div className="admin-drawer-box">
                <div className="admin-drawer-box-title">Reserved Reader Information</div>
                <div style={{ fontSize: '17px', fontWeight: 700 }}>{selectedRes.profiles?.full_name}</div>
                <div style={{ fontSize: '14px', color: '#72685e' }}>
                  MSSV: {selectedRes.profiles?.student_id} · Email: {selectedRes.profiles?.email}
                </div>
                {selectedRes.pickup_code && (
                  <div style={{ marginTop: '8px', fontSize: '16px', fontWeight: 700, color: '#6e472a' }}>
                    Pickup Code: {selectedRes.pickup_code}
                  </div>
                )}
                {selectedRes.hold_until && (
                  <div style={{ marginTop: '4px', fontSize: '14px', color: '#92400e' }}>
                    Hold deadline: {new Date(selectedRes.hold_until).toLocaleString('vi-VN')}
                  </div>
                )}
              </div>

              {/* Staff Actions */}
              {selectedRes.status !== 'cancelled' && selectedRes.status !== 'fulfilled' && (
                <div style={{ borderTop: '1px solid #ede6db', paddingTop: '12px' }}>
                  <button
                    type="button"
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid #dc2626',
                      backgroundColor: '#fee2e2',
                      color: '#dc2626',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '16px',
                    }}
                    onClick={() => setShowCancelModal(true)}
                  >
                    ✕ Cancel Reservation
                  </button>
                  <div style={{ fontSize: '13px', color: '#72685e', marginTop: '6px', textAlign: 'center' }}>
                    * Librarian cancellation does not add a reservation strike.
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', color: '#72685e', padding: '40px 0' }}>
              Select a queue entry to view details.
            </div>
          )}
        </div>
      </div>

      {/* Modal Cancel Reservation */}
      {showCancelModal && selectedRes && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '24px',
              width: '420px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3 style={{ margin: '0 0 8px 0', fontSize: '22px', color: '#dc2626' }}>Confirm Reservation Cancellation</h3>
            <p style={{ fontSize: '16px', color: '#72685e', margin: '0 0 16px 0' }}>
              You are cancelling the reservation for "<strong>{selectedRes.books?.title}</strong>" by student{' '}
              <strong>{selectedRes.profiles?.full_name}</strong>.
            </p>

            <label style={{ fontSize: '14px', fontWeight: 600, color: '#241e19', display: 'block', marginBottom: '6px' }}>
              Cancellation reason (required):
            </label>
            <textarea
              rows="3"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid #dcd3c5',
                fontSize: '16px',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                marginBottom: '16px',
              }}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="admin-btn-outline"
                onClick={() => setShowCancelModal(false)}
                disabled={actionLoading}
              >
                Close
              </button>
              <button
                type="button"
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontWeight: 600,
                  fontSize: '16px',
                  cursor: 'pointer',
                }}
                disabled={actionLoading}
                onClick={handleCancelStaff}
              >
                {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
