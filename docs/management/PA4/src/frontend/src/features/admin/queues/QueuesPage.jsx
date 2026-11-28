import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { api } from '../../../lib/api'
import { IconRefresh, IconBell, IconCalendar, IconAlertTriangle } from '../components/AdminIcons'

const HOURS_MS = 3600 * 1000
const DAY_MS = 24 * HOURS_MS
const DAILY_FINE_RATE = 5000

function formatCountdown(iso, nowMs) {
  if (!iso) return { text: 'No deadline', urgent: false, expired: false }
  const diffMs = new Date(iso).getTime() - nowMs
  if (diffMs <= 0) return { text: 'Expired', urgent: true, expired: true }
  const totalHours = Math.floor(diffMs / HOURS_MS)
  const mins = Math.floor((diffMs % HOURS_MS) / 60000)
  return {
    text: `${totalHours}h ${mins}m left`,
    urgent: diffMs <= 12 * HOURS_MS,
    expired: false,
  }
}

function getIsoWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d - yearStart) / DAY_MS) + 1) / 7)
  const monday = new Date(date)
  const offset = (monday.getDay() + 6) % 7
  monday.setDate(monday.getDate() - offset)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (dt) => dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  return {
    key: `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`,
    label: `Week ${weekNo} (${fmt(monday)} – ${fmt(sunday)})`,
    sortTime: monday.getTime(),
  }
}

function getDayGroupMeta(dueIso, nowDate) {
  const due = new Date(dueIso)
  const startOfToday = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate())
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const diffDays = Math.round((startOfDue.getTime() - startOfToday.getTime()) / DAY_MS)
  const dateLabel = due.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })

  if (diffDays < 0) {
    const past = Math.abs(diffDays)
    return {
      key: `overdue-${past}-${startOfDue.toISOString().slice(0, 10)}`,
      label: `Overdue: ${past} day${past === 1 ? '' : 's'} past due (${dateLabel})`,
      sortTime: startOfDue.getTime(),
      tone: 'danger',
    }
  }
  if (diffDays === 0) {
    return { key: `day-today`, label: `Due Today (${dateLabel})`, sortTime: startOfDue.getTime(), tone: 'warn' }
  }
  if (diffDays === 1) {
    return { key: `day-tomorrow`, label: `Due Tomorrow (${dateLabel})`, sortTime: startOfDue.getTime(), tone: 'warn' }
  }
  return {
    key: `day-${startOfDue.toISOString().slice(0, 10)}`,
    label: `Due ${dateLabel} (in ${diffDays} days)`,
    sortTime: startOfDue.getTime(),
    tone: 'neutral',
  }
}

function renderReservationBadge(status) {
  const map = {
    ready_for_pickup: { cls: 'admin-badge-ready', label: 'Ready for Pickup' },
    waiting: { cls: 'admin-badge-gray', label: 'Waiting Return' },
    fulfilled: { cls: 'admin-badge-borrowed', label: 'Fulfilled' },
    cancelled: { cls: 'admin-badge-overdue', label: 'Cancelled' },
    expired: { cls: 'admin-badge-overdue', label: 'Expired' },
  }
  const entry = map[status] || { cls: 'admin-badge-gray', label: status }
  return <span className={`admin-badge ${entry.cls}`}>{entry.label}</span>
}

export function QueuesPage() {
  const [sectionTab, setSectionTab] = useState('queues') // 'queues' (UC-29) | 'reminders' (UC-30)
  const [nowMs, setNowMs] = useState(() => Date.now())

  // ---------------- UC-29 Queues state ----------------
  const [reservations, setReservations] = useState([])
  const [selectedRes, setSelectedRes] = useState(null)
  const [queueFilter, setQueueFilter] = useState('active') // 'active' | 'ready_for_pickup' | 'waiting' | 'closed' | 'all'
  const [queueView, setQueueView] = useState('grouped') // 'grouped' | 'flat'
  const [collapsedBooks, setCollapsedBooks] = useState(() => new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelModalError, setCancelModalError] = useState(null)
  const [strikeModalStudent, setStrikeModalStudent] = useState(null)
  const [strikeEvents, setStrikeEvents] = useState([])
  const [strikeLoading, setStrikeLoading] = useState(false)

  // ---------------- UC-30 Reminders state ----------------
  const [reminderLoans, setReminderLoans] = useState([])
  const [reminderGroupBy, setReminderGroupBy] = useState('day') // 'day' | 'week'
  const [reminderFilter, setReminderFilter] = useState('all') // 'all' | 'due_soon' | 'overdue_lt7' | 'overdue_7_14' | 'overdue_gt14'
  const [reminderSearch, setReminderSearch] = useState('')
  const [collapsedReminderGroups, setCollapsedReminderGroups] = useState(() => new Set())
  const [bulkRemindModal, setBulkRemindModal] = useState(null) // { label, loanIds, totalStudents, eligible, skipped }
  const [singleOverrideModal, setSingleOverrideModal] = useState(null) // { loan, lastRemindedAt }

  // Shared feedback & loading
  const [actionLoading, setActionLoading] = useState(false)
  const [actionFeedback, setActionFeedback] = useState(null)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const loadAll = useCallback(async () => {
    setLoadError(null)
    try {
      const [{ data: resData, error: resErr }, { data: loanData, error: loanErr }] = await Promise.all([
        supabase
          .from('reservations')
          .select(`
            id, status, queue_position, hold_until, pickup_code, cancellation_reason, cancelled_at, created_at,
            books ( id, title, authors, replacement_price, shelf_location, isbn13, total_copies, available_copies ),
            copies ( id, barcode, status, shelf_location ),
            profiles:uid ( id, full_name, student_id, email, debt_outstanding, status, reservation_ban_until, reservation_strikes )
          `)
          .order('created_at', { ascending: true }),
        supabase
          .from('loan_items')
          .select(`
            id, uid, status, due_at, due_date, handover_at, last_reminded_at,
            books ( id, title, replacement_price ),
            copies ( id, barcode ),
            profiles:uid ( id, full_name, student_id, email, status, debt_outstanding )
          `)
          .in('status', ['borrowed', 'overdue'])
          .order('due_at', { ascending: true }),
      ])

      if (resErr) throw resErr
      if (loanErr) throw loanErr

      const safeRes = resData || []
      setReservations(safeRes)
      setSelectedRes((prev) => safeRes.find((item) => item.id === prev?.id) || safeRes[0] || null)
      setReminderLoans(loanData || [])
    } catch (err) {
      setLoadError(err?.message || 'Unable to load queues and reminders data.')
    }
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      if (active) await loadAll()
    })()
    return () => { active = false }
  }, [loadAll])

  // ---------------- UC-29 Derived State ----------------
  const readyHoldsCount = reservations.filter((r) => r.status === 'ready_for_pickup').length
  const waitingBacklogCount = reservations.filter((r) => r.status === 'waiting').length
  const expiringSoonCount = reservations.filter(
    (r) => r.status === 'ready_for_pickup' && r.hold_until && (new Date(r.hold_until).getTime() - nowMs) <= 12 * HOURS_MS,
  ).length

  const filteredReservations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return reservations.filter((r) => {
      if (queueFilter === 'active' && !['waiting', 'ready_for_pickup'].includes(r.status)) return false
      if (queueFilter === 'ready_for_pickup' && r.status !== 'ready_for_pickup') return false
      if (queueFilter === 'waiting' && r.status !== 'waiting') return false
      if (queueFilter === 'closed' && !['cancelled', 'fulfilled', 'expired'].includes(r.status)) return false
      if (!q) return true
      return [
        r.books?.title,
        r.books?.isbn13,
        r.profiles?.full_name,
        r.profiles?.student_id,
        r.pickup_code,
      ].some((val) => val?.toLowerCase().includes(q))
    })
  }, [reservations, queueFilter, searchQuery])

  const groupedByBook = useMemo(() => {
    const map = new Map()
    for (const res of filteredReservations) {
      const bookId = res.books?.id || 'unknown'
      if (!map.has(bookId)) {
        map.set(bookId, {
          book: res.books,
          entries: [],
        })
      }
      map.get(bookId).entries.push(res)
    }
    return [...map.values()].map((group) => ({
      ...group,
      waitingCount: group.entries.filter((e) => e.status === 'waiting').length,
      readyCount: group.entries.filter((e) => e.status === 'ready_for_pickup').length,
      entries: [...group.entries].sort((a, b) => {
        if (a.status === 'ready_for_pickup' && b.status !== 'ready_for_pickup') return -1
        if (b.status === 'ready_for_pickup' && a.status !== 'ready_for_pickup') return 1
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }),
    }))
  }, [filteredReservations])

  const openStrikeInspector = async (studentProfile) => {
    if (!studentProfile?.id) return
    setStrikeModalStudent(studentProfile)
    setStrikeLoading(true)
    setStrikeEvents([])
    try {
      const cutoff = new Date(nowMs - 180 * DAY_MS).toISOString()
      const { data } = await supabase
        .from('reservation_strike_events')
        .select('id, reason, occurred_at')
        .eq('uid', studentProfile.id)
        .gte('occurred_at', cutoff)
        .order('occurred_at', { ascending: false })
      setStrikeEvents(data || [])
    } finally {
      setStrikeLoading(false)
    }
  }

  // Handle Staff Cancel Reservation (UC-29 §2.2.2 & §2.2.3)
  const handleCancelStaff = async () => {
    if (!selectedRes) return
    const trimmed = cancelReason.trim()
    if (trimmed.length < 10 || trimmed.length > 500) {
      setCancelModalError('Cancellation reason must be between 10 and 500 characters (UC-29).')
      return
    }
    setActionLoading(true)
    setCancelModalError(null)
    setActionFeedback(null)

    try {
      const res = await api.invoke('cancel-reservation', {
        reservation_id: selectedRes.id,
        reason: trimmed,
      })

      setActionFeedback({
        type: 'success',
        message: res.data?.promoted_reservation_id
          ? 'Reservation cancelled without strike. Next waiting member was automatically promoted to Ready for Pickup.'
          : (res.message || 'Reservation cancelled successfully without adding a strike.'),
      })
      setShowCancelModal(false)
      setCancelReason('')
      await loadAll()
    } catch (err) {
      setCancelModalError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // ---------------- UC-30 Derived State ----------------
  const nowDate = useMemo(() => new Date(nowMs), [nowMs])

  const enrichedReminders = useMemo(() => {
    const q = reminderSearch.trim().toLowerCase()
    return reminderLoans
      .map((loan) => {
        const dueIso = loan.due_at || loan.due_date
        const dueDate = dueIso ? new Date(dueIso) : null
        const overdueDays = dueDate && nowMs > dueDate.getTime()
          ? Math.max(1, Math.ceil((nowMs - dueDate.getTime()) / DAY_MS))
          : 0
        const daysUntilDue = dueDate && nowMs <= dueDate.getTime()
          ? Math.ceil((dueDate.getTime() - nowMs) / DAY_MS)
          : -overdueDays
        const replacementPrice = Number(loan.books?.replacement_price || 0)
        const accruedFine = overdueDays > 0
          ? (replacementPrice > 0 ? Math.min(overdueDays * DAILY_FINE_RATE, replacementPrice) : overdueDays * DAILY_FINE_RATE)
          : 0
        const remindedRecently = Boolean(
          loan.last_reminded_at && (nowMs - new Date(loan.last_reminded_at).getTime()) < DAY_MS,
        )
        return {
          ...loan,
          dueIso,
          overdueDays,
          daysUntilDue,
          accruedFine,
          remindedRecently,
          approachingLost: overdueDays >= 45,
        }
      })
      .filter((loan) => {
        if (reminderFilter === 'due_soon' && !(loan.overdueDays === 0 && loan.daysUntilDue <= 2)) return false
        if (reminderFilter === 'overdue_lt7' && !(loan.overdueDays > 0 && loan.overdueDays < 7)) return false
        if (reminderFilter === 'overdue_7_14' && !(loan.overdueDays >= 7 && loan.overdueDays <= 14)) return false
        if (reminderFilter === 'overdue_gt14' && !(loan.overdueDays > 14)) return false
        if (!q) return true
        return [
          loan.profiles?.full_name,
          loan.profiles?.student_id,
          loan.books?.title,
          loan.copies?.barcode,
        ].some((val) => val?.toLowerCase().includes(q))
      })
  }, [reminderLoans, reminderFilter, reminderSearch, nowMs])

  const reminderGroups = useMemo(() => {
    const buckets = new Map()
    for (const loan of enrichedReminders) {
      if (!loan.dueIso) continue
      const meta = reminderGroupBy === 'week'
        ? { ...getIsoWeekKey(new Date(loan.dueIso)), tone: loan.overdueDays > 0 ? 'danger' : 'neutral' }
        : getDayGroupMeta(loan.dueIso, nowDate)
      if (!buckets.has(meta.key)) {
        buckets.set(meta.key, { ...meta, items: [] })
      }
      buckets.get(meta.key).items.push(loan)
    }
    return [...buckets.values()].sort((a, b) => a.sortTime - b.sortTime)
  }, [enrichedReminders, reminderGroupBy, nowDate])

  const openBulkRemindPreview = (items, label) => {
    if (!items.length) return
    const byStudent = new Map()
    for (const item of items) {
      const prev = byStudent.get(item.uid)
      const recent = item.remindedRecently
      byStudent.set(item.uid, Boolean(prev || recent))
    }
    const totalStudents = byStudent.size
    const skipped = [...byStudent.values()].filter(Boolean).length
    const eligible = totalStudents - skipped
    setBulkRemindModal({
      label,
      loanIds: items.map((item) => item.id),
      totalStudents,
      eligible,
      skipped,
    })
  }

  const handleConfirmBulkRemind = async () => {
    if (!bulkRemindModal) return
    setActionLoading(true)
    setActionFeedback(null)
    try {
      const res = await api.invoke('send-reminders', {
        loan_item_ids: bulkRemindModal.loanIds,
        mode: 'bulk',
      })
      setActionFeedback({ type: 'success', message: res.message })
      setBulkRemindModal(null)
      await loadAll()
    } catch (err) {
      setActionFeedback({ type: 'error', message: err.message })
      setBulkRemindModal(null)
    } finally {
      setActionLoading(false)
    }
  }

  const handleSingleRemind = async (loan, force = false) => {
    if (!force && loan.remindedRecently) {
      setSingleOverrideModal({ loan, lastRemindedAt: loan.last_reminded_at })
      return
    }
    setActionLoading(true)
    setActionFeedback(null)
    try {
      const res = await api.invoke('send-reminders', {
        loan_item_ids: [loan.id],
        mode: 'single',
        force,
      })
      setActionFeedback({ type: 'success', message: res.message })
      setSingleOverrideModal(null)
      await loadAll()
    } catch (err) {
      if (err.reason === 'PRECONDITION_FAILED' && err.details?.already_reminded_at) {
        setSingleOverrideModal({ loan, lastRemindedAt: err.details.already_reminded_at })
      } else {
        setActionFeedback({ type: 'error', message: err.message })
      }
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Page Title & Mode Switcher (UC-29 Queues vs UC-30 Reminders) */}
      <div className="admin-page-title-row">
        <div>
          <h1 className="admin-page-title">Queues &amp; Reminders</h1>
          <div className="admin-page-desc">
            Reservation FIFO backlog oversight (UC-29) and due / overdue borrower reminder dispatch (UC-30)
          </div>
        </div>

        <div className="admin-drawer-tabs" style={{ width: '360px' }}>
          <button
            type="button"
            className={`admin-drawer-tab-btn ${sectionTab === 'queues' ? 'active' : ''}`}
            onClick={() => { setSectionTab('queues'); setActionFeedback(null) }}
          >
            Reservation Queues ({readyHoldsCount + waitingBacklogCount})
          </button>
          <button
            type="button"
            className={`admin-drawer-tab-btn ${sectionTab === 'reminders' ? 'active' : ''}`}
            onClick={() => { setSectionTab('reminders'); setActionFeedback(null) }}
          >
            <IconBell size={13} /> Due &amp; Overdue ({reminderLoans.length})
          </button>
        </div>
      </div>

      {/* Shared Error / Feedback banner */}
      {(loadError || actionFeedback) && (
        <div
          role={loadError || actionFeedback?.type === 'error' ? 'alert' : 'status'}
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: (loadError || actionFeedback?.type === 'error') ? '#fee2e2' : '#dcfce7',
            color: (loadError || actionFeedback?.type === 'error') ? '#991b1b' : '#166534',
            fontWeight: 600,
            fontSize: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{loadError || actionFeedback?.message}</span>
          <button
            type="button"
            onClick={() => { setLoadError(null); setActionFeedback(null) }}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 1: RESERVATION QUEUES (UC-29 / FR-RES-05)                         */}
      {/* ===================================================================== */}
      {sectionTab === 'queues' && (
        <>
          <div className="admin-kpi-grid">
            <div className="admin-kpi-card">
              <div>
                <div className="admin-kpi-label">Active Backlog</div>
                <div className="admin-kpi-value">{waitingBacklogCount}</div>
              </div>
              <div className="admin-kpi-badge" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>👥</div>
            </div>

            <div className="admin-kpi-card">
              <div>
                <div className="admin-kpi-label">Ready for Pickup</div>
                <div className="admin-kpi-value" style={{ color: '#d97706' }}>{readyHoldsCount}</div>
              </div>
              <div className="admin-kpi-badge" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>📦</div>
            </div>

            <div className="admin-kpi-card">
              <div>
                <div className="admin-kpi-label">Expiring &lt; 12h</div>
                <div className="admin-kpi-value" style={{ color: expiringSoonCount > 0 ? '#dc2626' : '#241e19' }}>
                  {expiringSoonCount}
                </div>
              </div>
              <div className="admin-kpi-badge" style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>⏱️</div>
            </div>

            <div className="admin-kpi-card">
              <div>
                <div className="admin-kpi-label">Queue Policy</div>
                <div className="admin-kpi-value" style={{ fontSize: '18px' }}>Strict FIFO · 48h</div>
              </div>
              <div className="admin-kpi-badge" style={{ backgroundColor: '#e0e7ff', color: '#3730a3' }}>🔒</div>
            </div>
          </div>

          <div className="admin-search-bar-wrap">
            <input
              type="text"
              placeholder="Search by book title, ISBN, student name, student ID, or pickup code..."
              style={{ border: 'none', outline: 'none', width: '100%', fontSize: '14px', fontFamily: 'inherit' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="button" className="admin-btn-outline" onClick={loadAll}>
              <IconRefresh size={14} /> Refresh
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div className="admin-filter-tabs">
              {[
                ['active', 'Active Queues', waitingBacklogCount + readyHoldsCount],
                ['ready_for_pickup', 'Ready for Pickup', readyHoldsCount],
                ['waiting', 'Waiting in Queue', waitingBacklogCount],
                ['closed', 'Cancelled / Closed', reservations.filter((r) => ['cancelled', 'fulfilled', 'expired'].includes(r.status)).length],
                ['all', 'All', reservations.length],
              ].map(([key, label, count]) => (
                <button
                  key={key}
                  type="button"
                  className={`admin-pill-btn ${queueFilter === key ? 'active' : ''}`}
                  onClick={() => setQueueFilter(key)}
                >
                  {label} <span className="admin-pill-count">{count}</span>
                </button>
              ))}
            </div>

            <div className="admin-filter-tabs">
              <button
                type="button"
                className={`admin-pill-btn ${queueView === 'grouped' ? 'active' : ''}`}
                onClick={() => setQueueView('grouped')}
              >
                Grouped by Book
              </button>
              <button
                type="button"
                className={`admin-pill-btn ${queueView === 'flat' ? 'active' : ''}`}
                onClick={() => setQueueView('flat')}
              >
                Flat List
              </button>
            </div>
          </div>

          <div className="admin-work-layout">
            {/* Left Panel: Grouped by Book (UC-29 §2.1) or Flat Table */}
            <div className="admin-table-container">
              <div className="admin-table-toolbar">
                <span style={{ fontSize: '12px', color: '#72685e' }}>
                  FIFO ranks are immutable and system-ordered (manual reordering prohibited per FR-RES-05).
                </span>
              </div>

              {queueView === 'grouped' ? (
                <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {groupedByBook.map((group) => {
                    const bookId = group.book?.id || 'unknown'
                    const collapsed = collapsedBooks.has(bookId)
                    return (
                      <div
                        key={bookId}
                        style={{ border: '1px solid #ede6db', borderRadius: '8px', overflow: 'hidden', background: '#fff' }}
                      >
                        <button
                          type="button"
                          onClick={() => setCollapsedBooks((prev) => {
                            const next = new Set(prev)
                            if (next.has(bookId)) next.delete(bookId)
                            else next.add(bookId)
                            return next
                          })}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            background: '#faf7f2',
                            border: 'none',
                            borderBottom: collapsed ? 'none' : '1px solid #ede6db',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '14px', color: '#241e19' }}>
                              {collapsed ? '▸' : '▾'} {group.book?.title || 'Unknown title'}
                            </div>
                            <div style={{ fontSize: '12px', color: '#72685e', marginTop: '2px' }}>
                              ISBN: {group.book?.isbn13 || '—'} · Copies: {group.book?.available_copies ?? 0} avail / {group.book?.total_copies ?? 0} total
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {group.readyCount > 0 && (
                              <span className="admin-badge admin-badge-ready">{group.readyCount} Held</span>
                            )}
                            <span className="admin-badge admin-badge-gray">{group.waitingCount} Waiting</span>
                          </div>
                        </button>

                        {!collapsed && (
                          <table className="admin-table">
                            <thead>
                              <tr>
                                <th>FIFO Rank</th>
                                <th>Patron &amp; Strikes</th>
                                <th>Copy / Countdown</th>
                                <th>State</th>
                                <th>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.entries.map((res) => {
                                const isSelected = selectedRes?.id === res.id
                                const countdown = res.status === 'ready_for_pickup' ? formatCountdown(res.hold_until, nowMs) : null
                                const strikes = Number(res.profiles?.reservation_strikes || 0)
                                const banned = Boolean(res.profiles?.reservation_ban_until && new Date(res.profiles.reservation_ban_until).getTime() > nowMs)
                                return (
                                  <tr
                                    key={res.id}
                                    className={isSelected ? 'selected' : ''}
                                    onClick={() => setSelectedRes(res)}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    <td>
                                      <strong style={{ color: '#6e472a' }}>
                                        {res.status === 'ready_for_pickup'
                                          ? 'HOLD'
                                          : res.status === 'waiting'
                                            ? `#${res.queue_position || 1}`
                                            : '—'}
                                      </strong>
                                      <div style={{ fontSize: '11px', color: '#9d9388' }}>
                                        {new Date(res.created_at).toLocaleDateString('vi-VN')}
                                      </div>
                                    </td>
                                    <td>
                                      <div style={{ fontWeight: 600 }}>{res.profiles?.full_name || 'Student'}</div>
                                      <div style={{ fontSize: '11px', color: '#72685e', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        <span>MSSV: {res.profiles?.student_id || 'N/A'}</span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            openStrikeInspector(res.profiles)
                                          }}
                                          style={{
                                            border: 'none',
                                            padding: '1px 6px',
                                            borderRadius: '999px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            background: banned || strikes > 0 ? '#fee2e2' : '#f3f4f6',
                                            color: banned || strikes > 0 ? '#991b1b' : '#4b5563',
                                          }}
                                        >
                                          {banned
                                            ? `Banned until ${new Date(res.profiles.reservation_ban_until).toLocaleDateString('vi-VN')}`
                                            : `${strikes} strike${strikes === 1 ? '' : 's'}`}
                                        </button>
                                      </div>
                                    </td>
                                    <td>
                                      {res.copies?.barcode && (
                                        <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '12px' }}>{res.copies.barcode}</div>
                                      )}
                                      {countdown ? (
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: countdown.urgent ? '#dc2626' : '#92400e' }}>
                                          {countdown.text}
                                        </div>
                                      ) : (
                                        <span style={{ fontSize: '11px', color: '#9d9388' }}>—</span>
                                      )}
                                    </td>
                                    <td>{renderReservationBadge(res.status)}</td>
                                    <td>
                                      <button
                                        type="button"
                                        className="admin-btn-outline"
                                        style={{ padding: '4px 8px', fontSize: '11px' }}
                                        onClick={(e) => { e.stopPropagation(); setSelectedRes(res) }}
                                      >
                                        Details →
                                      </button>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )
                  })}

                  {groupedByBook.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '32px', color: '#72685e' }}>
                      No reservation queue entries match your filters.
                    </div>
                  )}
                </div>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Book Title &amp; Details</th>
                      <th>Queue Pos</th>
                      <th>Patron &amp; Strikes</th>
                      <th>Hold State</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReservations.map((res) => {
                      const isSelected = selectedRes?.id === res.id
                      const countdown = res.status === 'ready_for_pickup' ? formatCountdown(res.hold_until, nowMs) : null
                      const strikes = Number(res.profiles?.reservation_strikes || 0)
                      return (
                        <tr
                          key={res.id}
                          className={isSelected ? 'selected' : ''}
                          onClick={() => setSelectedRes(res)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <div style={{ fontWeight: 700, color: '#241e19' }}>{res.books?.title}</div>
                            <div style={{ fontSize: '12px', color: '#72685e' }}>
                              {res.books?.authors?.join(', ')} · ISBN: {res.books?.isbn13}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 700, color: '#6e472a' }}>
                              {res.status === 'ready_for_pickup'
                                ? 'Ready (Hold)'
                                : res.status === 'waiting'
                                  ? `#${res.queue_position || 1}`
                                  : '—'}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{res.profiles?.full_name || 'Student'}</div>
                            <div style={{ fontSize: '12px', color: '#72685e' }}>
                              MSSV: {res.profiles?.student_id || 'N/A'} · {strikes} strike{strikes === 1 ? '' : 's'}
                            </div>
                          </td>
                          <td>
                            {renderReservationBadge(res.status)}
                            {countdown && (
                              <div style={{ fontSize: '11px', fontWeight: 700, color: countdown.urgent ? '#dc2626' : '#92400e', marginTop: '2px' }}>
                                {countdown.text}
                              </div>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="admin-btn-outline"
                              style={{ padding: '4px 10px', fontSize: '12px' }}
                              onClick={(e) => { e.stopPropagation(); setSelectedRes(res) }}
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
              )}
            </div>

            {/* Right Drawer: Queue Detail Allocation */}
            <div className="admin-drawer">
              <div style={{ fontSize: '17px', fontWeight: 700, color: '#241e19' }}>Queue Detail Allocation</div>

              {selectedRes ? (
                <>
                  <div className="admin-drawer-box">
                    <div style={{ fontWeight: 700, fontSize: '16px' }}>{selectedRes.books?.title}</div>
                    <div style={{ fontSize: '12px', color: '#72685e', marginBottom: '8px' }}>
                      {selectedRes.books?.authors?.join(', ')}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {renderReservationBadge(selectedRes.status)}
                      {selectedRes.copies?.barcode && (
                        <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>
                          Copy: {selectedRes.copies.barcode}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="admin-drawer-box">
                    <div className="admin-drawer-box-title">Reserved Reader Information</div>
                    <div style={{ fontSize: '15px', fontWeight: 700 }}>{selectedRes.profiles?.full_name}</div>
                    <div style={{ fontSize: '12px', color: '#72685e' }}>
                      MSSV: {selectedRes.profiles?.student_id || 'N/A'} · {selectedRes.profiles?.email}
                    </div>
                    <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                      <span>
                        Strikes: <strong>{Number(selectedRes.profiles?.reservation_strikes || 0)}</strong>
                        {selectedRes.profiles?.reservation_ban_until && new Date(selectedRes.profiles.reservation_ban_until).getTime() > nowMs && (
                          <span style={{ color: '#dc2626', fontWeight: 700, marginLeft: '6px' }}>
                            (Banned until {new Date(selectedRes.profiles.reservation_ban_until).toLocaleDateString('vi-VN')})
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        className="admin-btn-outline"
                        style={{ padding: '2px 8px', fontSize: '11px' }}
                        onClick={() => openStrikeInspector(selectedRes.profiles)}
                      >
                        Strike History
                      </button>
                    </div>

                    {selectedRes.pickup_code && (
                      <div style={{ marginTop: '8px', fontSize: '14px', fontWeight: 700, color: '#6e472a' }}>
                        Pickup Code: {selectedRes.pickup_code}
                      </div>
                    )}
                    {selectedRes.status === 'ready_for_pickup' && selectedRes.hold_until && (
                      <div style={{ marginTop: '4px', fontSize: '12px', color: formatCountdown(selectedRes.hold_until, nowMs).urgent ? '#dc2626' : '#92400e', fontWeight: 600 }}>
                        Hold deadline: {new Date(selectedRes.hold_until).toLocaleString('vi-VN')} ({formatCountdown(selectedRes.hold_until, nowMs).text})
                      </div>
                    )}
                    {selectedRes.status === 'cancelled' && (
                      <div style={{ marginTop: '8px', padding: '8px', borderRadius: '6px', background: '#fee2e2', color: '#991b1b', fontSize: '12px' }}>
                        <strong>Cancelled:</strong> {selectedRes.cancellation_reason || 'No reason recorded'}
                        {selectedRes.cancelled_at && (
                          <div style={{ marginTop: '2px', fontSize: '11px' }}>
                            at {new Date(selectedRes.cancelled_at).toLocaleString('vi-VN')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {['waiting', 'ready_for_pickup'].includes(selectedRes.status) && (
                    <div style={{ borderTop: '1px solid #ede6db', paddingTop: '12px' }}>
                      <button
                        type="button"
                        style={{
                          width: '100%',
                          padding: '9px',
                          borderRadius: '8px',
                          border: '1px solid #dc2626',
                          backgroundColor: '#fee2e2',
                          color: '#dc2626',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: '14px',
                        }}
                        onClick={() => {
                          setCancelReason('')
                          setCancelModalError(null)
                          setShowCancelModal(true)
                        }}
                      >
                        ✕ Cancel Reservation
                      </button>
                      <div style={{ fontSize: '12px', color: '#72685e', marginTop: '6px', textAlign: 'center' }}>
                        * Librarian cancellation never assigns a penalty strike (POL-07).
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
        </>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: DUE & OVERDUE REMINDERS (UC-30 / FR-NOTIF-04)                  */}
      {/* ===================================================================== */}
      {sectionTab === 'reminders' && (
        <>
          <div className="admin-search-bar-wrap">
            <input
              type="text"
              placeholder="Search borrower name, Student ID, book title, or barcode..."
              style={{ border: 'none', outline: 'none', width: '100%', fontSize: '14px', fontFamily: 'inherit' }}
              value={reminderSearch}
              onChange={(e) => setReminderSearch(e.target.value)}
            />
            <button
              type="button"
              className="admin-btn-primary"
              disabled={actionLoading || enrichedReminders.length === 0}
              onClick={() => openBulkRemindPreview(enrichedReminders, 'All filtered loans')}
            >
              <IconBell size={14} /> Remind All ({enrichedReminders.length})
            </button>
            <button type="button" className="admin-btn-outline" onClick={loadAll}>
              <IconRefresh size={14} /> Refresh
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div className="admin-filter-tabs">
              {[
                ['all', 'All Active / Overdue'],
                ['due_soon', 'Due Soon (≤ 2d)'],
                ['overdue_lt7', 'Overdue (< 7d)'],
                ['overdue_7_14', 'Overdue (7–14d)'],
                ['overdue_gt14', 'Severe Overdue (> 14d)'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`admin-pill-btn ${reminderFilter === key ? 'active' : ''}`}
                  onClick={() => setReminderFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="admin-filter-tabs">
              <button
                type="button"
                className={`admin-pill-btn ${reminderGroupBy === 'day' ? 'active' : ''}`}
                onClick={() => setReminderGroupBy('day')}
              >
                <IconCalendar size={12} /> Group by Day
              </button>
              <button
                type="button"
                className={`admin-pill-btn ${reminderGroupBy === 'week' ? 'active' : ''}`}
                onClick={() => setReminderGroupBy('week')}
              >
                <IconCalendar size={12} /> Group by Week
              </button>
            </div>
          </div>

          {reminderGroups.length === 0 ? (
            <div
              className="admin-table-container"
              style={{ padding: '42px 24px', textAlign: 'center', color: '#467357' }}
            >
              <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '6px' }}>
                No books are currently due or overdue for this selection.
              </div>
              <div style={{ fontSize: '13px', color: '#72685e' }}>
                All loans in this filter scope are in good standing!
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {reminderGroups.map((group) => {
                const collapsed = collapsedReminderGroups.has(group.key)
                return (
                  <div key={group.key} className="admin-table-container">
                    <div
                      style={{
                        padding: '10px 14px',
                        background: group.tone === 'danger' ? '#fef2f2' : '#faf7f2',
                        borderBottom: collapsed ? 'none' : '1px solid #ede6db',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setCollapsedReminderGroups((prev) => {
                          const next = new Set(prev)
                          if (next.has(group.key)) next.delete(group.key)
                          else next.add(group.key)
                          return next
                        })}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '14px',
                          color: group.tone === 'danger' ? '#991b1b' : '#241e19',
                          padding: 0,
                        }}
                      >
                        {collapsed ? '▸' : '▾'} {group.label} — {group.items.length} item{group.items.length === 1 ? '' : 's'}
                      </button>

                      <button
                        type="button"
                        className="admin-btn-outline"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                        disabled={actionLoading}
                        onClick={() => openBulkRemindPreview(group.items, group.label)}
                      >
                        <IconBell size={12} /> Remind Group
                      </button>
                    </div>

                    {!collapsed && (
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Borrower &amp; Student ID</th>
                            <th>Book &amp; Barcode</th>
                            <th>Due Date</th>
                            <th>Accrued Fine</th>
                            <th>Last Reminded</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map((loan) => (
                            <tr key={loan.id}>
                              <td>
                                <div style={{ fontWeight: 600 }}>{loan.profiles?.full_name || 'Student'}</div>
                                <div style={{ fontSize: '12px', color: '#72685e' }}>
                                  {loan.profiles?.student_id || 'N/A'} · {loan.profiles?.email}
                                </div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{loan.books?.title}</div>
                                <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#72685e' }}>
                                  {loan.copies?.barcode || 'N/A'}
                                </div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600, color: loan.overdueDays > 0 ? '#dc2626' : '#241e19' }}>
                                  {loan.dueIso ? new Date(loan.dueIso).toLocaleDateString('vi-VN') : '—'}
                                </div>
                                {loan.overdueDays > 0 && (
                                  <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>
                                    {loan.overdueDays} day(s) overdue
                                    {loan.approachingLost && (
                                      <span style={{ marginLeft: '6px', background: '#fee2e2', padding: '1px 5px', borderRadius: '4px' }}>
                                        <IconAlertTriangle size={10} /> Near 60d lost limit
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td>
                                <strong style={{ color: loan.accruedFine > 0 ? '#dc2626' : '#72685e' }}>
                                  {loan.accruedFine.toLocaleString('vi-VN')}đ
                                </strong>
                              </td>
                              <td>
                                {loan.last_reminded_at ? (
                                  <div style={{ fontSize: '12px', color: loan.remindedRecently ? '#92400e' : '#72685e' }}>
                                    {new Date(loan.last_reminded_at).toLocaleString('vi-VN')}
                                    {loan.remindedRecently && <div style={{ fontSize: '11px', fontWeight: 600 }}>Within 24h cooldown</div>}
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '12px', color: '#9d9388' }}>Never</span>
                                )}
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="admin-btn-outline"
                                  style={{ padding: '4px 10px', fontSize: '12px' }}
                                  disabled={actionLoading}
                                  onClick={() => handleSingleRemind(loan, false)}
                                >
                                  <IconBell size={12} /> Remind
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Modal 1: Staff Cancel Reservation (UC-29 §2.2.2) */}
      {showCancelModal && selectedRes && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Reservation Cancellation"
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
              padding: '22px',
              width: '440px',
              maxWidth: '92vw',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
            }}
          >
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#dc2626' }}>
              Confirm Reservation Cancellation
            </h3>
            <p style={{ fontSize: '13px', color: '#72685e', margin: '0 0 12px 0' }}>
              You are cancelling the reservation for &ldquo;<strong>{selectedRes.books?.title}</strong>&rdquo; by{' '}
              <strong>{selectedRes.profiles?.full_name}</strong>. Staff cancellation does <strong>not</strong> add a penalty strike.
            </p>

            {cancelModalError && (
              <div style={{ marginBottom: '10px', padding: '8px 10px', borderRadius: '6px', background: '#fee2e2', color: '#991b1b', fontSize: '12px', fontWeight: 600 }}>
                {cancelModalError}
              </div>
            )}

            <label htmlFor="cancel-res-reason" style={{ fontSize: '12px', fontWeight: 600, color: '#241e19', display: 'block', marginBottom: '6px' }}>
              Cancellation reason (required, 10–500 characters):
            </label>
            <textarea
              id="cancel-res-reason"
              rows="3"
              placeholder="e.g. Patron called to withdraw or held copy moved to repair..."
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid #dcd3c5',
                fontSize: '13px',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                marginBottom: '4px',
              }}
              value={cancelReason}
              onChange={(e) => {
                setCancelReason(e.target.value)
                setCancelModalError(null)
              }}
            />
            <div style={{ fontSize: '11px', color: '#72685e', marginBottom: '14px' }}>
              {cancelReason.trim().length} / 500 characters
            </div>

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
                  fontSize: '13px',
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

      {/* Modal 2: Strike History Inspector (UC-29 §2.2.4) */}
      {strikeModalStudent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Student Reservation Strike History"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setStrikeModalStudent(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '20px',
              width: '420px',
              maxWidth: '92vw',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 4px', fontSize: '17px', color: '#241e19' }}>
              Strike History — {strikeModalStudent.full_name}
            </h3>
            <div style={{ fontSize: '12px', color: '#72685e', marginBottom: '12px' }}>
              MSSV: {strikeModalStudent.student_id || 'N/A'} · Rolling 180-day window
            </div>

            <div className="admin-drawer-box" style={{ marginBottom: '12px', fontSize: '13px' }}>
              <div>Active strikes: <strong>{Number(strikeModalStudent.reservation_strikes || 0)}</strong></div>
              <div style={{ marginTop: '4px' }}>
                Ban status:{' '}
                {strikeModalStudent.reservation_ban_until && new Date(strikeModalStudent.reservation_ban_until).getTime() > nowMs ? (
                  <strong style={{ color: '#dc2626' }}>
                    Banned until {new Date(strikeModalStudent.reservation_ban_until).toLocaleDateString('vi-VN')}
                  </strong>
                ) : (
                  <strong style={{ color: '#166534' }}>Eligible (No active ban)</strong>
                )}
              </div>
            </div>

            {strikeLoading ? (
              <div style={{ fontSize: '13px', color: '#72685e', padding: '12px 0' }}>Loading strike events...</div>
            ) : strikeEvents.length === 0 ? (
              <div style={{ fontSize: '13px', color: '#72685e', padding: '12px 0' }}>
                No expired-hold strike events recorded in the past 180 days.
              </div>
            ) : (
              <ul style={{ margin: '0 0 12px', paddingLeft: '18px', fontSize: '12px', color: '#52473f' }}>
                {strikeEvents.map((ev) => (
                  <li key={ev.id} style={{ marginBottom: '4px' }}>
                    <strong>{new Date(ev.occurred_at).toLocaleDateString('vi-VN')}</strong> — {ev.reason}
                  </li>
                ))}
              </ul>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="admin-btn-outline" onClick={() => setStrikeModalStudent(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Bulk "Remind All" Preview & Confirmation (UC-30 §2.2.3) */}
      {bulkRemindModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Bulk Reminders"
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
          <div style={{ background: '#fff', borderRadius: '12px', padding: '22px', width: '440px', maxWidth: '92vw' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', color: '#241e19' }}>Send Bulk Return Reminders?</h3>
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#72685e' }}>
              Scope: <strong>{bulkRemindModal.label}</strong>
            </p>
            <div className="admin-drawer-box" style={{ marginBottom: '16px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>Total distinct borrowers: <strong>{bulkRemindModal.totalStudents}</strong></div>
              <div style={{ color: '#166534' }}>Eligible to send: <strong>{bulkRemindModal.eligible}</strong></div>
              <div style={{ color: '#92400e' }}>Skipped (reminded within 24 hours): <strong>{bulkRemindModal.skipped}</strong></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="admin-btn-outline"
                disabled={actionLoading}
                onClick={() => setBulkRemindModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn-primary"
                disabled={actionLoading || bulkRemindModal.eligible === 0}
                onClick={handleConfirmBulkRemind}
              >
                {actionLoading ? 'Sending...' : `Confirm Send (${bulkRemindModal.eligible})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Individual Reminder 24h Override Confirmation (UC-30 §2.2.2) */}
      {singleOverrideModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Duplicate Reminder"
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
          <div style={{ background: '#fff', borderRadius: '12px', padding: '22px', width: '420px', maxWidth: '92vw' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '17px', color: '#92400e' }}>Already Reminded Within 24 Hours</h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#52473f' }}>
              <strong>{singleOverrideModal.loan.profiles?.full_name}</strong> was already reminded at{' '}
              <strong>{new Date(singleOverrideModal.lastRemindedAt).toLocaleString('vi-VN')}</strong>. Send another reminder anyway?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="admin-btn-outline"
                disabled={actionLoading}
                onClick={() => setSingleOverrideModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn-primary"
                disabled={actionLoading}
                onClick={() => handleSingleRemind(singleOverrideModal.loan, true)}
              >
                {actionLoading ? 'Sending...' : 'Send Anyway'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
