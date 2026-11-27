import React, { useEffect, useRef, useState } from 'react'
import './admin.css'
import { supabase } from '../../../lib/supabase'
import {
  IconDashboard,
  IconReports,
  IconCirculation,
  IconBooks,
  IconAcquisitions,
  IconQueues,
  IconPeople,
  IconMoney,
  IconBell
} from './AdminIcons'

export function AdminLayout({ activePage = 'circulation', onNavigate, user, profile, onLogout, children }) {
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifFilter, setNotifFilter] = useState('all') // 'all' | 'unread'
  const [notifications, setNotifications] = useState([])
  const [systemOnline, setSystemOnline] = useState(true)
  const notifRef = useRef(null)

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: IconDashboard },
    { id: 'circulation', label: 'Circulation', icon: IconCirculation },
    { id: 'books', label: 'Books', icon: IconBooks },
    { id: 'acquisitions', label: 'Acquisitions', icon: IconAcquisitions },
    { id: 'queues', label: 'Queues', icon: IconQueues },
    { id: 'people', label: 'People', icon: IconPeople },
    { id: 'money', label: 'Money', icon: IconMoney },
    { id: 'reports', label: 'Reports', icon: IconReports },
  ]

  useEffect(() => {
    let active = true
    const uid = user?.id || profile?.id
    if (!uid) return undefined

    async function loadNotificationsAndHealth() {
      const [{ data, error }, { error: healthErr }] = await Promise.all([
        supabase
          .from('notifications')
          .select('id, type, title, body, read_at, created_at')
          .eq('uid', uid)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('books').select('id', { count: 'exact', head: true }),
      ])

      if (!active) return
      setSystemOnline(!healthErr)
      if (!error && Array.isArray(data)) {
        setNotifications(data)
      }
    }

    loadNotificationsAndHealth()
    return () => { active = false }
  }, [user?.id, profile?.id, activePage])

  useEffect(() => {
    if (!notifOpen) return undefined
    const onDocClick = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [notifOpen])

  const unreadCount = notifications.filter((item) => !item.read_at).length
  const visibleNotifications = notifFilter === 'unread'
    ? notifications.filter((item) => !item.read_at)
    : notifications

  const markRead = async (id) => {
    const nowIso = new Date().toISOString()
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, read_at: nowIso } : item)))
    await supabase.from('notifications').update({ read_at: nowIso }).eq('id', id)
  }

  const markAllRead = async () => {
    const uid = user?.id || profile?.id
    if (!uid || unreadCount === 0) return
    const nowIso = new Date().toISOString()
    setNotifications((prev) => prev.map((item) => (item.read_at ? item : { ...item, read_at: nowIso })))
    await supabase.from('notifications').update({ read_at: nowIso }).eq('uid', uid).is('read_at', null)
  }

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-icon"><IconBooks size={16} color="#fff" /></div>
          <div>
            <div className="admin-brand-title">ShelfHelp</div>
            <div className="admin-brand-sub">Archival & Circulation Desk</div>
          </div>
        </div>

        <nav className="admin-nav">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activePage === item.id
            return (
              <button
                key={item.id}
                type="button"
                className={`admin-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => onNavigate && onNavigate(item.id)}
              >
                <Icon size={14} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-system-status" title={systemOnline ? 'Database connected' : 'Connection degraded'}>
            <span>{systemOnline ? 'System Online' : 'System Offline'}</span>
            <span
              className="admin-status-dot"
              style={{ backgroundColor: systemOnline ? '#16a34a' : '#dc2626' }}
            />
          </div>
          <button
            type="button"
            className="admin-logout-button"
            onClick={onLogout}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="admin-main">
        <header className="admin-header">
          <div className="admin-header-spacer" />
          <div className="admin-header-account">
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className="admin-notifications"
                aria-label="Notifications"
                aria-expanded={notifOpen}
                onClick={() => setNotifOpen((open) => !open)}
              >
                <IconBell size={18} color="#72685e" />
                {unreadCount > 0 && (
                  <span className="admin-notification-count">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div
                  role="dialog"
                  aria-label="Notification Center"
                  style={{
                    position: 'absolute',
                    top: '44px',
                    left: 0,
                    width: '340px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    background: '#ffffff',
                    border: '1px solid #ede6db',
                    borderRadius: '10px',
                    boxShadow: '0 14px 30px rgba(36, 30, 25, 0.14)',
                    zIndex: 200,
                    padding: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '14px', color: '#241e19' }}>Notifications ({unreadCount} unread)</strong>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllRead}
                        style={{ border: 'none', background: 'transparent', color: '#6e472a', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                    {['all', 'unread'].map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        className={`admin-pill-btn ${notifFilter === tab ? 'active' : ''}`}
                        onClick={() => setNotifFilter(tab)}
                        style={{ padding: '3px 10px', fontSize: '11px' }}
                      >
                        {tab === 'all' ? 'All' : 'Unread'}
                      </button>
                    ))}
                  </div>

                  {visibleNotifications.length === 0 ? (
                    <div style={{ padding: '18px 8px', textAlign: 'center', color: '#72685e', fontSize: '12px' }}>
                      {notifFilter === 'unread' ? 'No unread notifications.' : 'Your notification inbox is empty.'}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {visibleNotifications.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: '1px solid #ede6db',
                            background: item.read_at ? '#ffffff' : '#faf6f0',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
                            <strong style={{ fontSize: '12px', color: '#241e19' }}>{item.title}</strong>
                            {!item.read_at && (
                              <button
                                type="button"
                                onClick={() => markRead(item.id)}
                                style={{ border: 'none', background: 'transparent', color: '#6e472a', fontSize: '11px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >
                                Mark read
                              </button>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: '#72685e', marginTop: '3px' }}>{item.body}</div>
                          <div style={{ fontSize: '11px', color: '#9d9388', marginTop: '4px' }}>
                            {new Date(item.created_at).toLocaleString('vi-VN')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="admin-avatar">
              {profile?.full_name ? profile.full_name.substring(0, 2).toUpperCase() : 'TH'}
            </div>
            <div className="admin-account-details">
              <div className="admin-account-name">
                {profile?.full_name || 'Librarian'}
              </div>
              <div className="admin-account-id">{profile?.student_id || profile?.email || 'Library Staff'}</div>
            </div>
          </div>
        </header>

        <main className="admin-page-content">{children}</main>
      </div>
    </div>
  )
}
